"""RealEstateAI — API backend d'estimation immobilière (données DVF, Île-de-France).

Ce fichier regroupe la configuration, les schémas Pydantic et les endpoints.
La logique métier est dans `utils/`.

Contrat aligné sur le frontend React (`src/App.jsx`) :

  GET  /api/health               -> { status, dvf_loaded, ... }
  GET  /api/metadata/communes    -> ["PARIS 01", ...]   (tableau JSON nu)
  POST /api/predictions/estimate -> { estimated_price, price_per_m2,
                                      price_range: { low, high, ... }, ... }

Les erreurs renvoient toujours {"detail": "<message lisible en français>"},
y compris les erreurs de validation : le ResultPanel affiche ce champ tel quel.

Lancement :
    cd Backend
    uvicorn main:app --reload --port 8000
"""

from __future__ import annotations

import json
import logging
import os
import sys
from contextlib import asynccontextmanager
from functools import lru_cache
from pathlib import Path
from typing import Any, Literal

import numpy as np
import pandas as pd
import uvicorn
from fastapi import Depends, FastAPI, HTTPException, Query, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field, model_validator
try:
    from slowapi import Limiter, _rate_limit_exceeded_handler
    from slowapi.errors import RateLimitExceeded
    from slowapi.util import get_remote_address
    _SLOWAPI = True
except ImportError:
    _SLOWAPI = False
    RateLimitExceeded = Exception

    class _NoOpLimiter:
        def limit(self, *args, **kwargs):
            def decorator(fn): return fn
            return decorator

    def _rate_limit_exceeded_handler(request, exc):
        return JSONResponse(status_code=429, content={"detail": "Trop de tentatives."})

    def get_remote_address(request): return "0.0.0.0"

from auth import create_access_token, decode_token, hash_password, verify_password
from database import SearchHistoryService
from financing_api import router as financing_router
from utils.address_parser import normalize_commune, parse_address
from utils.dvf_search import (
    SearchConfig,
    commune_display_names,
    load_dvf,
    search_comparables,
)
from utils.price_calculation import NoComparableError, calculate_price

# ==========================================================================
#  CONFIGURATION
# ==========================================================================

BASE_DIR = Path(__file__).resolve().parent

# Chemins : jamais de séparateur en dur. Un chemin Windows codé "en dur"
# casse dans Docker, et un chemin relatif dépend du dossier de lancement.
DVF_OUTPUTS_DIR = Path(os.getenv("DVF_OUTPUTS_DIR", BASE_DIR / "Data pipeline" / "outputs"))
DVF_GOLD_DIR = Path(
    os.getenv("DVF_GOLD_DIR", BASE_DIR.parent / "data" / "processed" / "gold_transactions")
)
DVF_CLEAN_PATH = os.getenv("DVF_CLEAN_PATH")  # surcharge explicite, optionnelle

API_PREFIX = "/api"

# Vite tourne en 5173. "*" avec allow_credentials=True est refusé par le navigateur.
DEFAULT_ORIGINS = [
    "http://localhost:5173",   # Vite dev
    "http://127.0.0.1:5173",
    "http://localhost:4173",   # Vite preview
    "http://localhost:8501",   # frontend Docker
    "http://127.0.0.1:8501",
    "https://realestateai-frontend.onrender.com",  # prod Render
]
CORS_ORIGINS = json.loads(os.getenv("CORS_ORIGINS", json.dumps(DEFAULT_ORIGINS)))

ALLOW_MOCK_FALLBACK = os.getenv("ALLOW_MOCK_FALLBACK", "true").lower() == "true"
MOCK_BASE_PRICE_PER_M2 = float(os.getenv("MOCK_BASE_PRICE_PER_M2", "7000"))

logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO"),
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
)
logger = logging.getLogger("realestateai")


def resolve_dvf_path() -> Path | None:
    """Trouve le dataset à charger.

    La pipeline data produit un dossier Parquet partitionné
    `data/processed/gold_transactions/annee=...`, chargé en priorité.
    Le pipeline produit `DVF_clean_2025.parquet` ou `DVF_clean_2024_2025.parquet`
    selon les années traitées : on prend le plus récent plutôt que d'exiger un
    nom figé (c'est ce décalage de nom qui empêchait l'API de charger le DVF).
    """
    if DVF_CLEAN_PATH:
        candidate = Path(DVF_CLEAN_PATH)
        return candidate if candidate.exists() else None

    if DVF_GOLD_DIR.is_dir() and any(DVF_GOLD_DIR.rglob("*.parquet")):
        return DVF_GOLD_DIR

    for pattern in ("DVF_clean_*.parquet", "DVF_clean_*.csv"):
        found = list(DVF_OUTPUTS_DIR.glob(pattern))
        if found:
            return max(found, key=lambda p: p.stat().st_mtime)
    return None


# ==========================================================================
#  SCHÉMAS
# ==========================================================================

# 'other' est envoyé par le bouton « Autre » du formulaire React.
# 'studio' n'est pas dans l'UI mais reste accepté.
PropertyType = Literal["apartment", "house", "studio", "other"]


class EstimationRequest(BaseModel):
    model_config = ConfigDict(json_schema_extra={
        "examples": [
            {
                "summary": "Appartement Paris 15e (adresse complète)",
                "value": {
                    "area_m2": 65,
                    "rooms": 3,
                    "property_type": "apartment",
                    "address": "12 rue de la Convention",
                    "postal_code": "75015",
                    "commune": "Paris 15e",
                },
            },
            {
                "summary": "Maison à Versailles (commune seule)",
                "value": {
                    "area_m2": 120,
                    "rooms": 5,
                    "property_type": "house",
                    "commune": "Versailles",
                },
            },
        ],
    })

    area_m2: float = Field(..., gt=5, le=2000, description="Surface habitable en m²")
    property_type: PropertyType = Field(
        default="apartment",
        description="Type de bien : `apartment`, `house`, `studio` ou `other`",
    )
    rooms: int | None = Field(default=None, ge=0, le=30, description="Nombre de pièces (optionnel)")
    commune: str | None = Field(default=None, description="Nom de commune IDF (ex : `PARIS 15`, `Versailles`)")
    address: str | None = Field(default=None, description="Rue et numéro (ex : `12 rue de la Paix`)")
    postal_code: str | None = Field(default=None, description="Code postal à 5 chiffres (ex : `75015`)")
    location_lat: float | None = Field(default=None, ge=-90, le=90, description="Latitude WGS84 (optionnel)")
    location_lng: float | None = Field(default=None, ge=-180, le=180, description="Longitude WGS84 (optionnel)")
    dpe_classe: Literal["A", "B", "C", "D", "E", "F", "G"] | None = Field(
        default=None, description="Classe DPE du bien (A à G, optionnel)"
    )
    annee_construction: int | None = Field(
        default=None, ge=1800, le=2026, description="Année de construction (optionnel)"
    )
    numero_dpe: str | None = Field(
        default=None, pattern=r"^[0-9A-Za-z]{13}$",
        description="Numéro ADEME du DPE (13 caractères, figure sur le diagnostic) — optionnel",
    )
    numero_lot: str | None = Field(
        default=None, max_length=20,
        description="Numéro de lot de copropriété (titre de propriété) — optionnel",
    )

    @model_validator(mode="after")
    def require_location(self):
        has_commune = bool(self.commune and self.commune.strip())
        has_address = bool(self.address and self.address.strip())
        if not has_commune and not has_address:
            raise ValueError("il faut renseigner une commune ou une adresse")
        return self

    @model_validator(mode="after")
    def normalize_rooms(self):
        # Le frontend envoie Number('') === 0 quand le champ est laissé vide.
        if self.rooms is not None and self.rooms <= 0:
            self.rooms = None
        return self

    @model_validator(mode="after")
    def check_surface_rooms_ratio(self):
        if self.area_m2 and self.rooms and self.rooms > 0:
            ratio = self.area_m2 / self.rooms
            if ratio > 200:
                raise ValueError(
                    f"Ratio surface/pièces irréaliste ({ratio:.0f} m²/pièce) — "
                    "vérifiez la surface ou le nombre de pièces"
                )
            if ratio < 5:
                raise ValueError(
                    f"Ratio surface/pièces irréaliste ({ratio:.1f} m²/pièce) — "
                    "minimum 5 m² par pièce"
                )
        return self


