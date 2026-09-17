"""Tests de ml/evaluate.py — calculer_metriques().

calculer_metriques() est la source des métriques que le CI/CD gate utilise
pour décider de bloquer ou non un déploiement. Un bug ici rendrait la gate
aveugle (elle lirait des chiffres incorrects et ne bloquerait pas un mauvais
modèle, ou bloquerait un bon).
"""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import pytest

ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT / "ml"))

from evaluate import calculer_metriques


# ── helpers ───────────────────────────────────────────────────────────────────

def _parfait(n=100, base=8_000.0):
    """Prédictions parfaites : y_pred == y_true."""
    y = np.full(n, base)
    surface = np.full(n, 60.0)
    return y, y, y * surface, y * surface


def _biais(pct: float, n=200, base=8_000.0):
    """Prédictions biaisées d'un pourcentage fixe."""
    y = np.full(n, base)
    surface = np.full(n, 60.0)
    y_pred = y * (1 + pct / 100)
    return y, y_pred, y * surface, y_pred * surface


# ── précision des métriques prix/m² ──────────────────────────────────────────

class TestMapeM2:

    def test_prediction_parfaite_donne_zero(self):
        m = calculer_metriques(*_parfait())
        assert m["mape_m2"] == pytest.approx(0.0, abs=0.01)

    def test_biais_20pct_donne_mape_20(self):
        m = calculer_metriques(*_biais(20))
        assert m["mape_m2"] == pytest.approx(20.0, abs=0.1)

    def test_biais_negatif_20pct_donne_mape_20(self):
        """MAPE est en valeur absolue — biais négatif donne le même résultat."""
        m = calculer_metriques(*_biais(-20))
        assert m["mape_m2"] == pytest.approx(20.0, abs=0.1)

    def test_mape_strictement_positif_sur_erreur(self):
        y = np.array([8_000.0, 9_000.0, 7_000.0])
        pred = y * 1.10
        surface = np.array([60.0, 70.0, 50.0])
        m = calculer_metriques(y, pred, y * surface, pred * surface)
        assert m["mape_m2"] > 0


class TestR2:

    def test_prediction_parfaite_donne_r2_un(self):
        rng = np.random.default_rng(0)
        y = rng.uniform(5_000, 12_000, 100)   # valeurs variées — vecteur constant → 0/0
        surface = np.full(100, 60.0)
        m = calculer_metriques(y, y, y * surface, y * surface)
        assert m["r2_m2"] == pytest.approx(1.0, abs=1e-6)

    def test_prediction_constante_donne_r2_zero(self):
        """Prédire la moyenne → R² = 0."""
        y = np.array([6_000.0, 8_000.0, 10_000.0, 12_000.0])
        pred = np.full_like(y, y.mean())
        surface = np.full_like(y, 60.0)
        m = calculer_metriques(y, pred, y * surface, pred * surface)
        assert m["r2_m2"] == pytest.approx(0.0, abs=1e-6)

    def test_mauvais_modele_donne_r2_negatif(self):
        """Un modèle pire que la moyenne a un R² négatif."""
        y = np.array([6_000.0, 8_000.0, 10_000.0])
        pred = np.array([10_000.0, 6_000.0, 6_000.0])   # inversé
        surface = np.full_like(y, 60.0)
        m = calculer_metriques(y, pred, y * surface, pred * surface)
        assert m["r2_m2"] < 0


class TestDansPct:

    def test_prediction_parfaite_donne_100pct(self):
        m = calculer_metriques(*_parfait())
        assert m["dans_10pct"] == pytest.approx(100.0)
        assert m["dans_20pct"] == pytest.approx(100.0)

    def test_biais_5pct_dans_10pct(self):
        """Toutes les prédictions à 5 % d'erreur → 100 % dans ±10 %."""
        m = calculer_metriques(*_biais(5))
        assert m["dans_10pct"] == pytest.approx(100.0)
        assert m["dans_20pct"] == pytest.approx(100.0)

    def test_biais_15pct_dans_20pct_pas_10pct(self):
        """À 15 % d'erreur : dans ±20 % mais pas ±10 %."""
        m = calculer_metriques(*_biais(15))
        assert m["dans_10pct"] == pytest.approx(0.0)
        assert m["dans_20pct"] == pytest.approx(100.0)

    def test_biais_25pct_hors_20pct(self):
        """À 25 % d'erreur : hors des deux fourchettes."""
        m = calculer_metriques(*_biais(25))
        assert m["dans_10pct"] == pytest.approx(0.0)
        assert m["dans_20pct"] == pytest.approx(0.0)

    def test_moitie_dans_20pct(self):
        """100 transactions : 50 parfaites, 50 à 30 % → dans_20pct = 50 %."""
        y = np.concatenate([np.full(50, 8_000.0), np.full(50, 8_000.0)])
        pred = np.concatenate([np.full(50, 8_000.0), np.full(50, 8_000.0 * 1.30)])
        surface = np.full(100, 60.0)
        m = calculer_metriques(y, pred, y * surface, pred * surface)
        assert m["dans_20pct"] == pytest.approx(50.0)


# ── structure du dictionnaire retourné ───────────────────────────────────────

class TestStructureRetour:

    def test_toutes_les_cles_presentes(self):
        m = calculer_metriques(*_parfait())
        cles = {"mae_m2", "mape_m2", "rmse_m2", "r2_m2",
                "mae_total", "mape_total", "dans_10pct", "dans_20pct"}
        assert cles <= set(m.keys())

    def test_valeurs_sont_des_floats(self):
        m = calculer_metriques(*_parfait())
        for k, v in m.items():
            assert isinstance(v, float), f"{k} devrait être float, got {type(v)}"

    def test_mae_total_coherent_avec_surface(self):
        """MAE total = MAE/m² × surface (à vérifier sur prédiction biaisée)."""
        surface = 60.0
        biais_eur_m2 = 1_000.0
        y_m2 = np.array([8_000.0] * 50)
        pred_m2 = y_m2 + biais_eur_m2
        y_tot = y_m2 * surface
        pred_tot = pred_m2 * surface
        m = calculer_metriques(y_m2, pred_m2, y_tot, pred_tot)
        assert m["mae_total"] == pytest.approx(biais_eur_m2 * surface, rel=1e-3)

    def test_rmse_superieur_ou_egal_mae(self):
        """RMSE ≥ MAE toujours (inégalité de Jensen)."""
        rng = np.random.default_rng(99)
        y = rng.uniform(5_000, 12_000, 200)
        pred = y * rng.normal(1.0, 0.15, 200)
        surface = np.full(200, 60.0)
        m = calculer_metriques(y, pred, y * surface, pred * surface)
        assert m["rmse_m2"] >= m["mae_m2"]
