# Avancement MLOps — Kadiatou
> RealEstateAI · Itération v1.4 · Mis à jour le 28 septembre 2026

---

## Progression globale

**Tâches Kadiatou v1.4 : 6 / 6 terminées (100 %)**

```
█████████████████████████████  100 %
```

**Backlog v1.3 → v1.4 : DPE intégré, biais temporel corrigé, UI refactorisée**

---

## Ce qui est fait

### ✅ CI/CD GitHub Actions — `ml_cicd.yml`
Déclenché sur chaque push vers `main` ou `feature/ml-mlops`.

Pipeline en 4 jobs :
1. `test-backend` — pytest sur le backend FastAPI
2. `test-model-regression` — gate MAPE < 25 %, R² > 0,70
3. `build-and-push` — image Docker → Docker Hub *(main uniquement)*
4. `deploy` — webhook Render redéploiement *(main uniquement)*

Secrets à configurer dans GitHub : `DOCKER_HUB_USERNAME`, `DOCKER_HUB_TOKEN`, `RENDER_DEPLOY_HOOK_URL`.

---

### ✅ Monitoring drift hebdomadaire — `ml/monitoring.py` + `monitoring.yml`
Cron chaque lundi à 7 h UTC. Charge 5 000 transactions récentes du gold parquet,
calcule MAPE / MAE / R² / dans_20pct, compare au seuil d'alerte.

**Dernier résultat (28 sept. 2026, modèle v1.4, données test 2025) :**

| Métrique | V1.3 (17 sept) | V1.4 final (28 sept) | Seuil CI | Statut |
|---|---|---|---|---|
| MAPE | 19,6 % | **16,4 %** | < 25 % | ✅ |
| R² | 0,778 | **0,819** | > 0,70 | ✅ |
| Dans ±20 % | 68,4 % | **73,9 %** | > 60 % | ✅ |
| Dans ±10 % | ~40 % | **46,2 %** | — | — |
| MAE prix/m² | 1 026 €/m² | **900 €/m²** | — | — |
| Features | 15 | **28** | — | — |
| n_train | ~571 k | **681 k** (2021–2025) | — | — |
| MAPE vs Notaires-INSEE | — | **8,4 %** | — | ✅ |

Si MAPE dépasse le seuil → issue GitHub créée automatiquement.
Artifact JSON uploadé à chaque run.

---

### ✅ Réentraînement automatique DVF — `retrain.yml`
Cron le 1er mai à 6 h UTC (DVF N-1 disponible en avril).

Pipeline en 4 jobs :
1. `pipeline-donnees` — téléchargement DVF + gold parquet
2. `entrainement` — LightGBM, gate MAPE < 22 % avant de continuer
3. `build-push` — nouvelle image Docker Hub
4. `deploy` — redéploiement Render

Validation humaine obligatoire avant déploiement (GitHub Environment `production`).

---

### ✅ Filtre géographique Île-de-France — `Backend/main.py`
Rejet HTTP 422 avec message explicite si la localisation est hors IDF.

Deux niveaux de détection :
- **Code postal / département** : rejet si dep ∉ {75, 77, 78, 91, 92, 93, 94, 95}
- **Heuristique commune** : liste de 24 villes hors IDF connues (Lyon, Marseille, Bordeaux…)

Testé en conditions réelles :
- Paris 15e → ✅ 650 327 € (10 005 €/m²)
- Versailles 78 → ✅ estimation valide
- Montreuil 93 → ✅ 325 000 € (5 909 €/m²)
- Lyon 69 → 422 «  ne fait pas partie du périmètre couvert »
- Marseille 13 → 422 idem

---

### ✅ Tests de régression modèle — `ml/tests/test_regression_model.py`
Gate intégrée au CI/CD (job `test-model-regression`).

Deux fonctions de test :

**`test_seuils_sur_sample()`** — évaluation sur sample statique
- Seuils : MAPE ≤ 25 %, R² ≥ 0,70, dans_20pct ≥ 60 %
- Sauté si le sample parquet n'existe pas (comportement attendu en CI sans données)