class PriceRange(BaseModel):
    """Clés `low`/`high` et non `lower`/`upper` : c'est ce que lit
    `normalizeResult()` côté React. Avec de mauvais noms, le frontend retombe
    silencieusement sur price * 0.9 et la jauge affiche une fourchette inventée.
    """

    low: float
    high: float
    low_per_m2: float
    high_per_m2: float
    basis: str = "interquartile"


class EstimationMeta(BaseModel):
    scope: str
    scope_value: str
    property_type_used: str
    surface_tolerance: float | None = None
    rooms_tolerance: int | None = None
    fallback_level: int = 0
    n_transactions: int = 0
    dispersion: float = 0.0
    notes: list[str] = []


class EstimationResponse(BaseModel):
    model_config = ConfigDict(extra="allow")

    estimated_price: float
    price_per_m2: float
    price_range: PriceRange
    reliability: float = Field(..., ge=0, le=1)
    model: Literal["dvf", "mock", "ml"]
    meta: EstimationMeta | None = None
    predicted_price: float | None = None
    confidence_interval: dict[str, Any] | None = None
    local_mape: float | None = None
    local_mape_n: int | None = None
    classe_fiabilite: str | None = None
    secteur: dict[str, Any] | None = None
    comparables_immeuble: list[dict[str, Any]] | None = None
    dpe_trouve: bool | None = None
    dpe_source: str | None = None          # numero | adresse | saisi
    dpe_date: str | None = None
    dpe_appariement: str | None = None     # exacte | probable (DPE retrouvé à l'adresse)
    code_postal: str | None = None
    historique_id: int | None = None       # ligne d'historique, pour y rattacher les simulations
    segments_difficiles: list[dict[str, Any]] | None = None  # erreur mesurée des segments du bien
    immeuble_reference: dict[str, Any] | None = None  # médiane des ventes de l'immeuble, ramenée au secteur
    adresse_sans_numero: bool | None = None  # rue seule : l'immeuble n'est pas identifié
    alerte_type: str | None = None   # type saisi jamais vendu à cette adresse, alors que l'autre l'a été


class SimulationRequest(BaseModel):
    type: Literal["plusvalue", "financement"]
    donnees: dict[str, Any]


class HealthResponse(BaseModel):
    status: Literal["healthy", "degraded"]
    dvf_loaded: bool
    dvf_path: str | None = None
    n_rows: int = 0
    n_communes: int = 0
    error: str | None = None
    model_loaded: bool = False
    model_error: str | None = None
    model_mape: float | None = None
    model_r2: float | None = None
    model_trained_at: str | None = None
    model_n_features: int | None = None
    model_n_transactions: int | None = None
    model_n_train: int | None = None
    model_n_test: int | None = None
    # Résultats de la validation officielle (protocole fixé avant mesure)
    model_validation: dict[str, Any] | None = None
    dvf_min_year: int | None = None
    dvf_max_year: int | None = None
    dpe_loaded: bool = False
    dpe_coverage_pct: float | None = None
    dpe_n_zones: int = 0


# ==========================================================================
#  APPLICATION
# ==========================================================================


def _charger_model_info() -> dict | None:
    candidates = [
        BASE_DIR / "models" / "model_info.json",
        BASE_DIR.parent / "Backend" / "models" / "model_info.json",
    ]
    for p in candidates:
        if p.exists():
            try:
                import json as _json
                return _json.loads(p.read_text())
            except Exception:
                pass
    return None


def _charger_validation() -> dict | None:
    """Résultats officiels du protocole d'évaluation (Backend/models/validation.json)."""
    for p in (BASE_DIR / "models" / "validation.json", BASE_DIR.parent / "Backend" / "models" / "validation.json"):
        if p.exists():
            try:
                return json.loads(p.read_text())
            except Exception:  # noqa: BLE001
                pass
    return None


def _charger_segments() -> dict:
    """Erreur mesurée par segment (Backend/models/segments_performance.json,
    produit par ml/exporter_segments.py à partir du test officiel)."""
    p = BASE_DIR / "models" / "segments_performance.json"
    try:
        return json.loads(p.read_text()).get("segments", {}) if p.exists() else {}
    except Exception:  # noqa: BLE001
        return {}


_LIBELLES_SEGMENT = {
    "dpe_inconnu": "DPE introuvable à cette adresse",
    "petite_surface": "surface de moins de 30 m²",
    "sans_vente_immeuble": "aucune vente récente dans l'immeuble",
    "maison": "maison",
    "paris": "Paris",
    "grande_surface": "surface de 100 m² ou plus",
}


def _alerte_type(type_bien: str | None, ventes: dict) -> str | None:
    """Type de bien jamais vendu à cette adresse alors que l'autre l'a été au moins
    3 fois : la saisie est probablement erronée (une maison à l'adresse d'un immeuble)."""
    demande, autre = ("1", "2") if type_bien == "house" else ("2", "1")
    if ventes.get(demande, 0) == 0 and ventes.get(autre, 0) >= 3:
        vu = "appartements" if autre == "2" else "maisons"
        saisi = "une maison" if type_bien == "house" else "un appartement"
        return (f"À cette adresse, les {ventes[autre]} ventes enregistrées sont des {vu}, aucune n'est {saisi} : "
                "vérifiez le type de bien. L'estimation suppose le type saisi.")
    return None


def _segments_difficiles(segments: dict, *, departement: str | None, type_bien: str | None,
                         surface: float, dpe_connu: bool, ventes_immeuble: int,
                         sans_numero: bool = False) -> list[dict]:
    """Segments du bien où le modèle se trompe plus que sa moyenne, mesurés sur le
    test officiel : l'utilisateur sait que l'estimation y est moins sûre."""
    ensemble = segments.get("ensemble", {}).get("mape")
    concernes = {
        "dpe_inconnu": not dpe_connu,
        "petite_surface": surface < 30,
        "sans_vente_immeuble": ventes_immeuble == 0,
        "maison": type_bien == "house",
        "paris": departement == "75",
        "grande_surface": surface >= 100,
    }
    libelles = {**_LIBELLES_SEGMENT, **({"sans_vente_immeuble": "adresse sans numéro, immeuble non identifié",
                                           "dpe_inconnu": "DPE introuvable (adresse sans numéro)"}
                                          if sans_numero else {})}
    res = [{"segment": k, "libelle": libelles[k], **segments[k]}
           for k, oui in concernes.items() if oui and k in segments
           and (ensemble is None or segments[k]["mape"] > ensemble)]
    return sorted(res, key=lambda s: -s["mape"])


ANNEES_SECTEUR = (2021, 2022, 2023, 2024, 2025)


def _ramener_ventes_au_secteur(comparables: list[dict], secteur: dict | None, surface: float) -> dict | None:
    """Ventes de l'immeuble ramenées au marché de la dernière année avec la série
    annuelle du secteur, celle que la page affiche (« Évolution depuis 2021 »).

    Le modèle utilise l'indice de référence de la commune sur 12 mois ; pour
    l'affichage, on ramène chaque vente avec la même série que le graphique du
    secteur, sinon une vente de 2021 pouvait « monter » alors que la courbe du
    secteur baisse. Renvoie la médiane de l'immeuble appliquée à la surface."""
    eco = (secteur or {}).get("eco") or []
    serie = {a: v for a, v in zip(ANNEES_SECTEUR, eco) if v}
    if not comparables or not serie:
        return None
    annee_ref = max(serie)
    ramenes = []
    for c in comparables:
        try:
            annee = int(str(c.get("date", ""))[:4])
        except ValueError:
            continue
        base = serie.get(min(max(annee, min(serie)), annee_ref))
        if base and c.get("prix_m2"):
            c["prix_m2_aujourdhui"] = round(c["prix_m2"] * serie[annee_ref] / base)
            # Les ventes sur plan (VEFA) portent la prime du neuf : hors de la médiane
            if not c.get("vefa"):
                ramenes.append(c["prix_m2_aujourdhui"])
        c["annee_reference"] = annee_ref
    if not ramenes:
        return None
    med = float(pd.Series(ramenes).median())
    return {"prix_m2": round(med), "valeur": round(med * surface, -3), "n": len(ramenes), "annee": annee_ref,
            "n_vefa": sum(1 for c in comparables if c.get("vefa"))}


