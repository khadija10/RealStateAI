# Résultats du protocole — test 2025-07 → 2025-09

Protocole : [`protocole_evaluation.md`](protocole_evaluation.md) · mesuré le 2026-10-03T10:15:50 · commit `029b7c8`

| Jeu | Période | Ventes |
|---|---|---:|
| Entraînement | 2021-02 → 2025-03 | 602,107 |
| Validation (arrêt anticipé) | 2025-04 → 2025-06 | 30,286 |
| Test (mesure unique) | 2025-07 → 2025-09 | 36,181 |

Arbres retenus sur la validation : 1450.

## Objectif global

| Critère | Seuil fixé | Mesuré | Résultat |
|---|---:|---:|---|
| Part à ±10 % | ≥ 50 % | 51.2 % | atteint |
| Part à ±20 % | ≥ 80 % | 79.5 % | **non atteint** |

**Objectif global : non atteint.** MAPE : 14.07 %.

Mesure complémentaire, sans le filtre d'outliers ML (addendum 6 bis) : 36,537 ventes, MAPE 15.17 %, 50.7 % à ±10 %, 78.8 % à ±20 %.

## Classement des communes

| Classe | Communes | Part des ventes de test | MAPE dans la classe |
|---|---:|---:|---:|
| Fiable (≤ 10 %) | 38 | 6.2 % | 8.85 % |
| Indicative (10–20 %) | 238 | 76.4 % | 14.09 % |
| À compléter (> 20 %) | 8 | 1.3 % | 22.71 % |
| Données insuffisantes (< 30 ventes) | 841 | 16.1 % | 15.27 % |
