# Résultats du protocole — test 2025-10 → 2025-12

Protocole : [`protocole_evaluation.md`](protocole_evaluation.md) · mesuré le 2026-10-02T21:48:58 · commit `fb413ff`

| Jeu | Période | Ventes |
|---|---|---:|
| Entraînement | 2021-02 → 2025-06 | 632,393 |
| Validation (arrêt anticipé) | 2025-07 → 2025-09 | 36,181 |
| Test (mesure unique) | 2025-10 → 2025-12 | 31,696 |

Arbres retenus sur la validation : 1617.

## Objectif global

| Critère | Seuil fixé | Mesuré | Résultat |
|---|---:|---:|---|
| Part à ±10 % | ≥ 50 % | 50.2 % | atteint |
| Part à ±20 % | ≥ 80 % | 78.0 % | **non atteint** |

**Objectif global : non atteint.** MAPE : 14.91 %.

Mesure complémentaire, sans le filtre d'outliers ML (addendum 6 bis) : 32,153 ventes, MAPE 16.63 %, 49.4 % à ±10 %, 76.9 % à ±20 %.

## Classement des communes

| Classe | Communes | Part des ventes de test | MAPE dans la classe |
|---|---:|---:|---:|
| Fiable (≤ 10 %) | 15 | 3.3 % | 8.55 % |
| Indicative (10–20 %) | 232 | 75.9 % | 14.6 % |
| À compléter (> 20 %) | 13 | 3.1 % | 21.47 % |
| Données insuffisantes (< 30 ventes) | 850 | 17.8 % | 16.25 % |
