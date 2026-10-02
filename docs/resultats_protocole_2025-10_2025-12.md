# Résultats du protocole — test 2025-10 → 2025-12

Protocole : [`protocole_evaluation.md`](protocole_evaluation.md) · mesuré le 2026-10-02T18:50:41 · commit `f425ff4`

| Jeu | Période | Ventes |
|---|---|---:|
| Entraînement | 2021-02 → 2025-06 | 632,395 |
| Validation (arrêt anticipé) | 2025-07 → 2025-09 | 36,181 |
| Test (mesure unique) | 2025-10 → 2025-12 | 31,696 |

Arbres retenus sur la validation : 447.

## Objectif global

| Critère | Seuil fixé | Mesuré | Résultat |
|---|---:|---:|---|
| Part à ±10 % | ≥ 50 % | 45.0 % | **non atteint** |
| Part à ±20 % | ≥ 80 % | 73.7 % | **non atteint** |

**Objectif global : non atteint.** MAPE : 16.71 %.

Mesure complémentaire, sans le filtre d'outliers ML (addendum 6 bis) : 32,153 ventes, MAPE 18.59 %, 44.3 % à ±10 %, 72.7 % à ±20 %.

## Classement des communes

| Classe | Communes | Part des ventes de test | MAPE dans la classe |
|---|---:|---:|---:|
| Fiable (≤ 10 %) | 5 | 0.8 % | 8.93 % |
| Indicative (10–20 %) | 221 | 72.9 % | 15.86 % |
| À compléter (> 20 %) | 34 | 8.5 % | 21.79 % |
| Données insuffisantes (< 30 ventes) | 850 | 17.8 % | 18.08 % |
