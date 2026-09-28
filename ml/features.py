"""Chargement et préparation des features depuis le dataset gold."""

from pathlib import Path

import duckdb
import numpy as np
import pandas as pd
import yaml


def charger_config(chemin: str = "ml/config.yaml") -> dict:
    with open(chemin) as f:
        return yaml.safe_load(f)


def _filtrer_outliers(df: pd.DataFrame) -> pd.DataFrame:
    """Retire les transactions très éloignées du prix de référence local.

    Le seuil 40%–250% élimine les mutations atypiques (indivisions, ventes
    familiales, erreurs de saisie) sans toucher les transactions normales.
    Le p01/p99 du ratio mesuré sur le dataset est 0.40/1.98 — ces bornes
    sont donc calibrées sur les données réelles.
    """
    mask = (
        (df["prix_m2_reference_12m"] > 0)
        & (df["prix_m2"] >= 0.40 * df["prix_m2_reference_12m"])
        & (df["prix_m2"] <= 2.50 * df["prix_m2_reference_12m"])
    )
    n_before = len(df)
    df = df[mask].reset_index(drop=True)
    n_removed = n_before - len(df)
    print(f"  Outliers filtrés : {n_removed:,} transactions ({n_removed / n_before * 100:.1f}%)")
    return df


_DPE_ORDINAL = {"A": 0, "B": 1, "C": 2, "D": 3, "E": 4, "F": 5, "G": 6}


def construire_features_ingenierie(df: pd.DataFrame) -> pd.DataFrame:
    """Ajoute les features dérivées des colonnes existantes."""
    df = df.copy()
    df["log_surface"] = np.log1p(df["surface_bati"])
    dept_safe = df["prix_m2_median_dept_12m"].replace(0, np.nan)
    df["ratio_local_dept"] = df["prix_m2_median_local_12m"] / dept_safe
    dept_ventes_safe = df["nb_ventes_dept_12m"].replace(0, np.nan)
    df["densite_ventes"] = df["nb_ventes_commune_12m"] / dept_ventes_safe
    # DPE ordinal — donne au modèle un signal ordonné A=0…G=6 en plus du signal catégoriel
    if "dpe_classe" in df.columns:
        df["dpe_score"] = df["dpe_classe"].map(_DPE_ORDINAL)
    else:
        df["dpe_score"] = np.nan
    # Prime petite surface parisienne — studios et T1 < 35 m²
    df["is_studio"] = df["surface_bati"] < 35
    # Densité de pièces — nb_pieces / surface : capture les "haussmanniens coupés" vs T2 spacieux
    surface_safe = df["surface_bati"].replace(0, np.nan)
    df["densite_pieces"] = df["nb_pieces"] / surface_safe
    return df


def charger_gold(config: dict) -> pd.DataFrame:
    gold_path = Path(config["data"]["gold_path"])
    df = duckdb.sql(f"""
        SELECT * FROM read_parquet('{gold_path}/**/*.parquet', hive_partitioning=true)
        WHERE prix_m2_reference_12m IS NOT NULL
    """).df()
    df = _filtrer_outliers(df)
    df = construire_features_ingenierie(df)
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
    test_years  = config["split"].get("test_years", [])
    holdout_frac = config["split"].get("holdout_frac", None)

    if holdout_frac:
        # Hold-out aléatoire sur l'année la plus récente du train
        max_year = max(df[df["annee"].isin(train_years)]["annee"])
        recent   = df[df["annee"] == max_year]
        older    = df[(df["annee"].isin(train_years)) & (df["annee"] != max_year)]
        test_df  = recent.sample(frac=holdout_frac, random_state=42)
        train_df = pd.concat([older, recent.drop(test_df.index)], ignore_index=True)
        return train_df, test_df

    train_mask = df["annee"].isin(train_years)
    test_mask  = df["annee"].isin(test_years)
    return df[train_mask], df[test_mask]
