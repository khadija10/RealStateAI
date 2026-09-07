"""Chargement et préparation des features depuis le dataset gold."""

from pathlib import Path
import duckdb
import pandas as pd
import yaml


def charger_config(chemin: str = "ml/config.yaml") -> dict:
    with open(chemin) as f:
        return yaml.safe_load(f)


def charger_gold(config: dict) -> pd.DataFrame:
    gold_path = Path(config["data"]["gold_path"])
    df = duckdb.sql(f"""
        SELECT * FROM read_parquet('{gold_path}/**/*.parquet', hive_partitioning=true)
        WHERE prix_m2_reference_12m IS NOT NULL
    """).df()
    return df


def construire_cat_dtypes(df: pd.DataFrame, feat_cfg: dict) -> dict:
    """Construit les CategoricalDtype depuis le dataset complet (train+test)."""
    return {
        col: pd.CategoricalDtype(categories=sorted(df[col].dropna().unique()))
        for col in feat_cfg["categorical"]
    }


def preparer_features(
    df: pd.DataFrame, config: dict, cat_dtypes: dict | None = None
) -> tuple[pd.DataFrame, pd.Series]:
    feat_cfg = config["features"]
    cols = feat_cfg["numeric"] + feat_cfg["categorical"] + feat_cfg["boolean"]
    target = config["target"]

    X = df[cols].copy()

    for col in feat_cfg["categorical"]:
        dtype = cat_dtypes[col] if cat_dtypes else pd.CategoricalDtype(categories=sorted(df[col].dropna().unique()))
        X[col] = X[col].astype(dtype)

    for col in feat_cfg["boolean"]:
        X[col] = X[col].astype(bool)

    y = df[target].copy()
    return X, y


def split_chronologique(df: pd.DataFrame, config: dict) -> tuple:
    train_years = config["split"]["train_years"]
    test_years = config["split"]["test_years"]

    train_mask = df["annee"].isin(train_years)
    test_mask = df["annee"].isin(test_years)

    return df[train_mask], df[test_mask]
