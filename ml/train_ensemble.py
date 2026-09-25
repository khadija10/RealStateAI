"""Ensemble LightGBM + CatBoost — moyenne pondérée des prédictions."""

import json
import os
import time
from pathlib import Path

import catboost as cb
import joblib
import lightgbm as lgb
import numpy as np

from features import charger_config, charger_gold, preparer_features, split_chronologique, construire_cat_dtypes
from evaluate import calculer_metriques, afficher_rapport


def entrainer_ensemble(config_path: str = "ml/config.yaml", poids_lgb: float = 0.55):
    config = charger_config(config_path)

    print("Chargement du dataset gold...")
    df = charger_gold(config)
    print(f"  {len(df):,} transactions chargées")

    train_df, test_df = split_chronologique(df, config)
    print(f"  Train : {len(train_df):,} | Test : {len(test_df):,}")

    cat_dtypes = construire_cat_dtypes(df, config["features"])
    X_train, y_train = preparer_features(train_df, config, cat_dtypes)
    X_test, y_test = preparer_features(test_df, config, cat_dtypes)

    # ── LightGBM ─────────────────────────────────────────────────────────────
    params = dict(config["lightgbm"])
    early_stopping = params.pop("early_stopping_rounds", 50)
    params.pop("verbose", None)

    print("\n[1/2] Entraînement LightGBM...")
    t0 = time.time()
    lgb_model = lgb.LGBMRegressor(**params)
    lgb_model.fit(
        X_train, y_train,
        eval_set=[(X_test, y_test)],
        callbacks=[lgb.early_stopping(early_stopping, verbose=False), lgb.log_evaluation(100)],
    )
    print(f"  Entraîné en {time.time()-t0:.1f}s — {lgb_model.best_iteration_} arbres")
    y_lgb = lgb_model.predict(X_test)

    # ── CatBoost ─────────────────────────────────────────────────────────────
    cat_features = config["features"]["categorical"]
    # CatBoost attend les indices des colonnes catégorielles
    cat_indices = [list(X_train.columns).index(c) for c in cat_features]

    # Convertir les catégorielles en str pour CatBoost
    X_train_cb = X_train.copy()
    X_test_cb = X_test.copy()
    for col in cat_features:
        X_train_cb[col] = X_train_cb[col].astype(str)
        X_test_cb[col] = X_test_cb[col].astype(str)

    print("\n[2/2] Entraînement CatBoost...")
    t0 = time.time()
    cb_model = cb.CatBoostRegressor(
        iterations=1500,
        learning_rate=0.05,
        depth=8,
        l2_leaf_reg=3.0,
        cat_features=cat_indices,
        eval_metric="MAPE",
        early_stopping_rounds=50,
        random_seed=42,
        verbose=100,
    )
    cb_model.fit(
        X_train_cb, y_train,
        eval_set=(X_test_cb, y_test),
    )
    print(f"  Entraîné en {time.time()-t0:.1f}s")
    y_cb = cb_model.predict(X_test_cb)

    # ── Évaluation individuelle ───────────────────────────────────────────────
    surface_test = test_df["surface_bati"].values
    print("\n--- LightGBM seul ---")
    m_lgb = calculer_metriques(y_test.values, y_lgb, y_test.values * surface_test, y_lgb * surface_test)
    afficher_rapport(m_lgb)

    print("\n--- CatBoost seul ---")
    m_cb = calculer_metriques(y_test.values, y_cb, y_test.values * surface_test, y_cb * surface_test)
    afficher_rapport(m_cb)

    # ── Ensemble ─────────────────────────────────────────────────────────────
    y_ensemble = poids_lgb * y_lgb + (1 - poids_lgb) * y_cb
    print(f"\n--- Ensemble (LGB×{poids_lgb} + CB×{1-poids_lgb}) ---")
    m_ens = calculer_metriques(y_test.values, y_ensemble, y_test.values * surface_test, y_ensemble * surface_test)
    afficher_rapport(m_ens)

    # ── Sauvegarde ───────────────────────────────────────────────────────────
    model_dir = Path(config["data"]["model_output"]).parent
    model_dir.mkdir(parents=True, exist_ok=True)

    joblib.dump(lgb_model, model_dir / "lgb_model.pkl")
    cb_model.save_model(str(model_dir / "cb_model.cbm"))

    ensemble_meta = {
        "type": "ensemble",
        "poids_lgb": poids_lgb,
        "poids_cb": round(1 - poids_lgb, 2),
        "mape_lgb": m_lgb["mape_m2"],
        "mape_cb": m_cb["mape_m2"],
        "mape_ensemble": m_ens["mape_m2"],
        "features": config["features"],
    }
    (model_dir / "ensemble_meta.json").write_text(json.dumps(ensemble_meta, ensure_ascii=False, indent=2))

    categories = {col: list(X_train[col].cat.categories) for col in cat_features}
    (model_dir / "categories.json").write_text(json.dumps(categories, ensure_ascii=False))

    # Le fichier principal attendu par le backend reste price_model.pkl (LGB)
    # L'estimator.py sera mis à jour pour utiliser l'ensemble
    joblib.dump(lgb_model, model_dir / "price_model.pkl")

    print(f"\nModèles sauvegardés dans : {model_dir}")
    print(f"  lgb_model.pkl | cb_model.cbm | ensemble_meta.json")
    return lgb_model, cb_model, ensemble_meta


if __name__ == "__main__":
    os.chdir(Path(__file__).resolve().parent.parent)
    entrainer_ensemble()
