"""Tests unitaires — ml/features.py

Couvre :
  - construire_features_ingenierie : dpe_score, is_studio, densite_pieces, log_surface
  - split_chronologique : mode holdout_frac et mode test_years
"""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT / "ml"))

from features import construire_features_ingenierie, split_chronologique


# ==========================================================================
#  HELPERS
# ==========================================================================

def _df(**kwargs) -> pd.DataFrame:
    """Construit un DataFrame minimal avec les colonnes requises par features.py."""
    base: dict = {
        "surface_bati": 60.0,
        "nb_pieces": 3.0,
        "prix_m2_median_dept_12m": 8000.0,
        "prix_m2_median_local_12m": 9000.0,
        "nb_ventes_commune_12m": 200.0,
        "nb_ventes_dept_12m": 5000.0,
    }
    base.update(kwargs)
    n = max(len(v) if isinstance(v, list) else 1 for v in base.values())
    expanded = {
        k: (v if isinstance(v, list) and len(v) == n else [v[0]] * n if isinstance(v, list) else [v] * n)
        for k, v in base.items()
    }
    return pd.DataFrame(expanded)


# ==========================================================================
#  dpe_score
# ==========================================================================

@pytest.mark.parametrize("classe,expected_score", [
    ("A", 0), ("B", 1), ("C", 2), ("D", 3), ("E", 4), ("F", 5), ("G", 6),
])
def test_dpe_score_mapping(classe, expected_score):
    df = _df(dpe_classe=[classe])
    result = construire_features_ingenierie(df)
    assert result["dpe_score"].iloc[0] == expected_score


def test_dpe_score_nan_when_column_absent():
    df = _df()  # pas de colonne dpe_classe
    result = construire_features_ingenierie(df)
    assert result["dpe_score"].isna().all()


def test_dpe_score_nan_when_value_unknown():
    df = _df(dpe_classe=["Z"])  # lettre hors A-G
    result = construire_features_ingenierie(df)
    assert pd.isna(result["dpe_score"].iloc[0])


def test_dpe_score_preserves_nan_in_column():
    df = _df(dpe_classe=[None])
    result = construire_features_ingenierie(df)
    assert pd.isna(result["dpe_score"].iloc[0])


# ==========================================================================
#  is_studio
# ==========================================================================

@pytest.mark.parametrize("surface,expected", [
    (20.0, True),
    (34.9, True),
    (35.0, False),
    (60.0, False),
    (120.0, False),
])
def test_is_studio(surface, expected):
    df = _df(surface_bati=[surface])
    result = construire_features_ingenierie(df)
    assert result["is_studio"].iloc[0] == expected


def test_is_studio_dtype_is_bool():
    df = _df(surface_bati=[25.0, 80.0])
    result = construire_features_ingenierie(df)
    assert result["is_studio"].dtype == bool or result["is_studio"].dtype == np.bool_


# ==========================================================================
#  densite_pieces
# ==========================================================================

def test_densite_pieces_nominal():
    df = _df(surface_bati=[60.0], nb_pieces=[3.0])
    result = construire_features_ingenierie(df)
    assert result["densite_pieces"].iloc[0] == pytest.approx(3.0 / 60.0)


def test_densite_pieces_zero_surface_gives_nan():
    df = _df(surface_bati=[0.0], nb_pieces=[2.0])
    result = construire_features_ingenierie(df)
    assert pd.isna(result["densite_pieces"].iloc[0])


def test_densite_pieces_multiple_rows():
    df = _df(surface_bati=[50.0, 100.0], nb_pieces=[2.0, 4.0])
    result = construire_features_ingenierie(df)
    assert result["densite_pieces"].iloc[0] == pytest.approx(2.0 / 50.0)
    assert result["densite_pieces"].iloc[1] == pytest.approx(4.0 / 100.0)


# ==========================================================================
#  log_surface
# ==========================================================================

def test_log_surface_value():
    df = _df(surface_bati=[60.0])
    result = construire_features_ingenierie(df)
    assert result["log_surface"].iloc[0] == pytest.approx(np.log1p(60.0))


def test_log_surface_zero_surface():
    df = _df(surface_bati=[0.0])
    result = construire_features_ingenierie(df)
    assert result["log_surface"].iloc[0] == pytest.approx(0.0)  # log1p(0) = 0


# ==========================================================================
#  split_chronologique — holdout_frac
# ==========================================================================

def _df_annees(counts: dict[int, int]) -> pd.DataFrame:
    rows = []
    for annee, n in counts.items():
        for _ in range(n):
            rows.append({"annee": annee, "prix_m2": 10000.0})
    return pd.DataFrame(rows)


def test_holdout_frac_taille_test():
    df = _df_annees({2021: 100, 2022: 100, 2023: 100, 2024: 100, 2025: 200})
    config = {"split": {"train_years": [2021, 2022, 2023, 2024, 2025], "holdout_frac": 0.15}}
    train, test = split_chronologique(df, config)
    # 15% de 200 transactions 2025 = 30
    assert len(test) == 30
    assert len(train) == len(df) - 30


def test_holdout_frac_test_annee_max_seulement():
    df = _df_annees({2021: 50, 2022: 50, 2025: 100})
    config = {"split": {"train_years": [2021, 2022, 2025], "holdout_frac": 0.20}}
    train, test = split_chronologique(df, config)
    # Le hold-out ne prend que dans 2025 (max year)
    assert len(test) == 20
    # 2021 et 2022 sont entièrement dans le train
    train_years = train["annee"].unique()
    assert 2021 in train_years
    assert 2022 in train_years


def test_holdout_frac_pas_de_fuite_temporelle():
    """Train + test couvre l'ensemble du dataset sans doublon ni perte."""
    df = _df_annees({2023: 100, 2024: 100, 2025: 100})
    config = {"split": {"train_years": [2023, 2024, 2025], "holdout_frac": 0.15}}
    train, test = split_chronologique(df, config)
    # Totalité des lignes conservées
    assert len(train) + len(test) == len(df)
    # Le hold-out ne contient que des lignes de l'année la plus récente
    assert (test["annee"] == 2025).all()


def test_holdout_frac_reproductible():
    df = _df_annees({2025: 200})
    config = {"split": {"train_years": [2025], "holdout_frac": 0.10}}
    _, test1 = split_chronologique(df, config)
    _, test2 = split_chronologique(df, config)
    pd.testing.assert_frame_equal(test1.reset_index(drop=True), test2.reset_index(drop=True))


# ==========================================================================
#  split_chronologique — test_years (mode classique)
# ==========================================================================

def test_split_test_years_mode():
    df = _df_annees({2021: 100, 2022: 100, 2023: 50})
    config = {"split": {"train_years": [2021, 2022], "test_years": [2023]}}
    train, test = split_chronologique(df, config)
    assert len(train) == 200
    assert len(test) == 50
    assert set(train["annee"].unique()) == {2021, 2022}
    assert set(test["annee"].unique()) == {2023}


def test_split_test_years_absent_returns_empty():
    df = _df_annees({2021: 100, 2022: 100})
    config = {"split": {"train_years": [2021, 2022]}}  # pas de test_years ni holdout_frac
    train, test = split_chronologique(df, config)
    assert len(train) == 200
    assert len(test) == 0
