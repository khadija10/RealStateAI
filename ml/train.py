"""Entraînement du modèle de production, avec tracking MLflow.

Deux temps, pour ne jamais régler le modèle sur des ventes qu'il a apprises :
  1. réglage : entraînement sur tout sauf les 3 derniers mois, arrêt anticipé
     sur ces 3 mois ; ils servent aussi à calibrer la fourchette et à classer
     les communes (cf. docs/protocole_evaluation.md) ;
  2. production : réentraînement sur TOUTES les ventes avec le nombre d'arbres
     retenu, pour que le modèle connaisse le marché le plus récent.

Les métriques affichées sont celles des 3 mois de réglage. Elles ont servi à
l'arrêt anticipé : la mesure de référence reste celle du protocole
(docs/resultats_protocole_*.md), faite sur un test jamais vu.
"""

import json
import time
from datetime import datetime
from pathlib import Path

import joblib
import lightgbm as lgb
import mlflow
import mlflow.lightgbm
import numpy as np
import pandas as pd

from features import charger_config, charger_gold, preparer_features, construire_cat_dtypes
from evaluate import calculer_metriques, afficher_rapport

MOIS_REGLAGE = 3
# Classement des communes et couverture visée : mêmes valeurs que le protocole.
CLASSE_FIABLE_MAX = 10.0
CLASSE_INDICATIVE_MAX = 20.0
MIN_VENTES_COMMUNE = 30
COUVERTURE_VISEE = 0.85
QUANTILES = (0.075, 0.925)


def _classe(mape: float, n: int) -> str:
    if n < MIN_VENTES_COMMUNE:
        return "donnees_insuffisantes"
    if mape <= CLASSE_FIABLE_MAX:
        return "fiable"
    if mape <= CLASSE_INDICATIVE_MAX:
        return "indicative"
    return "a_completer"


def _transformations(config: dict):
    if config.get("target_transform") == "log":
        return np.log, np.exp
    return (lambda v: v), (lambda v: v)


def _poids(df: pd.DataFrame, config: dict) -> np.ndarray | None:
    sw_cfg = config.get("sample_weights", {})
    if not sw_cfg:
        return None
    return df["annee"].map({int(k): v for k, v in sw_cfg.items()}).fillna(1.0).values


def _calibrer(y: np.ndarray, bas: np.ndarray, haut: np.ndarray, classes: np.ndarray) -> dict:
    """Correction conforme (CQR) par classe, en échelle log : élargit ou
    resserre la fourchette brute pour qu'elle contienne le prix réel dans
    COUVERTURE_VISEE des cas, classe par classe."""
    score = np.maximum(bas - np.log(y), np.log(y) - haut)
    corrections = {}
    for c in np.unique(classes):
        s = np.sort(score[classes == c])
        k = min(int(np.ceil((len(s) + 1) * COUVERTURE_VISEE)) - 1, len(s) - 1)
        corrections[str(c)] = round(float(s[k]), 5)
    return corrections


