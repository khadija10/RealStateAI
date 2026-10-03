"""Largeur des fourchettes affichées par l'application, mesurée sur les ventes
de la période de validation (juil.–sept. 2025), pour le backend.

Sert à qualifier la précision d'une estimation par rapport aux autres : les
tiers (terciles) de la demi-largeur de fourchette départagent « resserrée »,
« habituelle » et « large ». Les seuils viennent donc des données, pas d'un choix.

Aucune mesure d'erreur : la largeur d'une fourchette ne dépend pas du prix de
vente réel. Le test officiel (oct.–déc. 2025) n'est pas utilisé.

Fourchette reproduite à l'identique de la production : modèles quantiles
q7,5 / q92,5 (Backend/models), calibration conforme de la classe de la commune
(calibration.json, local_mape.json), largeur minimale de ±3 % (ml/predict.py),
et fourchette élargie à ±20 % sous 30 m² (Backend/main.py).

    python ml/exporter_largeurs.py
"""
import json
import sys
from datetime import datetime
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

RACINE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RACINE / "ml"))

from evaluer_protocole import _charger_gold_brut  # noqa: E402
from features import _filtrer_outliers, charger_config, preparer_features  # noqa: E402

MODELES = RACINE / "Backend" / "models"
SORTIE = MODELES / "largeurs_fourchette.json"
PERIODE = ("2025-07", "2025-09")   # validation du protocole (docs/protocole_evaluation.md)


def mesurer(config_path: str = "ml/config.yaml") -> dict:
    config = charger_config(config_path)
    df = _filtrer_outliers(_charger_gold_brut(config))
    debut, fin = pd.Period(PERIODE[0], "M"), pd.Period(PERIODE[1], "M")
    df = df[(df["periode"] >= debut) & (df["periode"] <= fin)]

    categories = json.loads((MODELES / "categories.json").read_text())
    cat_dtypes = {c: pd.CategoricalDtype(categories=v) for c, v in categories.items()}
    X, _ = preparer_features(df, config, cat_dtypes)

    modele = joblib.load(MODELES / "price_model.pkl")
    q_bas, q_haut = joblib.load(MODELES / "lgb_q075.pkl"), joblib.load(MODELES / "lgb_q925.pkl")
    X = X.reindex(columns=modele.feature_name_)
    pred = np.exp(modele.predict(X))
    bas = np.minimum(q_bas.predict(X), q_haut.predict(X))
    haut = np.maximum(q_bas.predict(X), q_haut.predict(X))

    corrections = json.loads((MODELES / "calibration.json").read_text())["corrections_par_classe"]
    local = json.loads((MODELES / "local_mape.json").read_text())
    classes = df["code_commune"].astype(str).map(lambda c: local.get(c, {}).get("classe", "donnees_insuffisantes"))
    d = classes.map(lambda c: corrections.get(c, corrections.get("donnees_insuffisantes", 0.0))).values
    bas, haut = np.exp(bas - d), np.exp(haut + d)

    bas, haut = np.minimum(bas, pred * 0.97), np.maximum(haut, pred * 1.03)
    petite = df["surface_bati"].values < 30
    bas = np.where(petite, np.minimum(bas, pred * 0.80), bas)
    haut = np.where(petite, np.maximum(haut, pred * 1.20), haut)

    demi = (haut - bas) / 2 / pred * 100
    t1, t2 = np.percentile(demi, [100 / 3, 200 / 3])
    return {
        "source": "ml/exporter_largeurs.py",
        "mesure_le": datetime.now().strftime("%Y-%m-%dT%H:%M:%S"),
        "periode": list(PERIODE),
        "n": int(len(demi)),
        "demi_largeur_pct": {
            "tiers_1": round(float(t1), 1),
            "mediane": round(float(np.median(demi)), 1),
            "tiers_2": round(float(t2), 1),
        },
    }


if __name__ == "__main__":
    resultat = mesurer()
    SORTIE.write_text(json.dumps(resultat, ensure_ascii=False, indent=2))
    print(json.dumps(resultat, ensure_ascii=False, indent=1))
