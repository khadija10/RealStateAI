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
from pathlib import Path
from typing import Any, Literal

import pandas as pd
import uvicorn
from fastapi import Depends, FastAPI, HTTPException, Query, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field, model_validator

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
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:4173",
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
    area_m2: float = Field(..., gt=5, le=2000, description="Surface habitable en m²")
    property_type: PropertyType = "apartment"
    rooms: int | None = Field(default=None, ge=0, le=30)
    commune: str | None = None
    address: str | None = None
    postal_code: str | None = None
    location_lat: float | None = Field(default=None, ge=-90, le=90)
    location_lng: float | None = Field(default=None, ge=-180, le=180)

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


class HealthResponse(BaseModel):
    status: Literal["healthy", "degraded"]
    dvf_loaded: bool
    dvf_path: str | None = None
    n_rows: int = 0
    n_communes: int = 0
    error: str | None = None
    model_loaded: bool = False
    model_error: str | None = None


# ==========================================================================
#  APPLICATION
# ==========================================================================


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

    path = resolve_dvf_path()
    if path is None:
        app.state.dvf_error = (
            f"Aucun dataset DVF trouvé dans {DVF_GOLD_DIR} ou {DVF_OUTPUTS_DIR}. "
            "Lancez d'abord le pipeline de données."
        )
        logger.warning(app.state.dvf_error)
    else:
        try:
            app.state.dvf = load_dvf(path)
            app.state.dvf_path = str(path)
            app.state.communes = commune_display_names(app.state.dvf)
        except Exception as exc:  # noqa: BLE001 — on veut démarrer malgré tout
            app.state.dvf_error = f"{type(exc).__name__} : {exc}"
            logger.exception("Échec du chargement du dataset DVF")

    yield
    app.state.dvf = None


app = FastAPI(
    title="RealEstateAI Backend",
    description="Estimation de prix immobiliers à partir des données DVF (Île-de-France).",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


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
                notes=["estimation fournie par le modèle ML"],
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
    return HealthResponse(
        status="healthy" if loaded else "degraded",
        dvf_loaded=loaded,
        dvf_path=request.app.state.dvf_path,
        n_rows=int(len(df)) if loaded else 0,
        n_communes=len(request.app.state.communes),
        error=request.app.state.dvf_error,
        model_loaded=ML_ESTIMATOR is not None,
        model_error=ML_ERROR,
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
)
def estimate(
    req: EstimationRequest,
    df: pd.DataFrame | None = Depends(get_dvf),
) -> EstimationResponse:
    surface = req.area_m2

    if ML_ESTIMATOR is not None and (req.address or req.commune or req.postal_code):
        try:
            payload: dict[str, Any] = {
                "adresse": req.address,
                "code_postal": req.postal_code,
                "surface_m2": surface,
                "nb_pieces": float(req.rooms) if req.rooms is not None else 3.0,
                "type_bien": req.property_type,
            }
            if req.commune and not req.address:
                payload["adresse"] = req.commune
            ml_result = ML_ESTIMATOR(**{k: v for k, v in payload.items() if v is not None})
            if ml_result is not None:
                logger.info("Réponse renvoyée par le modèle ML")
                return _normalize_ml_result(ml_result, surface)
        except Exception as exc:  # pragma: no cover - dépend du module ML réel
            logger.warning("Erreur modèle ML, fallback vers DVF : %s", exc)

    if df is None:
        if not ALLOW_MOCK_FALLBACK:
            raise HTTPException(503, "Le service d'estimation est momentanément indisponible.")
        logger.warning("Dataset indisponible : réponse mock renvoyée")
        return _mock_estimate(surface, req.property_type)

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

    outcome = search_comparables(
        df=df,
        commune_norm=commune_norm,
        type_bien=req.property_type,
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

    return EstimationResponse(
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


# ==========================================================================
#  ENDPOINTS MARCHÉ
# ==========================================================================

_SAMPLES_DIR = next(
    (p for p in [BASE_DIR / "data" / "samples", BASE_DIR.parent / "data" / "samples"] if p.is_dir()),
    BASE_DIR / "data" / "samples",
)
_COMMUNE_STATS_PATH = _SAMPLES_DIR / "commune_stats.json"
_MARKET_TRENDS_PATH = _SAMPLES_DIR / "market_trends.json"


@app.get(f"{API_PREFIX}/market/map", tags=["marché"])
def market_map():
    """Statistiques prix/m² par commune pour la carte interactive."""
    if not _COMMUNE_STATS_PATH.exists():
        raise HTTPException(503, "Données cartographiques non disponibles.")
    return json.loads(_COMMUNE_STATS_PATH.read_text())


@app.get(f"{API_PREFIX}/market/trends", tags=["marché"])
def market_trends(dep: str | None = Query(default=None, description="Code département (75, 92…)")):
    """Tendances mensuelles du prix/m² par département."""
    if not _MARKET_TRENDS_PATH.exists():
        raise HTTPException(503, "Données de tendances non disponibles.")
    data = json.loads(_MARKET_TRENDS_PATH.read_text())
    if dep:
        data = [row for row in data if str(row.get("code_departement")) == dep]
    return data


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)