"""Métriques d'évaluation du modèle de prix immobilier."""

import numpy as np


def calculer_metriques(y_true_m2, y_pred_m2, prix_total_reel, prix_total_pred) -> dict:
    # Métriques sur prix/m²
    mae_m2 = np.mean(np.abs(y_true_m2 - y_pred_m2))
    mape_m2 = np.mean(np.abs((y_true_m2 - y_pred_m2) / y_true_m2)) * 100
    rmse_m2 = np.sqrt(np.mean((y_true_m2 - y_pred_m2) ** 2))
    r2_m2 = 1 - np.sum((y_true_m2 - y_pred_m2) ** 2) / np.sum((y_true_m2 - np.mean(y_true_m2)) ** 2)

    # Métriques sur prix total
    mae_total = np.mean(np.abs(prix_total_reel - prix_total_pred))
    mape_total = np.mean(np.abs((prix_total_reel - prix_total_pred) / prix_total_reel)) * 100

    # % de prédictions dans la fourchette ±10% et ±20%
    erreur_relative = np.abs((prix_total_reel - prix_total_pred) / prix_total_reel)
    dans_10pct = np.mean(erreur_relative <= 0.10) * 100
    dans_20pct = np.mean(erreur_relative <= 0.20) * 100

    return {
        "mae_m2": round(mae_m2, 2),
        "mape_m2": round(mape_m2, 2),
        "rmse_m2": round(rmse_m2, 2),
        "r2_m2": round(r2_m2, 4),
        "mae_total": round(mae_total, 0),
        "mape_total": round(mape_total, 2),
        "dans_10pct": round(dans_10pct, 1),
        "dans_20pct": round(dans_20pct, 1),
    }


def afficher_rapport(m: dict):
    print("\n" + "=" * 50)
    print("RÉSULTATS — Test 2025")
    print("=" * 50)
    print(f"  Prix/m²   — MAE  : {m['mae_m2']:>8.0f} €/m²")
    print(f"  Prix/m²   — MAPE : {m['mape_m2']:>8.1f} %")
    print(f"  Prix/m²   — R²   : {m['r2_m2']:>8.4f}")
    print(f"  Prix total— MAE  : {m['mae_total']:>8,.0f} €")
    print(f"  Prix total— MAPE : {m['mape_total']:>8.1f} %")
    print(f"  Dans ±10% : {m['dans_10pct']:>5.1f}%  |  Dans ±20% : {m['dans_20pct']:>5.1f}%")
    print("=" * 50)
