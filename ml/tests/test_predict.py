"""Tests de ml/predict.py — predire().

predire() assemble les features et appelle le modèle LightGBM.
On injecte un modèle factice pour tester l'assemblage sans dépendance
au fichier pkl ni aux données DVF.
"""

from __future__ import annotations

import sys
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

import pandas as pd
import pytest

ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT / "ml"))

import predict as predict_module
from predict import predire


# ── fixture de base ───────────────────────────────────────────────────────────

FEATURES_BASE = dict(
    surface_m2=65.0,
    nb_pieces=3.0,
    code_type_local="2",
    code_departement="75",
    latitude=48.855,
    longitude=2.312,
    prix_m2_reference_12m=10_000.0,
    nb_ventes_commune_12m=400.0,
    prix_m2_median_dept_12m=10_500.0,
    nb_ventes_dept_12m=12_000.0,
    mois_index=54,
    mois=6,
    trimestre=2,
    a_terrain=False,
)


def _modele_fixe(prix_m2: float):
    """Retourne toujours le même prix au m²."""
    return SimpleNamespace(predict=lambda X: [prix_m2])


def _run(prix_m2_modele=10_000.0, categories=None, q075=None, q925=None, **overrides):
    """Lance predire() avec un modèle factice. q075/q925=None → fallback ±15%."""
    kwargs = {**FEATURES_BASE, **overrides}
    modele = _modele_fixe(prix_m2_modele)
    with (
        patch.object(predict_module, "_MODEL", modele),
        patch.object(predict_module, "_CATEGORIES", categories or {}),
        patch.object(predict_module, "_Q075", q075),
        patch.object(predict_module, "_Q925", q925),
    ):
        return predire(**kwargs)


# ── calcul prix total ─────────────────────────────────────────────────────────

class TestCalculPrix:

    def test_prix_total_egal_m2_fois_surface(self):
        result = _run(prix_m2_modele=10_000.0, surface_m2=65.0)
        assert result["predicted_price"] == pytest.approx(650_000.0, rel=1e-3)

    def test_prix_par_m2_retourne(self):
        result = _run(prix_m2_modele=8_500.0)
        assert result["price_per_m2"] == pytest.approx(8_500.0, rel=1e-3)

    def test_fourchette_15pct(self):
        """Sans modèles quantile (None), fallback ±15%."""
        result = _run(prix_m2_modele=10_000.0, surface_m2=60.0, q075=None, q925=None)
        prix = result["predicted_price"]
        assert result["confidence_interval"]["lower"] == pytest.approx(prix * 0.85, rel=1e-3)
        assert result["confidence_interval"]["upper"] == pytest.approx(prix * 1.15, rel=1e-3)

    def test_fourchette_quantile_avec_modeles(self):
        """Avec modèles quantile injectés, la fourchette vient d'eux (q7.5–q92.5)."""
        q075 = SimpleNamespace(predict=lambda X: [8_000.0])
        q925 = SimpleNamespace(predict=lambda X: [12_000.0])
        result = _run(prix_m2_modele=10_000.0, surface_m2=60.0, q075=q075, q925=q925)
        assert result["confidence_interval"]["lower"] == pytest.approx(480_000.0, rel=1e-3)
        assert result["confidence_interval"]["upper"] == pytest.approx(720_000.0, rel=1e-3)

    def test_retourne_code_commune(self):
        result = _run()
        assert "code_commune" in result

    def test_retourne_reliability_float(self):
        result = _run()
        assert "reliability" in result
        assert isinstance(result["reliability"], float)
        assert 0.30 <= result["reliability"] <= 0.95

    def test_reliability_depuis_quantile_range(self):
        """La fiabilité doit être calculée depuis l'écart quantile, pas figée."""
        q075_large = SimpleNamespace(predict=lambda X: [5_000.0])
        q925_large = SimpleNamespace(predict=lambda X: [15_000.0])
        q075_tight = SimpleNamespace(predict=lambda X: [9_500.0])
        q925_tight = SimpleNamespace(predict=lambda X: [10_500.0])
        result_large = _run(prix_m2_modele=10_000.0, surface_m2=60.0, q075=q075_large, q925=q925_large)
        result_tight = _run(prix_m2_modele=10_000.0, surface_m2=60.0, q075=q075_tight, q925=q925_tight)
        assert result_tight["reliability"] > result_large["reliability"]

    def test_low_inferieur_a_prix_inferieur_a_high(self):
        result = _run(prix_m2_modele=9_000.0, surface_m2=80.0)
        assert result["confidence_interval"]["lower"] < result["predicted_price"]
        assert result["predicted_price"] < result["confidence_interval"]["upper"]

    def test_model_est_lgbm(self):
        result = _run()
        assert result["model"] == "lgbm"


