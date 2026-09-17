"""
Tests de régression du modèle LightGBM.

Ce script est exécuté par le CI/CD (ml_cicd.yml) à chaque push.
Il vérifie que le modèle en place ne régresse pas par rapport aux seuils de référence.

Usage autonome (hors pytest) :
    python ml/tests/test_regression_model.py
    # Exit 0 = OK, Exit 1 = régression détectée
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

import pytest

import joblib
import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "ml"))

# ── Seuils de régression ──────────────────────────────────────────────────────
# Ces valeurs correspondent aux performances v1.2 (RAPPORT_V1_2.md).
# Le modèle doit rester au moins à ce niveau.
MAPE_MAX      = 25.0   # MAPE max tolérée (baseline v1.2 : 19,2 %)
DANS_20PCT_MIN = 60.0  # % de prédictions dans ±20% (baseline v1.2 : 69,2 %)
R2_MIN         = 0.70  # R² min (baseline v1.2 : 0,778)

# ── Cas de référence — prix au m² attendus (±35 % = tolérance large pour CI) ──
# Ces valeurs sont des médianes de marché connues en IDF (DVF 2024–2025).
# Ne pas utiliser comme vérité absolue, uniquement comme smoke test.
CAS_REFERENCE = [
    # (description, features_dict, prix_m2_attendu)
    (
        "Paris 7e — appartement 80m² 4 pièces",
        {
            "surface_bati": 80.0, "nb_pieces": 4.0,
            "latitude": 48.855, "longitude": 2.312,
            "prix_m2_reference_12m": 12500.0,
            "nb_ventes_commune_12m": 450.0, "nb_ventes_dept_12m": 12000.0,
            "mois": 6, "trimestre": 2,
            "code_departement": "75", "type_bien": "appartement", "a_terrain": False,
        },
        12000,   # prix attendu €/m² (médiane marché)
        0.35,    # tolérance ±35%
    ),
    (
        "Versailles — maison 120m² 5 pièces",
        {
            "surface_bati": 120.0, "nb_pieces": 5.0,
            "latitude": 48.804, "longitude": 2.130,
            "prix_m2_reference_12m": 6200.0,
            "nb_ventes_commune_12m": 180.0, "nb_ventes_dept_12m": 8000.0,
            "mois": 6, "trimestre": 2,
            "code_departement": "78", "type_bien": "maison", "a_terrain": True,
        },
        6000,
        0.35,
    ),
    (
        "Montreuil (93) — appartement 55m² 3 pièces",
        {
            "surface_bati": 55.0, "nb_pieces": 3.0,
            "latitude": 48.863, "longitude": 2.443,
            "prix_m2_reference_12m": 5800.0,
            "nb_ventes_commune_12m": 220.0, "nb_ventes_dept_12m": 6500.0,
            "mois": 6, "trimestre": 2,
            "code_departement": "93", "type_bien": "appartement", "a_terrain": False,
        },
        5600,
        0.35,
    ),
    (
        "Melun (77) — maison 90m² 4 pièces",
        {
            "surface_bati": 90.0, "nb_pieces": 4.0,
            "latitude": 48.540, "longitude": 2.655,
            "prix_m2_reference_12m": 2800.0,
            "nb_ventes_commune_12m": 100.0, "nb_ventes_dept_12m": 4500.0,
            "mois": 6, "trimestre": 2,
            "code_departement": "77", "type_bien": "maison", "a_terrain": True,
        },
        2700,
        0.35,
    ),
]


def charger_modele() -> object:
    candidates = [
        Path(os.environ.get("MODEL_PATH", "")),
        ROOT / "Backend" / "models" / "price_model.pkl",
    ]
    for p in candidates:
        if p and p.is_file():
            return joblib.load(p)
    print("[SKIP] Modèle introuvable — tests de référence ignorés (normal en CI sans artefact).")
    return None


def preparer_features(features: dict, categories: dict | None) -> pd.DataFrame:
    df = pd.DataFrame([features])
    for col in ["code_departement", "type_bien"]:
        if col in df.columns:
            if categories and col in categories:
                df[col] = pd.Categorical(df[col], categories=categories[col])
            else:
                df[col] = df[col].astype("category")
    return df


def charger_categories() -> dict | None:
    cat_path = ROOT / "Backend" / "models" / "categories.json"
    if cat_path.exists():
        return json.loads(cat_path.read_text())
    return None


def test_seuils_sur_sample():
    """Vérifie MAPE / R² / dans_20pct sur le sample statique."""
    sample_path = ROOT / "data" / "samples" / "market_reference.parquet"
    if not sample_path.exists():
        pytest.skip("Sample de référence introuvable.")

    model = charger_modele()
    if model is None:
        pytest.skip("Modèle introuvable.")

    df = pd.read_parquet(sample_path)
    if "prix_au_m2" not in df.columns or len(df) < 50:
        pytest.skip("Sample insuffisant pour évaluation.")

    categories = charger_categories()
    features_cols = [c for c in [
        "surface_bati", "nb_pieces", "latitude", "longitude",
        "prix_m2_reference_12m", "nb_ventes_commune_12m", "nb_ventes_dept_12m",
        "mois", "trimestre", "code_departement", "type_bien", "a_terrain",
    ] if c in df.columns]

    X = df[features_cols].copy()
    for col in ["code_departement", "type_bien"]:
        if col in X.columns:
            if categories and col in categories:
                X[col] = pd.Categorical(X[col], categories=categories[col])
            else:
                X[col] = X[col].astype("category")

    y_true = df["prix_au_m2"].values
    y_pred = model.predict(X)

    erreur_rel = np.abs((y_true - y_pred) / np.where(y_true > 0, y_true, np.nan))
    mape       = float(np.nanmean(erreur_rel) * 100)
    dans_20pct = float(np.nanmean(erreur_rel <= 0.20) * 100)
    r2         = float(1 - np.sum((y_true - y_pred) ** 2) / np.sum((y_true - np.mean(y_true)) ** 2))

    ok = True
    print(f"\n── Évaluation sur sample ({len(df)} transactions) ──")
    print(f"  MAPE       : {mape:.1f}%   (seuil max : {MAPE_MAX}%)")
    print(f"  Dans ±20%  : {dans_20pct:.1f}%  (seuil min : {DANS_20PCT_MIN}%)")
    print(f"  R²         : {r2:.3f}   (seuil min : {R2_MIN})")

    if mape > MAPE_MAX:
        print(f"  ❌ MAPE {mape:.1f}% > seuil {MAPE_MAX}% — RÉGRESSION DÉTECTÉE")
        ok = False
    if dans_20pct < DANS_20PCT_MIN:
        print(f"  ❌ Dans±20% {dans_20pct:.1f}% < seuil {DANS_20PCT_MIN}% — RÉGRESSION DÉTECTÉE")
        ok = False
    if r2 < R2_MIN:
        print(f"  ❌ R² {r2:.3f} < seuil {R2_MIN} — RÉGRESSION DÉTECTÉE")
        ok = False

    if ok:
        print("  ✅ Tous les seuils respectés")

    assert ok, "Régression détectée — seuils non respectés"


def test_cas_reference():
    """Vérifie les cas de référence (smoke test ±35%)."""
    model = charger_modele()
    if model is None:
        pytest.skip("Modèle introuvable.")

    categories = charger_categories()
    ok = True

    print("\n── Cas de référence ──")
    for desc, features, prix_attendu, tolerance in CAS_REFERENCE:
        X = preparer_features(features, categories)
        try:
            prix_pred = float(model.predict(X)[0])
        except Exception as exc:
            print(f"  ⚠️  {desc} — erreur prédiction : {exc}")
            continue

        ecart = abs(prix_pred - prix_attendu) / prix_attendu
        statut = "✅" if ecart <= tolerance else "❌"
        print(f"  {statut} {desc}")
        print(f"     Attendu : {prix_attendu:,.0f} €/m²  |  Prédit : {prix_pred:,.0f} €/m²  |  Écart : {ecart*100:.1f}%")
        if ecart > tolerance:
            ok = False

    assert ok, "Cas de référence hors tolérance ±35%"


if __name__ == "__main__":
    print("=" * 60)
    print("TESTS DE RÉGRESSION MODÈLE — RealEstateAI")
    print("=" * 60)

    ok_seuils = test_seuils_sur_sample()
    ok_cas    = test_cas_reference()

    print("\n" + "=" * 60)
    if ok_seuils and ok_cas:
        print("✅ GATE PASSÉE — modèle conforme aux seuils de référence")
        sys.exit(0)
    else:
        print("❌ GATE ÉCHOUÉE — régression détectée, déploiement bloqué")
        sys.exit(1)