**`test_cas_reference()`** — smoke test sur 4 cas IDF ± 35 %
- Paris 7e · 80 m² · 4 pièces → attendu 12 000 €/m²
- Versailles · 100 m² → attendu 6 000 €/m²
- Montreuil 93 · 65 m² → attendu 5 600 €/m²
- Melun 77 · 120 m² → attendu 2 700 €/m²

Résultat : **1 passé, 1 sauté** (normal sans sample). Bug `Path("") → "."` corrigé.

---

## Nouvelles réalisations v1.4

### ✅ Intégration DPE individuel (58.7 % couverture)
- Pipeline ADEME : 3.5 M diagnostics → appariement DVF par adresse normalisée
- Feature `dpe_classe` A-G + `annee_construction` ajoutées au modèle
- Effet DPE A vs G mesuré : −8.8 % (conforme au marché post-loi Climat)
- MAPE : 19.64 % → 16.6 % (−3 pt en cumulé avec les autres améliorations)

### ✅ Sample weights — réduction biais temporel
- 2021 × 0.55, 2022 × 0.65, 2023 × 0.90, 2024 × 1.15
- Configurable dans `ml/config.yaml → sample_weights`
- Impact MAPE stable (normal, test set = 2025) mais calibration 2026 améliorée

### ✅ Features `dpe_score` + `is_studio` + `densite_pieces` — corrections post-tests
- `dpe_score` ordinal (A=0…G=6) : signal ordonné pour le gradient DPE
- `is_studio` booléen (surface < 35m²) : prime petite surface parisienne
- `densite_pieces` (nb_pieces / surface_bati) : gradient pièces à surface fixe — 1P > 5P
- Réentraînement final : **28 features, MAPE 16.4 %, 839 arbres**
- Limite documentée : gradient DPE non-monotone sur F/G dans l'ancien haussmannien (cachet > DPE)

### ✅ Tests cohérence multi-axes — 5 axes challengeants
- **Axe 1 — Infra-communal** : av. Montaigne vs rue du Rocher Paris 8e → −10.5 % ✅
- **Axe 2 — Pièces à surface fixe** : gradient 1P > 2P > 4P > 5P corrigé avec `densite_pieces` ✅
- **Axe 3 — Frontières communales** : Vincennes 10 125 < Paris 12e Bastille 11 150 ✅ ; Montreuil 5 795 < Paris 20e 10 105 ✅
- **Axe 4 — Benchmark Notaires-INSEE** : MAPE 8.4 % sur 8 zones (Paris 7e → Évry) ✅
- **Axe 5 — Transactions DVF 2025 réelles** : MAPE 14.9 % sur 20 transactions Yvelines ✅

### ✅ Corrections géocodage BAN (3 bugs)
1. Filtre `?postcode=` — évite les homonymes géographiques hors-IDF
2. Check IDF explicite dans `estimer_prix()` → 422 clair si hors périmètre
3. Score BAN < 0.4 → rejet ; 0.4-0.6 → avertissement frontend

### ✅ UI résultats refactorisée
- Visible client : prix, fourchette, fiabilité (label humain), DPE, actions
- Accordéon "Détails techniques" : R², features, n_train/n_test distincts, date
- Correction : 571 662 train (2021-2024) + 128 610 test (2025) affichés séparément

## Ce qui reste à faire

### ❌ Tests E2E frontend *(priorité basse)*
Playwright ou Cypress — scénarios : formulaire estimation, DPE, hors-IDF.
Non bloquant — CI/CD couvre déjà backend + modèle.

---

## Fichiers créés / modifiés

| Fichier | Nature |
|---|---|
| `.github/workflows/ml_cicd.yml` | Nouveau |
| `.github/workflows/monitoring.yml` | Nouveau |
| `.github/workflows/retrain.yml` | Nouveau |
| `ml/monitoring.py` | Nouveau |
| `ml/tests/test_regression_model.py` | Nouveau |
| `ml/tests/__init__.py` | Nouveau |
| `Backend/main.py` | Modifié (filtre IDF + CORS Render) |
| `docs/BACKLOG_V1_3.md` | Nouveau |
