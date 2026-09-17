"""Tests de la logique de détection de drift dans ml/monitoring.py.

On ne charge pas le vrai modèle LightGBM. On injecte un modèle factice
(SimpleNamespace avec predict()) et des DataFrames synthétiques pour tester
la logique de calcul et de décision de manière isolée et reproductible.
"""

from __future__ import annotations

import sys
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

import numpy as np
import pandas as pd
import pytest

ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT / "ml"))

from monitoring import (
    calculer_mape,
    charger_echantillon_recent,
    preparer_features,
    surveiller,
    TARGET_COL,
    FEATURES_ORDER,
    CAT_FEATURES,
)


# ── helpers ───────────────────────────────────────────────────────────────────

def _modele_parfait(y_true: np.ndarray):
    """Modèle fictif qui prédit exactement les valeurs."""
    return SimpleNamespace(predict=lambda X: y_true)


def _modele_biaise(y_true: np.ndarray, biais: float):
    """Modèle fictif qui prédit avec un biais multiplicatif constant."""
    return SimpleNamespace(predict=lambda X: y_true * biais)


def _make_df(n: int = 100, prix_m2_base: float = 8000.0, seed: int = 42) -> pd.DataFrame:
    """Dataset synthétique minimal avec toutes les colonnes attendues."""
    rng = np.random.default_rng(seed)
    prix_m2 = prix_m2_base * rng.normal(1.0, 0.05, n)
    surface = rng.integers(25, 120, n).astype(float)
    return pd.DataFrame({
        TARGET_COL:                 prix_m2,
        "surface_bati":             surface,
        "nb_pieces":                np.maximum(1, (surface / 25).astype(int)).astype(float),
        "surface_moyenne_piece":    surface / np.maximum(1, (surface / 25).astype(int)),
        "prix_m2_reference_12m":    prix_m2 * rng.normal(1.0, 0.03, n),
        "nb_ventes_commune_12m":    rng.integers(50, 500, n).astype(float),
        "prix_m2_median_dept_12m":  prix_m2 * rng.normal(1.0, 0.04, n),
        "nb_ventes_dept_12m":       rng.integers(500, 5000, n).astype(float),
        "latitude":                 rng.uniform(48.5, 49.0, n),
        "longitude":                rng.uniform(2.0, 2.8, n),
        "mois_index":               rng.integers(1, 60, n).astype(float),
        "mois":                     rng.integers(1, 13, n).astype(float),
        "trimestre":                rng.integers(1, 5, n).astype(float),
        "code_type_local":          rng.choice(["Appartement", "Maison"], n),
        "code_departement":         rng.choice(["75", "92", "93"], n),
        "a_terrain":                rng.choice([True, False], n),
    })


# ── calculer_mape ─────────────────────────────────────────────────────────────

class TestCalculerMape:

    def test_prediction_parfaite(self):
        y = np.array([10_000.0, 8_000.0, 6_000.0])
        assert calculer_mape(y, y) == pytest.approx(0.0)

    def test_biais_20_pct(self):
        y = np.array([10_000.0] * 100)
        pred = y * 1.20
        assert calculer_mape(y, pred) == pytest.approx(20.0, abs=0.1)

    def test_biais_negatif_20_pct(self):
        """MAPE est symétrique en valeur absolue."""
        y = np.array([10_000.0] * 100)
        assert calculer_mape(y, y * 0.80) == pytest.approx(20.0, abs=0.1)

    def test_exclut_les_zeros(self):
        """Un prix_m2 = 0 est un outlier DVF : ne doit pas planter ni fausser."""
        y = np.array([0.0, 10_000.0, 8_000.0])
        pred = np.array([1_000.0, 10_000.0, 8_000.0])
        mape = calculer_mape(y, pred)
        assert mape == pytest.approx(0.0)   # seules les 2 valeurs > 0 comptent

    def test_retourne_un_float(self):
        y = np.array([5_000.0, 6_000.0])
        assert isinstance(calculer_mape(y, y), float)


# ── preparer_features ─────────────────────────────────────────────────────────

class TestPreparerFeatures:

    def test_retient_seulement_colonnes_connues(self):
        df = _make_df(10)
        df["colonne_inconnue"] = 99.9
        X = preparer_features(df)
        assert "colonne_inconnue" not in X.columns

    def test_colonnes_categoriques_sont_category(self):
        df = _make_df(10)
        X = preparer_features(df)
        for col in CAT_FEATURES:
            if col in X.columns:
                assert X[col].dtype.name == "category", (
                    f"{col} devrait être dtype category, got {X[col].dtype}"
                )

    def test_df_sans_colonnes_optionnelles(self):
        """Certaines features peuvent être absentes (données partielles) — ne doit pas planter."""
        df = pd.DataFrame({
            TARGET_COL: [8_000.0] * 5,
            "surface_bati": [60.0] * 5,
            "code_departement": ["75"] * 5,
        })
        X = preparer_features(df)
        assert len(X) == 5


# ── charger_echantillon_recent ────────────────────────────────────────────────

