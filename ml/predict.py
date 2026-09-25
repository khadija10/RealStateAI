"""Inférence — utilisé par le backend FastAPI."""

from pathlib import Path
import json
import joblib
import pandas as pd


_MODEL = None
_Q075 = None
_Q925 = None
_CATEGORIES = None


def _trouver_modele(defaut: str = "Backend/models/price_model.pkl") -> Path:
    candidates = [
        Path(defaut),
        Path(__file__).parent.parent / "Backend" / "models" / "price_model.pkl",
        Path(__file__).parent.parent / "models" / "price_model.pkl",
    ]
    for p in candidates:
        if p.exists():
            return p
    return Path(defaut)


def charger_modele(chemin: str = "Backend/models/price_model.pkl"):
    global _MODEL, _Q075, _Q925, _CATEGORIES
    if _MODEL is None:
        path = _trouver_modele(chemin)
        _MODEL = joblib.load(path)
        cat_path = path.parent / "categories.json"
        _CATEGORIES = json.loads(cat_path.read_text()) if cat_path.exists() else {}
        q075_path = path.parent / "lgb_q075.pkl"
        q925_path = path.parent / "lgb_q925.pkl"
        if q075_path.exists():
            _Q075 = joblib.load(q075_path)
        if q925_path.exists():
            _Q925 = joblib.load(q925_path)
    return _MODEL


def _arrondissement_de(code_commune: str | None):
    """Extrait le numéro d'arrondissement pour Paris (75101-75120)."""
    if not code_commune:
        return None
    if "75101" <= code_commune <= "75120":
        return int(code_commune[3:])
    if "69381" <= code_commune <= "69389":
        return int(code_commune[3:]) - 80
    if "13201" <= code_commune <= "13216":
        return int(code_commune[3:])
    return None


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
    code_commune: str | None = None,
    surface_terrain: float | None = None,
    prix_m2_median_local_12m: float | None = None,
) -> dict:
    import numpy as np
    model = charger_modele(model_path)

    surface_moyenne_piece = surface_m2 / nb_pieces if nb_pieces else None
    arrondissement = _arrondissement_de(code_commune)

    X = pd.DataFrame([{
        "surface_bati": surface_m2,
        "nb_pieces": nb_pieces,
        "surface_moyenne_piece": surface_moyenne_piece,
        "prix_m2_reference_12m": prix_m2_reference_12m,
        "nb_ventes_commune_12m": nb_ventes_commune_12m,
        "prix_m2_median_dept_12m": prix_m2_median_dept_12m,
        "nb_ventes_dept_12m": nb_ventes_dept_12m,
        "prix_m2_median_local_12m": prix_m2_median_local_12m if prix_m2_median_local_12m is not None else np.nan,
        "latitude": latitude,
        "longitude": longitude,
        "mois_index": mois_index,
        "mois": mois,
        "trimestre": trimestre,
        "arrondissement": float(arrondissement) if arrondissement is not None else np.nan,
        "surface_terrain": float(surface_terrain) if surface_terrain is not None else np.nan,
        "code_type_local": str(code_type_local),
        "code_departement": str(code_departement),
        "code_commune": str(code_commune) if code_commune else "",
        "a_terrain": a_terrain,
    }])
    # Appliquer le dtype Categorical après construction (pandas ne le préserve pas via dict)
    for col, cats in _CATEGORIES.items():
        if col in X.columns:
            X[col] = pd.Categorical(X[col], categories=cats)

    prix_m2_pred = float(model.predict(X)[0])
    prix_total = prix_m2_pred * surface_m2

    # Fourchette via modèles quantile (85 % CI : q7.5 – q92.5)
    if _Q075 is not None and _Q925 is not None:
        ci_low = float(_Q075.predict(X)[0]) * surface_m2
        ci_high = float(_Q925.predict(X)[0]) * surface_m2
        if ci_low > ci_high:
            ci_low, ci_high = ci_high, ci_low
        ci_low = min(ci_low, prix_total * 0.97)
        ci_high = max(ci_high, prix_total * 1.03)
        # Reliability basée sur la largeur relative de la fourchette
        range_width = (ci_high - ci_low) / prix_total if prix_total > 0 else 0.5
        reliability = round(max(0.30, min(0.95, 1.0 - range_width / 2)), 2)
    else:
        ci_low = prix_total * 0.85
        ci_high = prix_total * 1.15
        reliability = 0.70

    return {
        "predicted_price": round(prix_total, 2),
        "price_per_m2": round(prix_m2_pred, 2),
        "confidence_interval": {
            "lower": round(ci_low, 2),
            "upper": round(ci_high, 2),
            "confidence": "85%",
        },
        "reliability": reliability,
        "model": "lgbm",
        "code_commune": code_commune,
    }
