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
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Literal

import pandas as pd
import uvicorn
from fastapi import Depends, FastAPI, HTTPException, Query, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, model_validator

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

    Le pipeline produit `DVF_clean_2025.parquet` ou `DVF_clean_2024_2025.parquet`
    selon les années traitées : on prend le plus récent plutôt que d'exiger un
    nom figé (c'est ce décalage de nom qui empêchait l'API de charger le DVF).
    """
    if DVF_CLEAN_PATH:
        candidate = Path(DVF_CLEAN_PATH)
        return candidate if candidate.exists() else None

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
    estimated_price: float
    price_per_m2: float
    price_range: PriceRange
    reliability: float = Field(..., ge=0, le=1)
    model: Literal["dvf", "mock"]
    meta: EstimationMeta | None = None


class HealthResponse(BaseModel):
    status: Literal["healthy", "degraded"]
    dvf_loaded: bool
    dvf_path: str | None = None
    n_rows: int = 0
    n_communes: int = 0
    error: str | None = None


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
            f"Aucun dataset DVF trouvé dans {DVF_OUTPUTS_DIR}. "
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


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)