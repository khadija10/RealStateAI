import os
from typing import Optional

import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import uvicorn

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

DVF_CLEAN_PATH = r"Backend\Data pipeline\outputs\DVF_clean.csv"

DVF_DF: Optional[pd.DataFrame] = None
DVF_ERROR: Optional[str] = None


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


@app.on_event("startup")
def startup_event():
    global DVF_DF, DVF_ERROR

    if not os.path.exists(DVF_CLEAN_PATH):
        DVF_ERROR = "DVF file not found"
        DVF_DF = None
        return

    try:
        DVF_DF = _load_dvf(DVF_CLEAN_PATH)
    except Exception as e:
        DVF_ERROR = str(e)
        DVF_DF = None


@app.get("/api/health")
def health():
    return {
        "status": "healthy" if DVF_DF is not None else "not_ready",
        "dvf_loaded": DVF_DF is not None,
        "error": DVF_ERROR,
    }


class EstimationRequest(BaseModel):
    area_m2: float = Field(..., gt=5)
    rooms: int = 0
    location_lat: Optional[float] = None
    location_lng: Optional[float] = None
    property_type: str = "apartment"
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

    if not req.commune:
        raise HTTPException(400, "commune requise pour DVF")

    commune = req.commune.lower()

    tx = find_similar_properties(
        DVF_DF,
        commune,
        type_bien,
        surface,
        SearchConfig(),
    )

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