def _construire_secteurs(df: "pd.DataFrame | None") -> dict:
    """Statistiques de marché par commune et type de bien, calculées une fois
    au démarrage sur le dataset chargé, sur l'ancien seul : médiane et déciles
    de la dernière année, nombre de ventes, médiane annuelle 2021-2025.

    Remplace les chiffres écrits en dur dans le frontend : une mise à jour du
    dataset se reflète sans toucher au code de l'interface."""
    colonnes = ["code_commune", "commune", "type_bien_norm", "date_mutation", "prix_au_m2"]
    if df is None or not set(colonnes) <= set(df.columns):
        return {}
    # Ancien seul : un bien estimé est presque toujours une revente, et les ventes sur
    # plan (VEFA) faussent la médiane et la courbe du secteur (Bobigny, appartements :
    # 7 453 €/m² en 2021 avec 65 % de neuf, contre 3 333 € dans l'ancien).
    if "est_vefa" in df.columns:
        df = df[~df["est_vefa"].fillna(False).astype(bool)]
    cles = ["code_commune", "type_bien_norm"]
    # L'année est la partition du parquet (annee=2025/), absente des fichiers lus un à un
    annee = pd.to_datetime(df["date_mutation"], errors="coerce").dt.year
    d = pd.DataFrame({"code_commune": df["code_commune"].astype(str), "type_bien_norm": df["type_bien_norm"].astype(str),
                      "commune": df["commune"], "annee": annee, "prix": df["prix_au_m2"]}).dropna(subset=["prix", "annee"])
    derniere = int(d["annee"].max())
    tout = d.groupby(cles)["prix"].agg(n="count", med_tout="median",
                                       p10_tout=lambda s: s.quantile(0.10), p90_tout=lambda s: s.quantile(0.90))
    rec = d[d["annee"] == derniere].groupby(cles)["prix"].agg(
        n_rec="count", med="median", p10=lambda s: s.quantile(0.10), p90=lambda s: s.quantile(0.90))
    noms = d.groupby(cles)["commune"].agg(lambda s: s.value_counts().index[0])
    par_an = d.groupby(cles + ["annee"])["prix"].median().unstack()
    stats = tout.join(rec).join(noms).join(par_an)
    secteurs: dict = {}
    for (code, typ), r in stats.iterrows():
        recent = r["n_rec"] >= 10  # sinon : toute la période
        secteurs[(code, typ)] = {
            "code": code, "nom": str(r["commune"]), "annee": derniere,
            "med": round(float(r["med"] if recent else r["med_tout"])),
            "p10": round(float(r["p10"] if recent else r["p10_tout"])),
            "p90": round(float(r["p90"] if recent else r["p90_tout"])),
            "n": int(r["n"]),
            "eco": [round(float(r[a])) if a in r.index and pd.notna(r[a]) else None for a in ANNEES_SECTEUR],
        }
    return secteurs


TYPES_MARCHE = ("apartment", "house")
SEGMENTS_MARCHE = ("tous", "ancien", "neuf")


def _construire_marche(df: "pd.DataFrame | None") -> dict:
    """Carte des prix (par commune) et référence du marché (par département et
    par mois), calculées au démarrage sur le dataset chargé, séparément pour les
    appartements et les maisons, et pour tout le marché, l'ancien ou le neuf (VEFA).

    Une médiane qui mélange maisons et appartements varie selon ce qui s'est
    vendu (Versailles : 6 930 €/m² en appartement, 9 179 € en maison). Les
    fichiers statiques de data/samples ne servent plus que de repli."""
    colonnes = {"commune", "type_bien_norm", "date_mutation", "prix_au_m2", "dep"}
    if df is None or not colonnes <= set(df.columns):
        return {}
    date = pd.to_datetime(df["date_mutation"], errors="coerce")
    d = pd.DataFrame({
        "commune": df["commune"].astype(str), "type": df["type_bien_norm"].astype(str),
        "dep": df["dep"].astype(str).str.zfill(2), "prix": df["prix_au_m2"],
        "annee": date.dt.year, "mois": date.dt.month,
        "lat": df["latitude"] if "latitude" in df.columns else np.nan,
        "lon": df["longitude"] if "longitude" in df.columns else np.nan,
        "vefa": df["est_vefa"].fillna(False).astype(bool) if "est_vefa" in df.columns else False,
    }).dropna(subset=["prix", "annee"])
    derniere = int(d["annee"].max())
    q1, q3 = (lambda s: s.quantile(0.25)), (lambda s: s.quantile(0.75))
    marche: dict = {"carte": {}, "tendances": {}, "annee": derniere}
    for typ in TYPES_MARCHE:
        for seg in SEGMENTS_MARCHE:
            sous = d[d["type"] == typ]
            if seg != "tous":
                sous = sous[sous["vefa"] == (seg == "neuf")]
            # Carte : dernière année si la commune y a au moins 10 ventes, sinon 2021-2025
            tout = sous.groupby("commune").agg(dep=("dep", "first"), lat=("lat", "median"), lon=("lon", "median"),
                                              n=("prix", "size"), med=("prix", "median"), q1=("prix", q1), q3=("prix", q3))
            rec = sous[sous["annee"] == derniere].groupby("commune")["prix"].agg(
                n_rec="size", med_rec="median", q1_rec=q1, q3_rec=q3)
            stats = tout.join(rec)
            lignes = []
            for nom, s in stats.iterrows():
                recent = pd.notna(s["n_rec"]) and s["n_rec"] >= 10
                n = int(s["n_rec"] if recent else s["n"])
                if n < 5:
                    continue
                lignes.append({
                    "nom_commune": nom, "code_departement": s["dep"],
                    "lat": round(float(s["lat"]), 5) if pd.notna(s["lat"]) else None,
                    "lon": round(float(s["lon"]), 5) if pd.notna(s["lon"]) else None,
                    "prix_m2_median": round(float(s["med_rec"] if recent else s["med"])),
                    "prix_m2_q1": round(float(s["q1_rec"] if recent else s["q1"])),
                    "prix_m2_q3": round(float(s["q3_rec"] if recent else s["q3"])),
                    "n_transactions": n, "periode": str(derniere) if recent else f"2021-{derniere}",
                })
            marche["carte"][(typ, seg)] = lignes
            # Référence : médiane mensuelle par département
            mensuel = sous.groupby(["dep", "annee", "mois"])["prix"].agg(["median", "size"]).reset_index()
            marche["tendances"][(typ, seg)] = [
                {"annee": int(m["annee"]), "mois": int(m["mois"]), "mois_index": int((m["annee"] - 2000) * 12 + m["mois"]),
                 "code_departement": m["dep"], "prix_m2_median": round(float(m["median"])), "n_transactions": int(m["size"])}
                for _, m in mensuel.iterrows() if m["size"] >= 5]
    return marche


_CACHE_DATASET: dict = {}


def _empreinte(path: Path) -> tuple:
    """Taille et date de modification des fichiers : change si le dataset change."""
    fichiers = sorted(path.rglob("*.parquet")) if path.is_dir() else [path]
    return tuple((str(f), f.stat().st_size, f.stat().st_mtime_ns) for f in fichiers)


def _charger_dataset(path: Path) -> dict:
    """Dataset, communes et statistiques de secteur, mis en cache dans le
    processus tant que les fichiers ne changent pas.

    Le chargement coûte ~7 s et les secteurs ~2,5 s : sans cache, chaque
    démarrage de l'application (un par test dans la suite de tests) les
    payait à nouveau."""
    cle = (str(path), _empreinte(path))
    if cle not in _CACHE_DATASET:
        dvf = load_dvf(path)
        secteurs = _construire_secteurs(dvf)
        marche = _construire_marche(dvf)
        _CACHE_DATASET.clear()
        _CACHE_DATASET[cle] = {
            "dvf": dvf,
            "communes": commune_display_names(dvf),
            "secteurs": secteurs,
            "marche": marche,
            "secteurs_par_nom": {(normalize_commune(s["nom"]), typ): s for (_, typ), s in secteurs.items()},
        }
    return _CACHE_DATASET[cle]


def _type_secteur(property_type: str | None) -> str:
    return "house" if property_type == "house" else "apartment"


def _dvf_year_range(info: dict | None, bound: str) -> int | None:
    if not info:
        return None
    all_years = list(info.get("train_years", [])) + list(info.get("test_years", []))
    if not all_years:
        return None
    return min(all_years) if bound == "min" else max(all_years)


