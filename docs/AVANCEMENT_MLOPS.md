# Avancement MLOps — Kadiatou
> RealEstateAI · Itération v1.3 · Mis à jour le 17 septembre 2026

---

## Progression globale

**Tâches Kadiatou : 5 / 6 terminées (83 %)**

```
████████████████████████░░░  83 %
```

**Backlog v1.3 toutes priorités confondues : 5 / 12 terminées (42 %)**
Les 7 restantes appartiennent aux autres membres ou sont basse priorité.

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

**Dernier résultat (17 sept. 2026, données 2025) :**

| Métrique | Valeur | Seuil | Statut |
|---|---|---|---|
| MAPE | 19,6 % | < 25 % | ✅ |
| R² | 0,778 | > 0,70 | ✅ |
| Dans ±20 % | 68,4 % | > 60 % | ✅ |
| MAE | 1 026 €/m² | — | — |

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

## Ce qui reste à faire

### ❌ Tests E2E frontend *(Kadiatou · priorité basse)*
Playwright ou Cypress à implémenter.
Scénarios à couvrir : formulaire estimation, carte des prix, tendances marché.
Non bloquant — le CI/CD couvre déjà backend + modèle.

---

## Ce qui reste pour l'équipe

| Item | Qui | Priorité |
|---|---|---|
| PostgreSQL — historique estimations | Akram | Haute |
| Arrondissements Paris (20 INSEE) | Skander | Moyenne |
| DPE (data.ademe.fr) | Skander | Moyenne |
| Export PDF fiche estimation | Yougarten | Moyenne |
| Tests unitaires backend complets | Akram | Basse |
| Historique utilisateur (frontend) | Yougarten + Akram | Basse |

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