def entrainer(config_path: str = "ml/config.yaml"):
    config = charger_config(config_path)
    mlflow.set_tracking_uri(config["data"]["mlflow_uri"])
    mlflow.set_experiment("realestate-prix-m2")
    f, inv = _transformations(config)

    print("Chargement du dataset gold...")
    df = charger_gold(config)
    df["periode"] = pd.to_datetime(df["date_mutation"]).dt.to_period("M")
    debut_reglage = df["periode"].max() - (MOIS_REGLAGE - 1)
    train_df = df[df["periode"] < debut_reglage]
    reglage_df = df[df["periode"] >= debut_reglage]
    print(f"  {len(df):,} transactions | réglage {debut_reglage} → {df['periode'].max()} : "
          f"{len(reglage_df):,}")

    cat_dtypes = construire_cat_dtypes(df, config["features"])
    X_train, y_train = preparer_features(train_df, config, cat_dtypes)
    X_regl, y_regl = preparer_features(reglage_df, config, cat_dtypes)
    X_all, y_all = preparer_features(df, config, cat_dtypes)

    params = dict(config["lightgbm"])
    early_stopping = params.pop("early_stopping_rounds", 50)
    params.pop("verbose", None)

    with mlflow.start_run():
        mlflow.log_params(params)
        mlflow.log_param("target_transform", config.get("target_transform"))
        mlflow.log_param("debut_reglage", str(debut_reglage))
        mlflow.log_param("n_total", len(X_all))

        # --- 1. Réglage ------------------------------------------------------
        print("\nRéglage (arrêt anticipé sur les 3 derniers mois)...")
        t0 = time.time()
        model = lgb.LGBMRegressor(**params, verbose=-1)
        model.fit(X_train, f(y_train), sample_weight=_poids(train_df, config),
                  eval_set=[(X_regl, f(y_regl))],
                  callbacks=[lgb.early_stopping(early_stopping, verbose=False),
                             lgb.log_evaluation(200)])
        n_arbres = int(model.best_iteration_)
        print(f"  {n_arbres} arbres retenus ({time.time() - t0:.0f}s)")

        y_pred = inv(model.predict(X_regl))
        surface = reglage_df["surface_bati"].values
        metriques = calculer_metriques(y_regl.values, y_pred, y_regl.values * surface, y_pred * surface)
        mlflow.log_metrics(metriques)
        afficher_rapport(metriques)

        params_q = {**params, "objective": "quantile", "metric": "quantile", "n_estimators": n_arbres}
        q_regl = {}
        for a in QUANTILES:
            q = lgb.LGBMRegressor(**{**params_q, "alpha": a}, verbose=-1)
            q.fit(X_train, f(y_train), sample_weight=_poids(train_df, config))
            q_regl[a] = q.predict(X_regl)
        bas, haut = np.minimum(*q_regl.values()), np.maximum(*q_regl.values())

        # Classement des communes (définition du protocole)
        ape = np.abs(y_regl.values - y_pred) / y_regl.values * 100
        local = pd.DataFrame({"code_commune": reglage_df["code_commune"].values, "ape": ape})
        agg = local.groupby("code_commune")["ape"].agg(mape="mean", n="count")
        local_mape = {code: {"mape": round(r.mape, 1), "n": int(r.n), "classe": _classe(r.mape, r.n)}
                      for code, r in agg.iterrows()}
        classes = reglage_df["code_commune"].map(
            {k: v["classe"] for k, v in local_mape.items()}).fillna("donnees_insuffisantes").values
        corrections = _calibrer(y_regl.values, bas, haut, classes)
        couverture = {}
        for c in np.unique(classes):
            m = classes == c
            lo, hi = bas[m] - corrections[c], haut[m] + corrections[c]
            couverture[c] = round(float(((np.log(y_regl.values[m]) >= lo) & (np.log(y_regl.values[m]) <= hi)).mean() * 100), 1)
        print(f"  Fourchette calibrée à {COUVERTURE_VISEE:.0%} : couverture par classe {couverture}")

        # --- 2. Production : toutes les ventes -------------------------------
        print(f"\nRéentraînement sur les {len(X_all):,} ventes ({n_arbres} arbres)...")
        poids_all = _poids(df, config)
        model_prod = lgb.LGBMRegressor(**{**params, "n_estimators": n_arbres}, verbose=-1)
        model_prod.fit(X_all, f(y_all), sample_weight=poids_all)

        model_path = Path(config["data"]["model_output"])
        dossier = model_path.parent
        dossier.mkdir(parents=True, exist_ok=True)
        joblib.dump(model_prod, model_path)
        for a, nom in zip(QUANTILES, ("lgb_q075.pkl", "lgb_q925.pkl")):
            q = lgb.LGBMRegressor(**{**params_q, "alpha": a}, verbose=-1)
            q.fit(X_all, f(y_all), sample_weight=poids_all)
            joblib.dump(q, dossier / nom)

        categories = {col: list(X_all[col].cat.categories) for col in config["features"]["categorical"]}
        (dossier / "categories.json").write_text(json.dumps(categories, ensure_ascii=False))
        (dossier / "local_mape.json").write_text(json.dumps(local_mape, ensure_ascii=False, indent=2))
        (dossier / "calibration.json").write_text(json.dumps({
            "couverture_visee": COUVERTURE_VISEE,
            "echelle": config.get("target_transform") or "brute",
            "corrections_par_classe": corrections,
            "couverture_reglage": couverture,
        }, ensure_ascii=False, indent=2))

        importance = sorted(zip(X_all.columns, model_prod.feature_importances_), key=lambda x: -x[1])[:8]
        print("\nTop 8 features :")
        for feat, imp in importance:
            print(f"  {feat:35s} {imp:>6.0f}")

        model_info = {
            "mape": round(metriques["mape_m2"], 2),
            "r2": round(metriques["r2_m2"], 4),
            "mae": round(metriques["mae_m2"], 2),
            "dans_10pct": round(metriques["dans_10pct"], 1),
            "dans_20pct": round(metriques["dans_20pct"], 1),
            "metriques_sur": f"réglage {debut_reglage} → {df['periode'].max()} (sert à l'arrêt anticipé)",
            "mesure_de_reference": "docs/protocole_evaluation.md",
            "n_train": len(X_all),
            "n_reglage": len(X_regl),
            # Champs lus par le backend (/api/health) : n_test = ventes de réglage
            "n_test": len(X_regl),
            "train_years": sorted(int(a) for a in df["annee"].unique()),
            "test_years": [],
            "target_transform": config.get("target_transform"),
            "features": list(X_all.columns),
            "n_features": len(X_all.columns),
            "n_estimators": n_arbres,
            "trained_at": datetime.now().strftime("%Y-%m-%dT%H:%M:%S"),
        }
        (dossier / "model_info.json").write_text(json.dumps(model_info, ensure_ascii=False, indent=2))

        mlflow.lightgbm.log_model(
            model_prod, "model",
            skops_trusted_types=[
                "lightgbm.callback._EarlyStoppingCallback",
                "lightgbm.callback._LogEvaluationCallback",
            ]
        )
        print(f"\nModèle sauvegardé : {model_path}")

    return model_prod


if __name__ == "__main__":
    import os
    os.chdir(Path(__file__).resolve().parent.parent)
    entrainer()
