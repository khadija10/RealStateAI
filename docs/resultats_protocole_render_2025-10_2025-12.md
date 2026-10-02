# Résultats du protocole — test 2025-10 → 2025-12

Protocole : [`protocole_evaluation.md`](protocole_evaluation.md) · mesuré le 2026-10-02T22:39:29 · commit `831b610`

| Jeu | Période | Ventes |
|---|---|---:|
| Entraînement | 2021-02 → 2025-06 | 632,393 |
| Validation (arrêt anticipé) | 2025-07 → 2025-09 | 36,181 |
| Test (mesure unique) | 2025-10 → 2025-12 | 31,696 |

Arbres retenus sur la validation : 550.

## Objectif global

| Critère | Seuil fixé | Mesuré | Résultat |
|---|---:|---:|---|
| Part à ±10 % | ≥ 50 % | 44.1 % | **non atteint** |
| Part à ±20 % | ≥ 80 % | 72.9 % | **non atteint** |

**Objectif global : non atteint.** MAPE : 16.98 %.

Mesure complémentaire, sans le filtre d'outliers ML (addendum 6 bis) : 32,153 ventes, MAPE 18.86 %, 43.4 % à ±10 %, 71.9 % à ±20 %.

## Classement des communes

| Classe | Communes | Part des ventes de test | MAPE dans la classe |
|---|---:|---:|---:|
| Fiable (≤ 10 %) | 3 | 0.5 % | 9.03 % |
| Indicative (10–20 %) | 219 | 72.5 % | 16.1 % |
| À compléter (> 20 %) | 38 | 9.2 % | 22.03 % |
| Données insuffisantes (< 30 ventes) | 850 | 17.8 % | 18.16 % |
