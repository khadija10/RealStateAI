"""
Monitoring hebdomadaire du modèle LightGBM en production.

Usage :
    python ml/monitoring.py                         # rapport JSON stdout
    python ml/monitoring.py --output rapport.json   # + sauvegarde fichier
    python ml/monitoring.py --alert-threshold 25    # seuil MAPE (défaut 25 %)

Exit codes :
    0 — modèle sain
    1 — drift détecté (MAPE dépasse le seuil)
    2 — erreur d'exécution (données manquantes, modèle introuvable…)
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

import joblib
import numpy as np
import pandas as pd


# ── Chemins par défaut ────────────────────────────────────────────────────────
ROOT = Path(__file__).resolve().parent.parent
DEFAULT_MODEL   = ROOT / "Backend" / "models" / "price_model.pkl"
DEFAULT_GOLD    = ROOT / "data" / "processed" / "gold_transactions"
DEFAULT_SAMPLE  = ROOT / "data" / "samples" / "market_reference.parquet"
FEATURES_ORDER  = [
    "surface_bati", "nb_pieces", "latitude", "longitude",
    "prix_m2_reference_12m", "nb_ventes_commune_12m", "nb_ventes_dept_12m",
    "mois", "trimestre", "code_departement", "type_bien", "a_terrain",
]
CAT_FEATURES = ["code_departement", "type_bien"]


def charger_modele(model_path: Path):
    if not model_path.exists():
        print(f"[ERREUR] Modèle introuvable : {model_path}", file=sys.stderr)
        sys.exit(2)
    return joblib.load(model_path)


def charger_echantillon_recent(gold_path: Path, sample_path: Path, n: int = 5000) -> pd.DataFrame:
    """
    Charge un échantillon de transactions récentes (année la plus récente du gold parquet).
    Repli sur le sample statique si le gold n'est pas disponible (ex. CI sans données).
    """
    if gold_path.exists():
        annees = sorted(
            [d for d in gold_path.iterdir() if d.is_dir() and d.name.startswith("annee=")],
            key=lambda d: d.name,
            reverse=True,
        )
        if annees:
            df = pd.read_parquet(annees[0])
            return df.sample(min(n, len(df)), random_state=42)

    if sample_path.exists():
        df = pd.read_parquet(sample_path)
        return df.sample(min(n, len(df)), random_state=42)

    print("[ERREUR] Aucune donnée disponible (ni gold parquet ni sample).", file=sys.stderr)
    sys.exit(2)


def calculer_mape(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    mask = y_true > 0
    return float(np.mean(np.abs((y_true[mask] - y_pred[mask]) / y_true[mask])) * 100)


def preparer_features(df: pd.DataFrame) -> pd.DataFrame:
    present = [c for c in FEATURES_ORDER if c in df.columns]
    X = df[present].copy()
    for col in CAT_FEATURES:
        if col in X.columns:
            X[col] = X[col].astype("category")
    return X


def surveiller(
    model_path: Path = DEFAULT_MODEL,
    gold_path: Path = DEFAULT_GOLD,
    sample_path: Path = DEFAULT_SAMPLE,
    alert_threshold: float = 25.0,
    output_path: Path | None = None,
) -> dict:
    model = charger_modele(model_path)

    df = charger_echantillon_recent(gold_path, sample_path)

    # Filtre IDF
    if "code_departement" in df.columns:
        idf = {"75", "77", "78", "91", "92", "93", "94", "95"}
        df = df[df["code_departement"].astype(str).isin(idf)]

    if "prix_au_m2" not in df.columns or len(df) < 50:
        print("[ERREUR] Données insuffisantes pour le monitoring.", file=sys.stderr)
        sys.exit(2)

    X = preparer_features(df)
    y_true = df["prix_au_m2"].values
    y_pred = model.predict(X)

    mape = calculer_mape(y_true, y_pred)
    mae  = float(np.mean(np.abs(y_true - y_pred)))
    r2   = float(1 - np.sum((y_true - y_pred) ** 2) / np.sum((y_true - np.mean(y_true)) ** 2))

    erreur_rel = np.abs((y_true - y_pred) / np.where(y_true > 0, y_true, np.nan))
    dans_20pct = float(np.nanmean(erreur_rel <= 0.20) * 100)

    drift = mape > alert_threshold

    rapport = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "n_transactions": int(len(df)),
        "mape_pct":       round(mape, 2),
        "mae_eur_m2":     round(mae, 0),
        "r2":             round(r2, 4),
        "dans_20pct":     round(dans_20pct, 1),
        "seuil_alerte_pct": alert_threshold,
        "drift_detecte":  drift,
        "statut":         "⚠️ DRIFT DÉTECTÉ" if drift else "✅ MODÈLE SAIN",
    }

    print(json.dumps(rapport, ensure_ascii=False, indent=2))

    if output_path:
        output_path.write_text(json.dumps(rapport, ensure_ascii=False, indent=2))
        print(f"\nRapport sauvegardé : {output_path}", file=sys.stderr)

    return rapport


def main():
    parser = argparse.ArgumentParser(description="Monitoring drift modèle RealEstateAI")
    parser.add_argument("--model",            default=str(DEFAULT_MODEL))
    parser.add_argument("--gold",             default=str(DEFAULT_GOLD))
    parser.add_argument("--sample",           default=str(DEFAULT_SAMPLE))
    parser.add_argument("--alert-threshold",  type=float, default=25.0)
    parser.add_argument("--output",           default=None)
    args = parser.parse_args()

    rapport = surveiller(
        model_path=Path(args.model),
        gold_path=Path(args.gold),
        sample_path=Path(args.sample),
        alert_threshold=args.alert_threshold,
        output_path=Path(args.output) if args.output else None,
    )

    sys.exit(1 if rapport["drift_detecte"] else 0)


if __name__ == "__main__":
    main()