# ── assemblage des features ───────────────────────────────────────────────────

class TestAssemblageFeatures:

    def test_surface_moyenne_piece_calculee(self):
        """surface_moyenne_piece = surface / nb_pieces — doit être dans le DataFrame."""
        frames = []

        class CapturePredicteur:
            def predict(self, X):
                frames.append(X.copy())
                return [8_000.0]

        with (
            patch.object(predict_module, "_MODEL", CapturePredicteur()),
            patch.object(predict_module, "_CATEGORIES", {}),
        ):
            predire(**FEATURES_BASE)

        assert len(frames) == 1
        X = frames[0]
        assert "surface_moyenne_piece" in X.columns
        assert X["surface_moyenne_piece"].iloc[0] == pytest.approx(
            FEATURES_BASE["surface_m2"] / FEATURES_BASE["nb_pieces"]
        )

    def test_surface_moyenne_piece_nb_pieces_zero(self):
        """nb_pieces=0 ne doit pas lever ZeroDivisionError."""
        result = _run(nb_pieces=0.0)
        assert result["predicted_price"] > 0

    def test_categories_appliquees(self):
        """Les colonnes catégorielles doivent avoir le dtype category."""
        frames = []

        class CapturePredict:
            def predict(self, X):
                frames.append(X.copy())
                return [8_000.0]

        cats = {"code_type_local": ["1", "2"], "code_departement": ["75", "92", "93"]}
        with (
            patch.object(predict_module, "_MODEL", CapturePredict()),
            patch.object(predict_module, "_CATEGORIES", cats),
        ):
            predire(**FEATURES_BASE)

        X = frames[0]
        assert X["code_type_local"].dtype.name == "category"
        assert X["code_departement"].dtype.name == "category"

    def test_a_terrain_false_transmis(self):
        frames = []

        class CapturePredict:
            def predict(self, X):
                frames.append(X.copy())
                return [8_000.0]

        with (
            patch.object(predict_module, "_MODEL", CapturePredict()),
            patch.object(predict_module, "_CATEGORIES", {}),
        ):
            predire(**{**FEATURES_BASE, "a_terrain": False})

        assert bool(frames[0]["a_terrain"].iloc[0]) is False

    def test_a_terrain_true_transmis(self):
        frames = []

        class CapturePredict:
            def predict(self, X):
                frames.append(X.copy())
                return [8_000.0]

        with (
            patch.object(predict_module, "_MODEL", CapturePredict()),
            patch.object(predict_module, "_CATEGORIES", {}),
        ):
            predire(**{**FEATURES_BASE, "a_terrain": True})

        assert bool(frames[0]["a_terrain"].iloc[0]) is True


# ── cas limites ───────────────────────────────────────────────────────────────

class TestCasLimites:

    def test_petite_surface(self):
        result = _run(prix_m2_modele=12_000.0, surface_m2=10.0)
        assert result["predicted_price"] == pytest.approx(120_000.0, rel=1e-3)

    def test_grande_surface(self):
        result = _run(prix_m2_modele=5_000.0, surface_m2=500.0)
        assert result["predicted_price"] == pytest.approx(2_500_000.0, rel=1e-3)

    def test_departement_banlieue(self):
        """Un département 93 doit produire un résultat sans erreur."""
        result = _run(code_departement="93", prix_m2_modele=5_600.0, surface_m2=55.0)
        assert result["predicted_price"] == pytest.approx(308_000.0, rel=1e-3)

    def test_type_maison(self):
        result = _run(code_type_local="1", prix_m2_modele=6_000.0, surface_m2=120.0)
        assert result["predicted_price"] == pytest.approx(720_000.0, rel=1e-3)
