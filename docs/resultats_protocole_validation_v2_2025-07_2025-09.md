# Résultats du protocole — test 2025-07 → 2025-09

Protocole : [`protocole_evaluation.md`](protocole_evaluation.md) · mesuré le 2026-10-03T10:13:52 · commit `029b7c8`

| Jeu | Période | Ventes |
|---|---|---:|
| Entraînement | 2021-02 → 2025-03 | 602,107 |
| Validation (arrêt anticipé) | 2025-04 → 2025-06 | 30,286 |
| Test (mesure unique) | 2025-07 → 2025-09 | 36,181 |

Arbres retenus sur la validation : 1148.

## Objectif global

| Critère | Seuil fixé | Mesuré | Résultat |
|---|---:|---:|---|
| Part à ±10 % | ≥ 50 % | 50.9 % | atteint |
| Part à ±20 % | ≥ 80 % | 79.6 % | **non atteint** |

**Objectif global : non atteint.** MAPE : 14.09 %.

Mesure complémentaire, sans le filtre d'outliers ML (addendum 6 bis) : 36,537 ventes, MAPE 15.2 %, 50.4 % à ±10 %, 78.8 % à ±20 %.

## Classement des communes

| Classe | Communes | Part des ventes de test | MAPE dans la classe |
|---|---:|---:|---:|
| Fiable (≤ 10 %) | 41 | 7.0 % | 8.98 % |
| Indicative (10–20 %) | 234 | 75.5 % | 14.16 % |
| À compléter (> 20 %) | 9 | 1.4 % | 22.47 % |
| Données insuffisantes (< 30 ventes) | 841 | 16.1 % | 15.3 % |
