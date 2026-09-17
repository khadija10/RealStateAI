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
        cat_path.write_text(json.dumps(categories, ensure_ascii=False))
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