def _charger_local_mape() -> dict:
    candidates = [
        BASE_DIR / "models" / "local_mape.json",
        BASE_DIR.parent / "Backend" / "models" / "local_mape.json",
    ]
    for p in candidates:
        if p.exists():
            try:
                import json as _json
                return _json.loads(p.read_text())
            except Exception:
                pass
    return {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Charge le dataset une seule fois, au démarrage.

    `@app.on_event("startup")` est déprécié : c'est le remplaçant officiel.
    L'API démarre même si le dataset est absent ; /api/health renvoie alors
    `degraded`, ce que le Header React affiche en « Backend indisponible ».
    """
    app.state.dvf = None
    app.state.dvf_error = None
    app.state.dvf_path = None
    app.state.communes = []
    app.state.dpe_zone = {}       # {code_postal: zone_part_dpe_fg}
    app.state.dpe_coverage = 0.0  # fraction de transactions avec dpe_classe
    app.state.search_history = SearchHistoryService()
    app.state.search_history.init_db()
    app.state.model_info = _charger_model_info()
    app.state.local_mape = _charger_local_mape()
    app.state.validation = _charger_validation()
    app.state.segments = _charger_segments()
    app.state.secteurs = {}
    app.state.secteurs_par_nom = {}
    app.state.marche = {}

    path = resolve_dvf_path()
    if path is None:
        app.state.dvf_error = (
            f"Aucun dataset DVF trouvé dans {DVF_GOLD_DIR} ou {DVF_OUTPUTS_DIR}. "
            "Lancez d'abord le pipeline de données."
        )
        logger.warning(app.state.dvf_error)
    else:
        try:
            donnees = _charger_dataset(path)
            app.state.dvf = donnees["dvf"]
            app.state.dvf_path = str(path)
            app.state.communes = donnees["communes"]
            app.state.secteurs = donnees["secteurs"]
            app.state.secteurs_par_nom = donnees["secteurs_par_nom"]
            app.state.marche = donnees.get("marche", {})
        except Exception as exc:  # noqa: BLE001 — on veut démarrer malgré tout
            app.state.dvf_error = f"{type(exc).__name__} : {exc}"
            logger.exception("Échec du chargement du dataset DVF")

    # Enrichissement DPE : index zone automatiquement si les colonnes existent
    if app.state.dvf is not None:
        try:
            dvf = app.state.dvf
            if "dpe_classe" in dvf.columns:
                app.state.dpe_coverage = round(float(dvf["dpe_classe"].notna().mean()), 4)
                if "zone_part_dpe_fg" in dvf.columns and "code_postal" in dvf.columns:
                    zone = dvf[["code_postal", "zone_part_dpe_fg"]].dropna(subset=["zone_part_dpe_fg"])
                    zone = zone.drop_duplicates("code_postal")
                    app.state.dpe_zone = dict(
                        zip(zone["code_postal"].astype(str), zone["zone_part_dpe_fg"].astype(float))
                    )
                logger.info(
                    "DPE : couverture %.1f %%, %d codes postaux avec indicateur de zone",
                    app.state.dpe_coverage * 100, len(app.state.dpe_zone),
                )
            else:
                logger.info("DPE : colonnes absentes du dataset — lance `pipeline dpe` puis `gold`")
        except Exception as exc:  # noqa: BLE001
            logger.warning("Chargement index DPE échoué : %s", exc)

    yield
    app.state.dvf = None


_OPENAPI_TAGS = [
    {
        "name": "estimation",
        "description": (
            "Estimation du prix d'un bien immobilier en Île-de-France. "
            "Utilise un modèle LightGBM entraîné sur les données DVF 2021–2025 "
            "avec géolocalisation BAN. Repli automatique sur les statistiques DVF "
            "communales si le modèle ML n'est pas disponible."
        ),
    },
    {
        "name": "auth",
        "description": (
            "Authentification JWT. Les tokens ont une durée de vie de 7 jours. "
            "Passer le token dans le header : `Authorization: Bearer <token>`."
        ),
    },
    {
        "name": "historique",
        "description": (
            "Historique des estimations. Sans token → estimations anonymes. "
            "Avec token → estimations liées au compte, invisibles pour les autres utilisateurs."
        ),
    },
    {
        "name": "marché",
        "description": "Statistiques de marché par commune et évolution mensuelle par département.",
    },
    {
        "name": "métadonnées",
        "description": "Communes disponibles pour l'autocomplétion du formulaire.",
    },
    {
        "name": "système",
        "description": "Santé de l'API, état du dataset DVF et du modèle ML.",
    },
]

_limiter = Limiter(key_func=get_remote_address) if _SLOWAPI else _NoOpLimiter()

app = FastAPI(
    title="RealEstateAI API",
    description="""
## Estimation immobilière Île-de-France

API REST d'estimation de prix au m² basée sur les **données DVF** (Demandes de Valeurs Foncières)
et un modèle **LightGBM** géolocalisé via l'API BAN (Base Adresse Nationale).

### Périmètre
- 8 départements : 75, 77, 78, 91, 92, 93, 94, 95
- ~630 000 transactions DVF 2021–2025
- Erreur médiane (MAPE) : ~14 %

### Authentification
Les routes protégées requièrent un token JWT dans le header :
```
Authorization: Bearer <token>
```
Obtenir un token via `POST /api/auth/login` ou `POST /api/auth/register`.

### Flux typique
1. `GET /api/health` — vérifier que le modèle est chargé
2. `POST /api/auth/login` — s'authentifier
3. `POST /api/predictions/estimate` — estimer un bien
4. `GET /api/search-history` — consulter ses estimations
""",
    version="1.4.0",
    contact={
        "name": "RealEstateAI",
        "url": "https://github.com/kalioudiallo/RealStateAI",
    },
    license_info={
        "name": "MIT",
    },
    openapi_tags=_OPENAPI_TAGS,
    lifespan=lifespan,
)

app.state.limiter = _limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["*"],
)
app.include_router(financing_router)


# ---------------------------------------------------- erreurs lisibles

_FIELD_LABELS = {
    "area_m2": "La surface",
    "rooms": "Le nombre de pièces",
    "property_type": "Le type de bien",
    "commune": "La commune",
    "address": "L'adresse",
}

_ERROR_MESSAGES = {
    "greater_than": "doit être supérieure à {limit}.",
    "greater_than_equal": "doit être supérieure ou égale à {limit}.",
    "less_than_equal": "doit être inférieure ou égale à {limit}.",
    "missing": "est obligatoire.",
    "int_parsing": "doit être un nombre entier.",
    "float_parsing": "doit être un nombre.",
    "literal_error": "n'est pas une valeur acceptée.",
}


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Transforme les erreurs Pydantic en un message unique et lisible.

    Par défaut FastAPI renvoie une liste d'objets. Le ResultPanel affiche
    `e.message` : l'utilisateur verrait « [object Object] ».
    """
    error = exc.errors()[0]
    error_type = error.get("type", "")

    if error_type == "value_error":
        detail = str(error.get("msg", "")).replace("Value error, ", "").capitalize()
        return JSONResponse(status_code=422, content={"detail": detail + "."})

    field = next((str(p) for p in error.get("loc", []) if p != "body"), "Le champ")
    label = _FIELD_LABELS.get(field, f"Le champ « {field} »")
    ctx = error.get("ctx", {})
    limit = ctx.get("limit_value", ctx.get("gt", ctx.get("le", "")))
    template = _ERROR_MESSAGES.get(error_type, "est invalide.")
    return JSONResponse(
        status_code=422,
        content={"detail": f"{label} {template.format(limit=limit)}"},
    )


def get_dvf(request: Request) -> pd.DataFrame | None:
    return request.app.state.dvf


def _current_user(request: Request) -> int | None:
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        return None
    token = auth.removeprefix("Bearer ").strip()
    payload = decode_token(token)
    if not payload:
        return None
    try:
        return int(payload["sub"])
    except (KeyError, ValueError, TypeError):
        return None


# ==========================================================================
#  AUTH SCHEMAS
# ==========================================================================

class AuthRequest(BaseModel):
    email: str = Field(..., min_length=3, max_length=254)
    password: str = Field(..., min_length=1, max_length=128)

class RegisterRequest(BaseModel):
    email: str = Field(..., min_length=3, max_length=254)
    password: str = Field(..., min_length=6, max_length=128)


class AuthResponse(BaseModel):
    token: str
    user: dict[str, Any]

class ForgotPasswordRequest(BaseModel):
    email: str = Field(..., min_length=3, max_length=254)

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(..., min_length=6, max_length=128)

class ChangePasswordRequest(BaseModel):
    current_password: str = Field(..., min_length=1, max_length=128)
    new_password: str = Field(..., min_length=6, max_length=128)


# ==========================================================================
#  AUTH ENDPOINTS
# ==========================================================================

@app.post(
    f"{API_PREFIX}/auth/register",
    response_model=AuthResponse,
    tags=["auth"],
    summary="Créer un compte",
    responses={409: {"description": "Email déjà utilisé"}},
)
@_limiter.limit("3/minute")
def register(body: RegisterRequest, request: Request) -> AuthResponse:
    """Crée un nouveau compte et retourne un token JWT valable 7 jours.

    - **email** : adresse email unique (3–254 caractères)
    - **password** : mot de passe en clair, haché côté serveur (min 6 caractères)
    """
    service: SearchHistoryService = request.app.state.search_history
    existing = service.get_user_by_email(body.email)
    if existing:
        raise HTTPException(409, "Un compte existe déjà avec cet email.")
    try:
        user = service.create_user(body.email, hash_password(body.password))
    except Exception as exc:
        logger.warning("Erreur création utilisateur : %s", exc)
        raise HTTPException(409, "Un compte existe déjà avec cet email.") from exc
    token = create_access_token(user["id"], user["email"])
    return AuthResponse(token=token, user={"id": user["id"], "email": user["email"]})


@app.post(
    f"{API_PREFIX}/auth/login",
    response_model=AuthResponse,
    tags=["auth"],
    summary="Se connecter",
    responses={401: {"description": "Email ou mot de passe incorrect"}},
)
@_limiter.limit("5/minute")
def login(body: AuthRequest, request: Request) -> AuthResponse:
    """Authentifie un utilisateur existant et retourne un token JWT valable 7 jours."""
    service: SearchHistoryService = request.app.state.search_history
    user = service.get_user_by_email(body.email)
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(401, "Email ou mot de passe incorrect.")
    token = create_access_token(user["id"], user["email"])
    return AuthResponse(token=token, user={"id": user["id"], "email": user["email"]})


@app.get(
    f"{API_PREFIX}/auth/me",
    tags=["auth"],
    summary="Profil de l'utilisateur connecté",
    responses={401: {"description": "Token absent ou invalide"}},
)
def me(request: Request) -> dict[str, Any]:
    user_id = _current_user(request)
    if user_id is None:
        raise HTTPException(401, "Non authentifié.")
    service: SearchHistoryService = request.app.state.search_history
    # Cherche par id via email dans le token
    auth = request.headers.get("Authorization", "")
    token = auth.removeprefix("Bearer ").strip()
    payload = decode_token(token)
    if not payload:
        raise HTTPException(401, "Token invalide.")
    compte = service.get_user_by_email(payload.get("email", "")) or {}
    return {"id": user_id, "email": payload.get("email", ""), "created_at": compte.get("created_at")}


@app.post(f"{API_PREFIX}/auth/forgot-password", tags=["auth"], summary="Demander un reset de mot de passe")
@_limiter.limit("3/minute")
def forgot_password(body: ForgotPasswordRequest, request: Request) -> dict[str, Any]:
    service: SearchHistoryService = request.app.state.search_history
    result = service.create_reset_token(body.email)
    if result:
        logger.info("Reset token pour %s : %s", result["email"], result["token"])
    return {
        "message": "Si un compte existe avec cet email, un code a été généré.",
        "dev_token": result["token"] if result else None,
    }


@app.post(f"{API_PREFIX}/auth/reset-password", tags=["auth"], summary="Réinitialiser le mot de passe")
def reset_password(body: ResetPasswordRequest, request: Request) -> dict[str, Any]:
    service: SearchHistoryService = request.app.state.search_history
    user_id = service.get_valid_reset_token(body.token)
    if not user_id:
        raise HTTPException(400, "Code invalide ou expiré.")
    service.update_password(user_id, hash_password(body.new_password))
    service.use_reset_token(body.token)
    return {"message": "Mot de passe réinitialisé avec succès."}


@app.put(f"{API_PREFIX}/auth/me/password", tags=["auth"], summary="Changer son mot de passe")
def change_password(body: ChangePasswordRequest, request: Request) -> dict[str, Any]:
    user_id = _current_user(request)
    if user_id is None:
        raise HTTPException(401, "Non authentifié.")
    auth = request.headers.get("Authorization", "")
    token = auth.removeprefix("Bearer ").strip()
    payload = decode_token(token)
    if not payload:
        raise HTTPException(401, "Token invalide.")
    service: SearchHistoryService = request.app.state.search_history
    user = service.get_user_by_email(payload.get("email", ""))
    if not user:
        raise HTTPException(404, "Utilisateur introuvable.")
    if not verify_password(body.current_password, user["password_hash"]):
        raise HTTPException(400, "Mot de passe actuel incorrect.")
    service.update_password(user_id, hash_password(body.new_password))
    return {"message": "Mot de passe modifié avec succès."}


@app.put(f"{API_PREFIX}/history/{{item_id}}/simulation", tags=["historique"],
         summary="Rattacher une simulation à une estimation")
def attach_history_simulation(item_id: int, body: SimulationRequest, request: Request) -> dict[str, Any]:
    """Garde la dernière simulation de plus-value ou de financement faite sur ce bien."""
    user_id = _current_user(request)
    service: SearchHistoryService = request.app.state.search_history
    if len(json.dumps(body.donnees, default=str)) > 20_000:
        raise HTTPException(413, "Simulation trop volumineuse.")
    if not service.attach_simulation(item_id, user_id, body.type, body.donnees):
        raise HTTPException(404, "Estimation introuvable ou accès refusé.")
    return {"message": "Simulation enregistrée."}


@app.delete(f"{API_PREFIX}/history/{{item_id}}", tags=["historique"], summary="Supprimer une estimation")
def delete_history_item(item_id: int, request: Request) -> dict[str, Any]:
    user_id = _current_user(request)
    service: SearchHistoryService = request.app.state.search_history
    deleted = service.delete_search(item_id, user_id)
    if not deleted:
        raise HTTPException(404, "Estimation introuvable ou accès refusé.")
    return {"message": "Estimation supprimée."}


@app.delete(f"{API_PREFIX}/history", tags=["historique"], summary="Vider tout l'historique")
def clear_history(request: Request) -> dict[str, Any]:
    user_id = _current_user(request)
    if user_id is None:
        raise HTTPException(401, "Non authentifié.")
    service: SearchHistoryService = request.app.state.search_history
    deleted = service.clear_history(user_id)
    return {"message": f"{deleted} estimation(s) supprimée(s).", "deleted": deleted}


@app.delete(f"{API_PREFIX}/auth/me", tags=["auth"], summary="Supprimer son compte")
def delete_account(request: Request) -> dict[str, Any]:
    user_id = _current_user(request)
    if user_id is None:
        raise HTTPException(401, "Non authentifié.")
    service: SearchHistoryService = request.app.state.search_history
    deleted = service.delete_user(user_id)
    if not deleted:
        raise HTTPException(404, "Utilisateur introuvable.")
    return {"message": "Compte supprimé définitivement."}


def _load_ml_estimator() -> tuple[Any | None, str | None]:
    """Charge un module ML s’il existe dans le dépôt.

    Le backend doit rester compatible même si le modèle est développé dans une
    autre partie du projet ou pas encore disponible dans cette branche.
    """
    roots: list[Path] = [
        Path(__file__).resolve().parent.parent,
        Path(__file__).resolve().parent,
        Path(__file__).resolve().parent.parent / "Backend",
    ]
    seen: set[str] = set()
    for root in roots:
        for candidate in (root / "ml", root / "Backend" / "ml"):
            p = str(candidate)
            if candidate.exists() and p not in seen:
                seen.add(p)
                # Add ml/ itself (for bare imports: "from geocoding import ...")
                if p not in sys.path:
                    sys.path.insert(0, p)
                # Add parent of ml/ (for package imports: "from ml.estimator import ...")
                parent = str(candidate.parent)
                if parent not in sys.path:
                    sys.path.insert(0, parent)

    candidates = [
        "estimator",
        "ml.estimator",
        "ml.model",
        "app.ml.estimator",
    ]
    for module_name in candidates:
        try:
            module = __import__(module_name, fromlist=["estimer_prix"])
            if hasattr(module, "estimer_prix"):
                return module.estimer_prix, None
        except Exception as exc:  # pragma: no cover - dépend de la structure du repo
            logger.debug("ML module %s indisponible : %s", module_name, exc)
    return None, "module ML introuvable"


ML_ESTIMATOR, ML_ERROR = _load_ml_estimator()


def _normalize_ml_result(raw: Any, surface: float) -> EstimationResponse:
    """Normalise une réponse brute ML vers le contrat du backend."""
    if isinstance(raw, dict):
        estimated = float(
            raw.get("estimated_price")
            or raw.get("predicted_price")
            or raw.get("price")
            or 0.0
        )
        per_m2 = float(raw.get("price_per_m2") or (estimated / surface if surface > 0 else 0.0))
        ci = raw.get("confidence_interval") or {}
        low = float(ci.get("lower") or estimated * 0.85)
        high = float(ci.get("upper") or estimated * 1.15)
        confidence = ci.get("confidence") or "85%"
        reliability = float(raw.get("reliability") or 0.8)
        model_name = str(raw.get("model") or "ml")

        notes: list[str] = ["estimation fournie par le modèle ML"]
        if surface < 30:
            # Peu de transactions DVF pour les très petites surfaces → fourchette élargie
            # On élargit seulement : rétrécir une fourchette calibrée la rendrait fausse
            low = min(low, estimated * 0.80)
            high = max(high, estimated * 1.20)
            reliability = min(reliability, 0.65)
            notes.append("petite surface (< 30 m²) — fourchette élargie, segment sous-représenté dans les données")

        payload = EstimationResponse(
            estimated_price=estimated,
            price_per_m2=per_m2,
            price_range=PriceRange(
                low=low,
                high=high,
                low_per_m2=low / surface if surface > 0 else low,
                high_per_m2=high / surface if surface > 0 else high,
                basis="ml",
            ),
            reliability=min(1.0, max(0.0, reliability)),
            model=model_name if model_name in {"dvf", "mock", "ml"} else "ml",
            predicted_price=estimated,
            confidence_interval={"lower": low, "upper": high, "confidence": confidence},
            meta=EstimationMeta(
                scope="ml",
                scope_value="ml",
                property_type_used="ml",
                fallback_level=0,
                n_transactions=0,
                notes=notes,
            ),
        )
        return payload

    if hasattr(raw, "model_dump"):
        return _normalize_ml_result(raw.model_dump(), surface)

    raise TypeError("Réponse ML non reconnue")


# ==========================================================================
#  ENDPOINTS
# ==========================================================================


@app.get(f"{API_PREFIX}/health", response_model=HealthResponse, tags=["système"])
def health(request: Request) -> HealthResponse:
    df = request.app.state.dvf
    loaded = df is not None
    info = request.app.state.model_info or {}
    dpe_cov = getattr(request.app.state, "dpe_coverage", 0.0)
    dpe_zones = getattr(request.app.state, "dpe_zone", {})
    return HealthResponse(
        status="healthy" if loaded else "degraded",
        dvf_loaded=loaded,
        dvf_path=request.app.state.dvf_path,
        n_rows=int(len(df)) if loaded else 0,
        n_communes=len(request.app.state.communes),
        error=request.app.state.dvf_error,
        model_loaded=ML_ESTIMATOR is not None,
        model_error=ML_ERROR,
        model_mape=info.get("mape"),
        model_r2=info.get("r2"),
        model_trained_at=info.get("trained_at"),
        model_n_features=info.get("n_features"),
        model_n_transactions=(info.get("n_train", 0) + info.get("n_test", 0)) or None,
        model_n_train=info.get("n_train") or None,
        model_n_test=info.get("n_test") or None,
        dvf_min_year=_dvf_year_range(info, "min"),
        dvf_max_year=_dvf_year_range(info, "max"),
        dpe_loaded=dpe_cov > 0,
        dpe_coverage_pct=round(dpe_cov * 100, 1) if dpe_cov > 0 else None,
        dpe_n_zones=len(dpe_zones),
        model_validation=getattr(request.app.state, "validation", None),
    )


@app.get(
    f"{API_PREFIX}/metadata/communes",
    response_model=list[str],
    tags=["métadonnées"],
)
def list_communes(
    request: Request,
    q: str | None = Query(default=None, description="Filtre sur le nom de la commune"),
) -> list[str]:
    """Communes disponibles, pour le datalist du formulaire.

    Renvoie un TABLEAU JSON nu : `normalizeCommunes()` côté React commence par
    `Array.isArray(raw)` et renverrait une liste vide pour un objet enveloppe.
    """
    communes: list[str] = request.app.state.communes
    if q:
        needle = normalize_commune(q)
        communes = [c for c in communes if needle in normalize_commune(c)]
    return communes


@app.get(
    f"{API_PREFIX}/search-history",
    response_model=list[dict[str, Any]],
    tags=["historique"],
    summary="Estimations récentes",
)
def list_search_history(
    request: Request,
    limit: int = Query(default=10, ge=1, le=200, description="Nombre maximum de résultats (1–200)"),
) -> list[dict[str, Any]]:
    """Retourne les estimations récentes.

    - **Sans token** : estimations anonymes de la session courante.
    - **Avec token** (`Authorization: Bearer <token>`) : estimations liées au compte,
      invisibles pour les autres utilisateurs.
    """
    service: SearchHistoryService = request.app.state.search_history
    user_id = _current_user(request)
    return service.list_recent(limit=limit, user_id=user_id)


def _inscrire_historique(request: Request, req: Any, surface: float, reponse: EstimationResponse,
                         *, adresse_normalisee: str | None = None, query: str | None = None) -> None:
    """Inscrit l'estimation dans l'historique avec sa réponse complète.

    La réponse (fourchette, classe de fiabilité, DPE retrouvé, ventes de l'immeuble)
    et la date d'entraînement du modèle sont gardées : l'historique peut ainsi
    réafficher le résultat tel qu'il était, sans le recalculer. L'identifiant de la
    ligne est renvoyé dans la réponse pour y rattacher les simulations.
    """
    try:
        info = getattr(request.app.state, "model_info", None) or {}
        resultat = {**reponse.model_dump(exclude={"historique_id"}),
                    "modele_entraine_le": info.get("trained_at"),
                    "saisie": {"address": req.address, "commune": req.commune, "postal_code": req.postal_code,
                               "property_type": req.property_type, "surface": surface, "rooms": req.rooms,
                               "dpe_classe": req.dpe_classe, "annee_construction": req.annee_construction}}
        texte = " ".join(filter(None, [req.address, req.postal_code, req.commune])).strip()
        ligne = request.app.state.search_history.add_search(
            query=adresse_normalisee or texte or query or "",
            commune=req.commune,
            property_type=req.property_type,
            area_m2=surface,
            estimated_price=reponse.estimated_price,
            user_id=_current_user(request),
            rooms=req.rooms,
            address=req.address,
            postal_code=req.postal_code,
            adresse_normalisee=adresse_normalisee,
            dpe_classe=req.dpe_classe,
            annee_construction=req.annee_construction,
            resultat=resultat,
        )
        reponse.historique_id = ligne.get("id")
    except Exception as exc:  # pragma: no cover - la persistance ne doit pas casser la réponse
        logger.warning("Historique de recherche non inscrit : %s", exc)


def _mock_estimate(surface: float, property_type: str) -> EstimationResponse:
    """Estimation de repli quand le dataset est absent (démo, CI).

    Ces chiffres n'ont aucune valeur : `model` vaut "mock" et `reliability` 0.1
    pour que le frontend puisse le signaler.
    """
    multiplier = {"studio": 1.2, "apartment": 1.0, "house": 0.9, "other": 1.0}
    ppm2 = MOCK_BASE_PRICE_PER_M2 * multiplier.get(property_type, 1.0)
    price = surface * ppm2
    margin = 0.15
    return EstimationResponse(
        estimated_price=round(price, 2),
        price_per_m2=round(ppm2, 2),
        price_range=PriceRange(
            low=round(price * (1 - margin), 2),
            high=round(price * (1 + margin), 2),
            low_per_m2=round(ppm2 * (1 - margin), 2),
            high_per_m2=round(ppm2 * (1 + margin), 2),
            basis="heuristique",
        ),
        reliability=0.1,
        model="mock",
        predicted_price=round(price, 2),
        confidence_interval={
            "lower": round(price * (1 - margin), 2),
            "upper": round(price * (1 + margin), 2),
            "confidence": "85%",
        },
    )


@app.post(
    f"{API_PREFIX}/predictions/estimate",
    response_model=EstimationResponse,
    tags=["estimation"],
    summary="Estimer le prix d'un bien",
)
def estimate(
    req: EstimationRequest,
    request: Request,
    df: pd.DataFrame | None = Depends(get_dvf),
) -> EstimationResponse:
    """Estime le prix d'un bien immobilier en Île-de-France.

    ### Logique de sélection du modèle
    | Priorité | Modèle | Condition |
    |----------|--------|-----------|
    | 1 | **ML** (LightGBM + BAN) | modèle chargé **et** adresse/commune fournie |
    | 2 | **DVF** (stats communales) | dataset DVF chargé |
    | 3 | **Mock** (heuristique) | aucune donnée disponible (CI/démo) |

    ### Réponse — champs clés
    - `estimated_price` : prix estimé en €
    - `price_per_m2` : prix au m² médian
    - `price_range.low` / `price_range.high` : fourchette à 85 %
    - `reliability` : indice de fiabilité [0–1] (dépend du nombre de transactions)
    - `model` : `"ml"`, `"dvf"` ou `"mock"`

    ### Codes d'erreur
    - **422** : données manquantes ou invalides (surface, localisation, ratio surface/pièces)
    - **404** : commune inconnue ou aucune transaction comparable
    """
    surface = req.area_m2
    type_bien = req.property_type

    # Le modèle ML a besoin d'une adresse : il géolocalise le bien, retrouve sa
    # parcelle, son immeuble, son IRIS. Une commune seule se géocode au centre
    # de la commune, ce qui n'a pas de sens pour lui : elle passe par la médiane
    # des ventes comparables (repli DVF).
    if ML_ESTIMATOR is not None and req.address and req.address.strip():
        try:
            payload: dict[str, Any] = {
                "adresse": req.address,
                "code_postal": req.postal_code,
                "surface_m2": surface,
                "nb_pieces": float(req.rooms) if req.rooms is not None else 3.0,
                "type_bien": type_bien,
                "a_terrain": type_bien == "house",
            }
            # zone_part_dpe_fg : feature DPE de zone, indexée par code postal
            _dpe_zone = getattr(request.app.state, "dpe_zone", {})
            if req.postal_code and req.postal_code in _dpe_zone:
                payload["zone_part_dpe_fg"] = float(_dpe_zone[req.postal_code])
            if req.dpe_classe:
                payload["dpe_classe"] = req.dpe_classe
            if req.annee_construction:
                payload["annee_construction"] = req.annee_construction
            if req.numero_dpe:
                payload["numero_dpe"] = req.numero_dpe
            if req.numero_lot:
                payload["numero_lot"] = req.numero_lot
            ml_result = ML_ESTIMATOR(**{k: v for k, v in payload.items() if v is not None})
            if ml_result is not None:
                logger.info("Réponse renvoyée par le modèle ML")
                normalized = _normalize_ml_result(ml_result, surface)
                code_commune = ml_result.get("code_commune") if isinstance(ml_result, dict) else None
                # Localisation déjà calculée par le géocodage BAN, réexposée telle
                # quelle pour le frontend (contexte marché, financement).
                # code_departement : même dérivation que ml/geocoding.py (2 premiers caractères).
                if isinstance(ml_result, dict):
                    normalized.adresse_normalisee = ml_result.get("adresse_normalisee")
                    normalized.commune = ml_result.get("commune")
                    normalized.code_commune = code_commune
                    normalized.code_departement = code_commune[:2] if code_commune else None
                lm = getattr(request.app.state, "local_mape", {}).get(code_commune or "", {})
                normalized.local_mape = lm.get("mape") if lm else None
                normalized.local_mape_n = lm.get("n") if lm else None
                if isinstance(ml_result, dict):
                    normalized.classe_fiabilite = ml_result.get("classe_fiabilite")
                    normalized.comparables_immeuble = ml_result.get("comparables_immeuble") or []
                    normalized.dpe_trouve = ml_result.get("dpe_trouve")
                    normalized.dpe_source = ml_result.get("dpe_source")
                    normalized.dpe_date = ml_result.get("dpe_date")
                    normalized.dpe_appariement = ml_result.get("dpe_appariement")
                    normalized.secteur = getattr(request.app.state, "secteurs", {}).get(
                        (str(ml_result.get("code_commune") or ""), _type_secteur(type_bien)))
                    normalized.immeuble_reference = _ramener_ventes_au_secteur(
                        normalized.comparables_immeuble, normalized.secteur, surface)
                if lm.get("mape"):
                    normalized.reliability = round(max(0.30, min(0.95, 1.0 - lm["mape"] / 100)), 2)
                # Score géocodage BAN
                score_geocodage = ml_result.get("score_geocodage") if isinstance(ml_result, dict) else None
                if score_geocodage is not None and score_geocodage < 0.6:
                    normalized.geocoding_warning = (
                        f"Adresse localisée avec une confiance faible ({score_geocodage:.0%}) "
                        "— vérifiez que l'adresse est correcte."
                    )
                # Enrichissement DPE : saisi par l'agent, sinon retrouvé par son numéro ADEME
                dpe_retrouve = ml_result if isinstance(ml_result, dict) else {}
                if req.dpe_classe or dpe_retrouve.get("dpe_classe"):
                    normalized.dpe_classe = req.dpe_classe or dpe_retrouve.get("dpe_classe")
                if req.annee_construction or dpe_retrouve.get("annee_construction"):
                    normalized.annee_construction = req.annee_construction or dpe_retrouve.get("annee_construction")
                # Part de passoires du code postal : saisi, sinon retrouvé par le géocodage
                zone = ml_result.get("zone_part_dpe_fg") if isinstance(ml_result, dict) else None
                if zone is None:
                    dpe_zone = getattr(request.app.state, "dpe_zone", {})
                    zone = dpe_zone.get(req.postal_code) if req.postal_code else None
                if zone is not None:
                    normalized.dpe_zone_fg_pct = round(float(zone) * 100, 1)
                if isinstance(ml_result, dict) and ml_result.get("code_postal"):
                    normalized.code_postal = ml_result["code_postal"]
                normalized.segments_difficiles = _segments_difficiles(
                    getattr(request.app.state, "segments", {}),
                    departement=str((ml_result.get("code_commune") if isinstance(ml_result, dict) else "") or "")[:2] or None,
                    type_bien=req.property_type, surface=surface,
                    dpe_connu=bool(getattr(normalized, "dpe_classe", None)),
                    ventes_immeuble=len(normalized.comparables_immeuble or []),
                    sans_numero=bool(isinstance(ml_result, dict) and ml_result.get("adresse_sans_numero")))
                if isinstance(ml_result, dict):
                    normalized.adresse_sans_numero = bool(ml_result.get("adresse_sans_numero"))
                    normalized.alerte_type = _alerte_type(req.property_type, ml_result.get("ventes_par_type") or {})
                _inscrire_historique(request, req, surface, normalized, adresse_normalisee=(
                    ml_result.get("adresse_normalisee") if isinstance(ml_result, dict) else None))
                return normalized
        except ValueError as exc:
            # Erreur métier lisible (adresse introuvable, hors périmètre IDF…)
            msg = str(exc)
            if "introuvable" in msg.lower():
                raise HTTPException(
                    422,
                    "Adresse introuvable — vérifiez l'orthographe ou précisez la commune (ex : Neuilly-sur-Seine).",
                ) from exc
            raise HTTPException(422, msg) from exc
        except Exception as exc:  # pragma: no cover - dépend du module ML réel
            logger.warning("Erreur modèle ML, fallback vers DVF : %s", exc)

    if df is None:
        if not ALLOW_MOCK_FALLBACK:
            raise HTTPException(503, "Le service d'estimation est momentanément indisponible.")
        logger.warning("Dataset indisponible : réponse mock renvoyée")
        result = _mock_estimate(surface, req.property_type)
        _inscrire_historique(request, req, surface, result)
        return result

    # Localisation : commune explicite en priorité, sinon parsing de l'adresse.
    dep: str | None = None
    if req.commune and req.commune.strip():
        commune_norm = normalize_commune(req.commune)
        if req.address:
            dep = parse_address(req.address).dep
    else:
        parsed = parse_address(req.address)
        commune_norm = parsed.commune_norm
        dep = parsed.dep

    if not commune_norm:
        raise HTTPException(422, "Impossible de déterminer la commune à partir de la saisie.")

    # Filtre géographique Île-de-France
    _IDF_DEPS = {"75", "77", "78", "91", "92", "93", "94", "95"}
    # Noms de communes hors IDF couramment saisis par erreur
    _HORS_IDF_COMMUNES = {
        "lyon", "marseille", "bordeaux", "lille", "toulouse", "nantes",
        "strasbourg", "montpellier", "rennes", "grenoble", "nice", "toulon",
        "saint etienne", "tours", "dijon", "angers", "nimes", "clermont ferrand",
        "le mans", "aix en provence", "brest", "limoges", "amiens",
    }
    if dep and dep not in _IDF_DEPS:
        raise HTTPException(
            422,
            f"RealEstateAI couvre uniquement l'Île-de-France (départements 75–95). "
            f"La localisation saisie semble être dans le département {dep}. "
            f"Vérifiez votre adresse ou votre code postal.",
        )
    if not dep and commune_norm in _HORS_IDF_COMMUNES:
        raise HTTPException(
            422,
            f"RealEstateAI couvre uniquement l'Île-de-France. "
            f"« {req.commune or commune_norm} » ne fait pas partie du périmètre couvert.",
        )

    outcome = search_comparables(
        df=df,
        commune_norm=commune_norm,
        type_bien=type_bien,
        surface_m2=surface,
        rooms=req.rooms,
        dep=dep,
        config=SearchConfig(),
    )

    if outcome.is_empty:
        raise HTTPException(
            404,
            f"Aucune transaction comparable pour « {req.commune or commune_norm} » "
            f"({surface:.0f} m²). Essayez une commune voisine ou une autre surface.",
        )

    try:
        result = calculate_price(outcome.transactions, surface)
    except NoComparableError as exc:
        raise HTTPException(404, str(exc)) from exc

    response = EstimationResponse(
        estimated_price=result.estimated_price,
        price_per_m2=result.price_per_m2,
        price_range=PriceRange(
            low=result.range_low,
            high=result.range_high,
            low_per_m2=result.range_low_per_m2,
            high_per_m2=result.range_high_per_m2,
        ),
        reliability=result.reliability,
        model="dvf",
        predicted_price=result.estimated_price,
        confidence_interval={
            "lower": result.range_low,
            "upper": result.range_high,
            "confidence": "85%",
        },
        meta=EstimationMeta(
            scope=outcome.scope,
            scope_value=outcome.scope_value,
            property_type_used=outcome.type_used,
            surface_tolerance=outcome.surface_tolerance,
            rooms_tolerance=outcome.rooms_tolerance,
            fallback_level=outcome.fallback_level,
            n_transactions=result.n_transactions,
            dispersion=result.dispersion,
            notes=outcome.notes,
        ),
    )
    # Statistiques du secteur, retrouvé par le nom de la commune
    response.secteur = getattr(request.app.state, "secteurs_par_nom", {}).get(
        (commune_norm, _type_secteur(type_bien)))
    # Enrichissement DPE
    if req.dpe_classe:
        response.dpe_classe = req.dpe_classe
    if req.annee_construction:
        response.annee_construction = req.annee_construction
    dpe_zone = getattr(request.app.state, "dpe_zone", {})
    if req.postal_code and req.postal_code in dpe_zone:
        response.dpe_zone_fg_pct = round(float(dpe_zone[req.postal_code]) * 100, 1)

    _inscrire_historique(request, req, surface, response, query=commune_norm)

    return response


# ==========================================================================
#  ENDPOINTS MARCHÉ
# ==========================================================================

_SAMPLES_DIR = next(
    (p for p in [BASE_DIR / "data" / "samples", BASE_DIR.parent / "data" / "samples"] if p.is_dir()),
    BASE_DIR / "data" / "samples",
)
_COMMUNE_STATS_PATH = _SAMPLES_DIR / "commune_stats.json"
_MARKET_TRENDS_PATH = _SAMPLES_DIR / "market_trends.json"
_INDICES_INSEE_PATH = _SAMPLES_DIR / "indices_prix_insee.json"
_LOYERS_ANIL_PATH = _SAMPLES_DIR / "loyers_anil.json"


@lru_cache(maxsize=None)
def _reference_json(path: Path) -> dict:
    """Références hors DVF (indices INSEE, loyers ANIL), générées par
    `make references` ; vide si le fichier manque, l'interface s'en passe."""
    try:
        return json.loads(path.read_text())
    except (OSError, ValueError):
        return {}


def _filtres_marche(type_bien: str, marche: str) -> tuple[str, str]:
    typ = "house" if type_bien == "house" else "apartment"
    seg = marche if marche in SEGMENTS_MARCHE else "tous"
    return typ, seg


@app.get(f"{API_PREFIX}/market/map", tags=["marché"])
def market_map(
    request: Request,
    type_bien: str = Query(default="apartment", description="apartment | house"),
    marche: str = Query(default="tous", description="tous | ancien | neuf (VEFA)"),
):
    """Prix au m² par commune pour la carte, séparés par type de bien et par marché
    (calculés sur le dataset chargé ; fichier statique en repli)."""
    calcule = getattr(request.app.state, "marche", {}) or {}
    if calcule.get("carte"):
        return calcule["carte"].get(_filtres_marche(type_bien, marche), [])
    if not _COMMUNE_STATS_PATH.exists():
        raise HTTPException(503, "Données cartographiques non disponibles.")
    return json.loads(_COMMUNE_STATS_PATH.read_text())


@app.get(f"{API_PREFIX}/market/secteurs", tags=["marché"])
def market_secteurs(
    request: Request,
    property_type: str = Query(default="apartment", description="apartment | house"),
    min_ventes: int = Query(default=200, ge=1, description="Nombre minimal de ventes du secteur"),
):
    """Secteurs (communes et arrondissements) classés par prix au m² médian,
    calculés sur le dataset chargé — alimente la grille « Le marché par secteur »."""
    typ = _type_secteur(property_type)
    secteurs = [s for (_, t), s in getattr(request.app.state, "secteurs", {}).items()
                if t == typ and s["n"] >= min_ventes]
    if not secteurs:
        raise HTTPException(503, "Statistiques de secteur non disponibles.")
    loyers = _reference_json(_LOYERS_ANIL_PATH).get("communes", {})
    return sorted(({**s, "loyer": loyers.get(s["code"], {}).get(typ)} for s in secteurs), key=lambda s: -s["med"])


@app.get(f"{API_PREFIX}/market/indices", tags=["marché"])
def market_indices(
    dep: str = Query(..., description="Code département (75, 92…)"),
    property_type: str = Query(default="apartment", description="apartment | house"),
):
    """Indice Notaires-INSEE trimestriel des prix de l'ancien du département,
    depuis 1992 ou 1996. Paris n'a pas d'indice « maisons » : on renvoie
    celui des appartements, signalé par `type_reel`."""
    ref = _reference_json(_INDICES_INSEE_PATH)
    series = ref.get("series", {}).get(dep)
    if not series:
        raise HTTPException(404 if ref else 503, "Indice de prix non disponible pour ce département.")
    typ = _type_secteur(property_type)
    reel = typ if typ in series else next(iter(series))
    return {**series[reel], "dep": dep, "type_reel": reel, "source": ref.get("source")}


@app.get(f"{API_PREFIX}/market/trends", tags=["marché"])
def market_trends(
    request: Request,
    dep: str | None = Query(default=None, description="Code département (75, 92…)"),
    type_bien: str = Query(default="apartment", description="apartment | house"),
    marche: str = Query(default="tous", description="tous | ancien | neuf (VEFA)"),
):
    """Médiane mensuelle du prix au m² par département, séparée par type de bien et
    par marché (calculée sur le dataset chargé ; fichier statique en repli)."""
    calcule = getattr(request.app.state, "marche", {}) or {}
    if calcule.get("tendances"):
        data = calcule["tendances"].get(_filtres_marche(type_bien, marche), [])
        return [row for row in data if row["code_departement"] == dep] if dep else data
    if not _MARKET_TRENDS_PATH.exists():
        raise HTTPException(503, "Données de tendances non disponibles.")
    data = json.loads(_MARKET_TRENDS_PATH.read_text())
    if dep:
        data = [row for row in data if str(row.get("code_departement")) == dep]
    return data


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)