class TestChargerEchantillon:

    def test_charge_depuis_gold_partitionne(self, tmp_path):
        for annee in ["annee=2023", "annee=2024", "annee=2025"]:
            d = tmp_path / "gold" / annee
            d.mkdir(parents=True)
            pd.DataFrame({TARGET_COL: [8_000.0] * 10}).to_parquet(d / "data.parquet")

        df = charger_echantillon_recent(tmp_path / "gold", tmp_path / "absent.parquet")
        # Doit charger l'année la plus récente (2025)
        assert len(df) == 10

    def test_repli_sur_sample_si_gold_absent(self, tmp_path):
        sample = tmp_path / "sample.parquet"
        pd.DataFrame({TARGET_COL: [7_000.0] * 20}).to_parquet(sample)

        df = charger_echantillon_recent(tmp_path / "gold_absent", sample)
        assert len(df) == 20

    def test_sort_si_rien_disponible(self, tmp_path):
        with pytest.raises(SystemExit) as exc:
            charger_echantillon_recent(tmp_path / "absent", tmp_path / "absent.parquet")
        assert exc.value.code == 2

    def test_respecte_n(self, tmp_path):
        d = tmp_path / "gold" / "annee=2025"
        d.mkdir(parents=True)
        pd.DataFrame({TARGET_COL: [8_000.0] * 200}).to_parquet(d / "data.parquet")

        df = charger_echantillon_recent(tmp_path / "gold", tmp_path / "absent.parquet", n=50)
        assert len(df) == 50


# ── surveiller — détection de drift ──────────────────────────────────────────

class TestSurveiller:

    def _run(self, df, biais=1.0, seuil=25.0, tmp_path=None):
        """Lance surveiller() en patchant charger_modele et charger_echantillon_recent."""
        y_true = df[TARGET_COL].values
        modele = _modele_biaise(y_true, biais)

        with (
            patch("monitoring.charger_modele", return_value=modele),
            patch("monitoring.charger_echantillon_recent", return_value=df),
        ):
            return surveiller(
                model_path=Path("."),
                gold_path=Path("."),
                sample_path=Path("."),
                alert_threshold=seuil,
            )

    def test_pas_de_drift_quand_mape_faible(self, tmp_path):
        df = _make_df(200, prix_m2_base=8_000.0)
        rapport = self._run(df, biais=1.05)   # 5 % d'erreur → sous le seuil 25 %
        assert rapport["drift_detecte"] is False
        assert "SAIN" in rapport["statut"]

    def test_drift_detecte_quand_mape_depasse_seuil(self, tmp_path):
        df = _make_df(200, prix_m2_base=8_000.0)
        rapport = self._run(df, biais=1.40, seuil=25.0)   # 40 % d'erreur
        assert rapport["drift_detecte"] is True
        assert "DRIFT" in rapport["statut"]

    def test_seuil_personnalise(self, tmp_path):
        df = _make_df(200, prix_m2_base=8_000.0)
        # 15 % d'erreur : sous seuil 25 % mais au-dessus de seuil 10 %
        rapport_25 = self._run(df, biais=1.15, seuil=25.0)
        rapport_10 = self._run(df, biais=1.15, seuil=10.0)
        assert rapport_25["drift_detecte"] is False
        assert rapport_10["drift_detecte"] is True

    def test_rapport_contient_toutes_les_cles(self, tmp_path):
        df = _make_df(100, prix_m2_base=8_000.0)
        rapport = self._run(df)
        cles_requises = {
            "timestamp", "n_transactions", "mape_pct", "mae_eur_m2",
            "r2", "dans_20pct", "seuil_alerte_pct", "drift_detecte", "statut",
        }
        assert cles_requises <= set(rapport.keys())

    def test_mape_cohérent_avec_biais(self, tmp_path):
        """Biais de 30 % → MAPE doit être ≈ 30 %."""
        df = _make_df(500, prix_m2_base=8_000.0, seed=7)
        rapport = self._run(df, biais=1.30)
        assert 25.0 < rapport["mape_pct"] < 35.0

    def test_sort_si_donnees_insuffisantes(self, tmp_path):
        """Moins de 50 transactions IDF → exit(2)."""
        df = _make_df(30, prix_m2_base=8_000.0)
        with (
            patch("monitoring.charger_modele", return_value=_modele_parfait(df[TARGET_COL].values)),
            patch("monitoring.charger_echantillon_recent", return_value=df),
        ):
            with pytest.raises(SystemExit) as exc:
                surveiller(Path("."), Path("."), Path("."))
            assert exc.value.code == 2

    def test_sauvegarde_json(self, tmp_path):
        df = _make_df(100)
        output = tmp_path / "rapport.json"
        y_true = df[TARGET_COL].values
        with (
            patch("monitoring.charger_modele", return_value=_modele_parfait(y_true)),
            patch("monitoring.charger_echantillon_recent", return_value=df),
        ):
            surveiller(Path("."), Path("."), Path("."), output_path=output)
        assert output.exists()
        import json
        data = json.loads(output.read_text())
        assert "mape_pct" in data

    def test_filtre_idf_exclut_hors_idf(self, tmp_path):
        """Les lignes hors IDF doivent être exclues avant le calcul."""
        df_idf    = _make_df(100, seed=1)
        df_hors   = _make_df(50, seed=2)
        df_hors["code_departement"] = "69"   # Lyon — hors IDF
        df_mixte  = pd.concat([df_idf, df_hors], ignore_index=True)

        y_idf_only = df_idf[TARGET_COL].values
        modele = _modele_parfait(y_idf_only)

        with (
            patch("monitoring.charger_modele", return_value=modele),
            patch("monitoring.charger_echantillon_recent", return_value=df_mixte),
        ):
            rapport = surveiller(Path("."), Path("."), Path("."))

        # Si le filtre fonctionne, n_transactions == 100 (IDF seul)
        assert rapport["n_transactions"] == 100, (
            "Les transactions hors IDF (dep=69) ne doivent pas être incluses"
        )
