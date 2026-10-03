"""Inférence — utilisé par le backend FastAPI."""

from pathlib import Path
import json
import joblib
import pandas as pd


_MODEL = None
_Q075 = None
_Q925 = None
_CATEGORIES = None
_TRANSFORM = None       # "log" si le modèle apprend log(prix_m2) (model_info.json)
_CALIBRATION = {}       # corrections conformes de la fourchette par classe (calibration.json)
_LOCAL = {}             # MAPE et classe de fiabilité par commune (local_mape.json)


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
    global _MODEL, _Q075, _Q925, _CATEGORIES, _TRANSFORM, _CALIBRATION, _LOCAL
    if _MODEL is None:
        path = _trouver_modele(chemin)
        _MODEL = joblib.load(path)
        lire = lambda nom: json.loads((path.parent / nom).read_text()) if (path.parent / nom).exists() else {}
        _CATEGORIES = lire("categories.json")
        _TRANSFORM = lire("model_info.json").get("target_transform")
        _CALIBRATION = lire("calibration.json").get("corrections_par_classe", {})
        _LOCAL = lire("local_mape.json")
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
    zone_part_dpe_fg: float | None = None,
    dpe_classe: str | None = None,
    annee_construction: int | None = None,
    contexte: dict | None = None,
) -> dict:
    """`contexte` : features d'immeuble, IRIS, BDNB et DPE calculées par
    ml/contexte.py. Toute feature absente est transmise vide au modèle."""
    import numpy as np
    model = charger_modele(model_path)

    surface_moyenne_piece = surface_m2 / nb_pieces if nb_pieces else None
    arrondissement = _arrondissement_de(code_commune)

    _DPE_ORDINAL = {"A": 0, "B": 1, "C": 2, "D": 3, "E": 4, "F": 5, "G": 6}

    # Features engineerées — même calcul que features.py à l'entraînement
    log_surface = np.log1p(surface_m2)
    ratio_local_dept = (
        (prix_m2_median_local_12m / prix_m2_median_dept_12m)
        if prix_m2_median_local_12m is not None and prix_m2_median_dept_12m
        else np.nan
    )
    densite_ventes = (
        (nb_ventes_commune_12m / nb_ventes_dept_12m)
        if nb_ventes_dept_12m
        else np.nan
    )
    dpe_score = _DPE_ORDINAL.get(dpe_classe, np.nan) if dpe_classe else np.nan
    is_studio = surface_m2 < 35
    densite_pieces = nb_pieces / surface_m2 if surface_m2 else np.nan

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
        "log_surface": log_surface,
        "ratio_local_dept": ratio_local_dept,
        "densite_ventes": densite_ventes,
        "zone_part_dpe_fg": float(zone_part_dpe_fg) if zone_part_dpe_fg is not None else np.nan,
        "annee_construction": float(annee_construction) if annee_construction is not None else np.nan,
        "dpe_score": float(dpe_score) if not (isinstance(dpe_score, float) and np.isnan(dpe_score)) else np.nan,
        "dpe_classe": str(dpe_classe) if dpe_classe is not None else None,
        "code_type_local": str(code_type_local),
        "code_departement": str(code_departement),
        "code_commune": str(code_commune) if code_commune else "",
        "a_terrain": a_terrain,
        "is_studio": is_studio,
        "densite_pieces": densite_pieces,
        **{k: v for k, v in (contexte or {}).items() if not isinstance(v, (list, dict))},
    }])
    # Mêmes colonnes, dans le même ordre, qu'à l'entraînement
    colonnes = getattr(model, "feature_name_", None)
    if colonnes:
        X = X.reindex(columns=colonnes)
        for col in X.columns:
            if col in _CATEGORIES:
                X[col] = pd.Categorical(X[col].astype(object), categories=_CATEGORIES[col])
            elif X[col].dtype == object:
                X[col] = pd.to_numeric(X[col], errors="coerce")
    # Appliquer le dtype Categorical après construction (pandas ne le préserve pas via dict)
    for col, cats in _CATEGORIES.items():
        if col in X.columns:
            X[col] = pd.Categorical(X[col], categories=cats)

    inv = np.exp if _TRANSFORM == "log" else (lambda v: v)
    prix_m2_pred = float(inv(model.predict(X)[0]))
    prix_total = prix_m2_pred * surface_m2
    classe = _LOCAL.get(code_commune or "", {}).get("classe", "donnees_insuffisantes")

    # Fourchette via modèles quantile (85 % : q7.5 – q92.5), corrigée par la
    # calibration conforme de la classe de la commune quand elle existe.
    if _Q075 is not None and _Q925 is not None:
        bas, haut = sorted([float(_Q075.predict(X)[0]), float(_Q925.predict(X)[0])])
        if _TRANSFORM == "log":
            d = _CALIBRATION.get(classe, _CALIBRATION.get("donnees_insuffisantes", 0.0))
            bas, haut = np.exp(bas - d), np.exp(haut + d)
        ci_low, ci_high = bas * surface_m2, haut * surface_m2
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
            "lower": round(float(ci_low), 2),
            "upper": round(float(ci_high), 2),
            "confidence": "85%",
        },
        "reliability": reliability,
        "model": "lgbm",
        "code_commune": code_commune,
        "classe_fiabilite": classe,
    }
