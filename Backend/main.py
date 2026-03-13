import os
from pathlib import Path
from typing import Optional

import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import uvicorn

try:
    from Backend.utils.address_parser import parse_address
    from Backend.utils.dvf_search import find_similar_properties, SearchConfig
    from Backend.utils.price_calculation import calculate_price
except ImportError:
    from utils.address_parser import parse_address
    from utils.dvf_search import find_similar_properties, SearchConfig
    from utils.price_calculation import calculate_price

app = FastAPI(title="RealEstateAI Backend")

# CORS pour frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BACKEND_DIR = Path(__file__).resolve().parent
DVF_OUTPUTS_DIR = BACKEND_DIR / "Data pipeline" / "outputs"
DEFAULT_DVF_CLEAN_PATH = DVF_OUTPUTS_DIR / "DVF_clean.csv"

DVF_DF: Optional[pd.DataFrame] = None
DVF_ERROR: Optional[str] = None
DVF_FILE_USED: Optional[str] = None


def _resolve_dvf_path() -> Optional[Path]:
    env_path = os.getenv("DVF_CLEAN_PATH")
    if env_path:
        candidate = Path(env_path)
        if not candidate.is_absolute():
            candidate = BACKEND_DIR / env_path
        if candidate.exists():
            return candidate

    if DEFAULT_DVF_CLEAN_PATH.exists():
        return DEFAULT_DVF_CLEAN_PATH

    candidates = sorted(
        DVF_OUTPUTS_DIR.glob("DVF_clean_*.csv"),
        key=lambda p: p.stat().st_mtime,
        reverse=True,
    )
    if candidates:
        return candidates[0]

    return None


def _load_dvf(path: str) -> pd.DataFrame:
    df = pd.read_csv(path)

    rename_map = {
        "Commune": "commune",
        "Surface reelle bati": "surface_m2",
        "Valeur fonciere": "prix_vente",
    }

    for src, dst in rename_map.items():
        if src in df.columns:
            df = df.rename(columns={src: dst})

    required = ["commune", "type_bien", "surface_m2", "prix_vente", "prix_au_m2"]

    missing = [c for c in required if c not in df.columns]

    if missing:
        raise ValueError(f"Colonnes manquantes: {missing}")

    df["commune_norm"] = df["commune"].str.lower().str.strip()
    df["type_bien_norm"] = df["type_bien"].str.lower().str.strip()

    return df


def _fallback_search(
    df: pd.DataFrame,
    commune: str,
    type_bien: str,
    surface_m2: float,
) -> pd.DataFrame:
    commune_q = (commune or "").strip().lower()
    if not commune_q:
        return df.iloc[0:0]

    # 1) Exact commune
    base = df[df["commune_norm"] == commune_q]

    # 2) Prefixe (utile pour Paris -> Paris 01..20)
    if base.empty:
        base = df[df["commune_norm"].str.startswith(f"{commune_q} ", na=False)]

    # 3) Contient (fallback plus large, si requête assez longue)
    if base.empty and len(commune_q) >= 4:
        base = df[df["commune_norm"].str.contains(commune_q, na=False)]

    if base.empty:
        return base

    # Fallback type_bien : studio n'existe pas dans DVF nettoyé, on mappe vers apartment
    type_candidates = [type_bien]
    if type_bien == "studio":
        type_candidates.append("apartment")

    typed = base.iloc[0:0]
    for t in type_candidates:
        candidate = base[base["type_bien_norm"] == t]
        if not candidate.empty:
            typed = candidate
            break

    if typed.empty:
        return typed

    # Tolérance surface progressive
    for tol in (0.20, 0.35, 0.50):
        s_min = surface_m2 * (1 - tol)
        s_max = surface_m2 * (1 + tol)
        by_surface = typed[(typed["surface_m2"] >= s_min) & (typed["surface_m2"] <= s_max)]
        if not by_surface.empty:
            return by_surface

    return typed


@app.on_event("startup")
def startup_event():
    global DVF_DF, DVF_ERROR, DVF_FILE_USED

    dvf_path = _resolve_dvf_path()
    if dvf_path is None:
        DVF_ERROR = "DVF file not found"
        DVF_DF = None
        DVF_FILE_USED = None
        return

    try:
        DVF_DF = _load_dvf(str(dvf_path))
        DVF_ERROR = None
        DVF_FILE_USED = str(dvf_path)
    except Exception as e:
        DVF_ERROR = str(e)
        DVF_DF = None
        DVF_FILE_USED = None


@app.get("/api/health")
def health():
    return {
        "status": "healthy" if DVF_DF is not None else "not_ready",
        "dvf_loaded": DVF_DF is not None,
        "dvf_file": DVF_FILE_USED,
        "error": DVF_ERROR,
    }


@app.get("/api/metadata/communes")
def communes():
    if DVF_DF is None:
        return {"communes": [], "count": 0, "error": DVF_ERROR}

    items = (
        DVF_DF["commune"]
        .dropna()
        .astype(str)
        .str.strip()
    )
    unique_sorted = sorted(set(c for c in items if c))
    return {"communes": unique_sorted, "count": len(unique_sorted), "error": None}


class EstimationRequest(BaseModel):
    area_m2: float = Field(..., gt=5)
    rooms: int = 0
    location_lat: Optional[float] = None
    location_lng: Optional[float] = None
    property_type: str = "apartment"
    address: Optional[str] = None
    commune: Optional[str] = None


def mock_estimate(surface, property_type):

    base_price_per_m2 = 7000

    multiplier = {
        "studio": 1.2,
        "apartment": 1.0,
        "house": 0.9,
    }.get(property_type, 1.0)

    price = surface * base_price_per_m2 * multiplier
    margin = price * 0.15

    return {
        "predicted_price": round(price, 2),
        "price_per_m2": round(price / surface, 2),
        "confidence_interval": {
            "lower": round(price - margin, 2),
            "upper": round(price + margin, 2),
            "confidence": "85%",
        },
        "model": "mock",
    }


@app.post("/api/predictions/estimate")
def estimate(req: EstimationRequest):

    surface = req.area_m2
    type_bien = req.property_type.lower()

    if DVF_DF is None:
        return mock_estimate(surface, type_bien)

    commune_value = req.commune
    if not commune_value and req.address:
        parsed = parse_address(req.address)
        commune_value = parsed.get("commune")

    if not commune_value:
        raise HTTPException(400, "commune requise pour DVF")

    commune = commune_value.lower()

    tx = find_similar_properties(
        DVF_DF,
        commune,
        type_bien,
        surface,
        SearchConfig(),
    )

    if tx.empty:
        tx = _fallback_search(DVF_DF, commune, type_bien, surface)

    if tx.empty:
        raise HTTPException(404, "aucune transaction trouvée")

    res = calculate_price(tx, surface)

    return {
        "predicted_price": res.estimated_price,
        "price_per_m2": res.price_per_m2,
        "confidence_interval": {
            "lower": res.low,
            "upper": res.high,
            "confidence": int(res.confidence * 100),
        },
        "model": "dvf",
    }


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
