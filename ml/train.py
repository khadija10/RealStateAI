"""Entraînement LightGBM avec tracking MLflow."""

import time
from pathlib import Path

import joblib
import lightgbm as lgb
import mlflow
import mlflow.lightgbm
import numpy as np

from features import charger_config, charger_gold, preparer_features, split_chronologique, construire_cat_dtypes
from evaluate import calculer_metriques, afficher_rapport


def entrainer(config_path: str = "ml/config.yaml"):
    config = charger_config(config_path)
    mlflow.set_tracking_uri(config["data"]["mlflow_uri"])
    mlflow.set_experiment("realestate-prix-m2")

    print("Chargement du dataset gold...")
    df = charger_gold(config)
    print(f"  {len(df):,} transactions chargées")

    train_df, test_df = split_chronologique(df, config)
    print(f"  Train : {len(train_df):,} | Test : {len(test_df):,}")

    # Catégories définies sur le dataset complet pour cohérence train/test
    cat_dtypes = construire_cat_dtypes(df, config["features"])
    X_train, y_train = preparer_features(train_df, config, cat_dtypes)
    X_test, y_test = preparer_features(test_df, config, cat_dtypes)

    params = config["lightgbm"]
    early_stopping = params.pop("early_stopping_rounds", 50)
    verbose = params.pop("verbose", -1)

    with mlflow.start_run():
        mlflow.log_params(params)
        mlflow.log_param("train_years", config["split"]["train_years"])
        mlflow.log_param("test_years", config["split"]["test_years"])
        mlflow.log_param("n_train", len(X_train))
        mlflow.log_param("n_test", len(X_test))

        print("\nEntraînement LightGBM...")
        t0 = time.time()

        model = lgb.LGBMRegressor(**params)
        model.fit(
            X_train, y_train,
            eval_set=[(X_test, y_test)],
            callbacks=[
                lgb.early_stopping(early_stopping, verbose=False),
                lgb.log_evaluation(100),
            ],
        )

        duree = time.time() - t0
        print(f"  Entraîné en {duree:.1f}s — {model.best_iteration_} arbres retenus")

        print("\nÉvaluation...")
        y_pred = model.predict(X_test)
        # Prix total prédit = prix_m2 prédit × surface
        surface_test = test_df["surface_bati"].values
        prix_total_pred = y_pred * surface_test
        prix_total_reel = y_test.values * surface_test

        metriques = calculer_metriques(y_test.values, y_pred, prix_total_reel, prix_total_pred)
        mlflow.log_metrics(metriques)
        mlflow.log_metric("train_duration_s", duree)

        afficher_rapport(metriques)

        # Importance des features
        importance = dict(zip(X_train.columns, model.feature_importances_))
        top5 = sorted(importance.items(), key=lambda x: x[1], reverse=True)[:5]
        print("\nTop 5 features :")
        for feat, imp in top5:
            print(f"  {feat:35s} {imp:>6.0f}")

        # Sauvegarde modèle + mapping des catégories
        model_path = Path(config["data"]["model_output"])
        model_path.parent.mkdir(parents=True, exist_ok=True)
        joblib.dump(model, model_path)

        categories = {
            col: list(X_train[col].cat.categories)
            for col in config["features"]["categorical"]
        }
        cat_path = model_path.parent / "categories.json"
        import json
        from datetime import datetime as _dt
        cat_path.write_text(json.dumps(categories, ensure_ascii=False))

        # Modèles quantile — fourchette per-prédiction (85 % CI : q7.5 – q92.5)
        print("\nEntraînement modèles quantiles (q7.5 et q92.5)...")
        params_q = {
            **params,
            "objective": "quantile",
            "metric": "quantile",
            "n_estimators": model.best_iteration_,
            "verbose": -1,
        }
        model_q075 = lgb.LGBMRegressor(**{**params_q, "alpha": 0.075})
        model_q075.fit(X_train, y_train)
        joblib.dump(model_q075, model_path.parent / "lgb_q075.pkl")

        model_q925 = lgb.LGBMRegressor(**{**params_q, "alpha": 0.925})
        model_q925.fit(X_train, y_train)
        joblib.dump(model_q925, model_path.parent / "lgb_q925.pkl")
        print(f"  → lgb_q075.pkl / lgb_q925.pkl sauvegardés")

        # MAPE locale par commune (sur le test set) → confiance per-prédiction
        print("\nCalcul MAPE locale par commune...")
        ape_series = np.abs(y_test.values - y_pred) / np.abs(y_pred) * 100
        local_df = test_df[["code_commune"]].copy()
        local_df["ape"] = ape_series
        agg = local_df.groupby("code_commune")["ape"].agg(mape="median", n="count")
        local_mape_dict = {
            code: {"mape": round(row["mape"], 1), "n": int(row["n"])}
            for code, row in agg.iterrows()
            if row["n"] >= 5
        }
        local_mape_path = model_path.parent / "local_mape.json"
        local_mape_path.write_text(json.dumps(local_mape_dict, ensure_ascii=False, indent=2))
        print(f"  → MAPE locale : {len(local_mape_dict)} communes couvertes")

        # Métriques persistées pour le backend (exposées via /api/health)
        model_info = {
            "mape": round(metriques["mape_m2"], 2),
            "r2": round(metriques["r2_m2"], 4),
            "mae": round(metriques["mae_m2"], 2),
            "dans_10pct": round(metriques["dans_10pct"], 1),
            "dans_20pct": round(metriques["dans_20pct"], 1),
            "n_train": len(X_train),
            "n_test": len(X_test),
            "train_years": config["split"]["train_years"],
            "test_years": config["split"]["test_years"],
            "n_features": len(X_train.columns),
            "n_estimators": model.best_iteration_,
            "trained_at": _dt.now().strftime("%Y-%m-%dT%H:%M:%S"),
        }
        info_path = model_path.parent / "model_info.json"
        info_path.write_text(json.dumps(model_info, ensure_ascii=False, indent=2))
        print(f"Métriques sauvegardées : {info_path}")

        mlflow.lightgbm.log_model(
            model, "model",
            skops_trusted_types=[
                "lightgbm.callback._EarlyStoppingCallback",
                "lightgbm.callback._LogEvaluationCallback",
            ]
        )
        print(f"\nModèle sauvegardé : {model_path}")

    return model


if __name__ == "__main__":
    import os
    os.chdir(Path(__file__).resolve().parent.parent)
    entrainer()
