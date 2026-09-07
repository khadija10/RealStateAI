"""Inférence — utilisé par le backend FastAPI."""

from pathlib import Path
import json
import joblib
import pandas as pd


_MODEL = None
_CATEGORIES = None


def _trouver_modele(defaut: str = "Backend/models/price_model.pkl") -> Path:
    candidates = [
        Path(defaut),                                                       # local dev (CWD = racine projet)
        Path(__file__).parent.parent / "Backend" / "models" / "price_model.pkl",  # local (ml/../Backend/models/)
        Path(__file__).parent.parent / "models" / "price_model.pkl",       # Docker (/app/models/)
    ]
    for p in candidates:
        if p.exists():
            return p
    return Path(defaut)


def charger_modele(chemin: str = "Backend/models/price_model.pkl"):
    global _MODEL, _CATEGORIES
    if _MODEL is None:
        path = _trouver_modele(chemin)
        _MODEL = joblib.load(path)
        cat_path = path.parent / "categories.json"
        _CATEGORIES = json.loads(cat_path.read_text()) if cat_path.exists() else {}
    return _MODEL


def predire(
    surface_m2: float,
    nb_pieces: float,
    code_type_local: str,
    code_departement: str,
    latitude: float,
    longitude: float,
    prix_m2_reference_12m: float,
    nb_ventes_commune_12m: float,
    prix_m2_median_dept_12m: float,
    nb_ventes_dept_12m: float,
    mois_index: int,
    mois: int,
    trimestre: int,
    a_terrain: bool = False,
    model_path: str = "Backend/models/price_model.pkl",
) -> dict:
    model = charger_modele(model_path)  # _trouver_modele() résout le bon chemin

    surface_moyenne_piece = surface_m2 / nb_pieces if nb_pieces else None

    X = pd.DataFrame([{
        "surface_bati": surface_m2,
        "nb_pieces": nb_pieces,
        "surface_moyenne_piece": surface_moyenne_piece,
        "prix_m2_reference_12m": prix_m2_reference_12m,
        "nb_ventes_commune_12m": nb_ventes_commune_12m,
        "prix_m2_median_dept_12m": prix_m2_median_dept_12m,
        "nb_ventes_dept_12m": nb_ventes_dept_12m,
        "latitude": latitude,
        "longitude": longitude,
        "mois_index": mois_index,
        "mois": mois,
        "trimestre": trimestre,
        "code_type_local": str(code_type_local),
        "code_departement": str(code_departement),
        "a_terrain": a_terrain,
    }])
    # Appliquer le dtype Categorical après construction (pandas ne le préserve pas via dict)
    for col, cats in _CATEGORIES.items():
        if col in X.columns:
            X[col] = pd.Categorical(X[col], categories=cats)

    prix_m2_pred = float(model.predict(X)[0])
    prix_total = prix_m2_pred * surface_m2

    # Fourchette ±15% (intervalle de confiance empirique)
    marge = 0.15
    return {
        "predicted_price": round(prix_total, 2),
        "price_per_m2": round(prix_m2_pred, 2),
        "confidence_interval": {
            "lower": round(prix_total * (1 - marge), 2),
            "upper": round(prix_total * (1 + marge), 2),
            "confidence": "85%",
        },
        "model": "lgbm",
    }
