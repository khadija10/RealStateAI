# BACKLOG — RealEstateAI v1.3

> Éléments identifiés comme manquants en v1.2. À prioriser pour la prochaine itération.
> Mis à jour le 25 septembre 2026.

---

## PRIORITÉ HAUTE

### ✅ CI/CD GitHub Actions — modèle ML
- **Responsable** : Kadiatou — **FAIT** (`.github/workflows/ml_cicd.yml`)
- Sur push main : pytest → gate MAPE → build Docker → push Docker Hub → redéploiement Render
- Secrets à configurer : `DOCKER_HUB_USERNAME`, `DOCKER_HUB_TOKEN`, `RENDER_DEPLOY_HOOK_URL`

### ✅ Monitoring production modèle
- **Responsable** : Kadiatou — **FAIT** (`ml/monitoring.py` + `.github/workflows/monitoring.yml`)
- Cron hebdomadaire (lundi 7h UTC) — MAPE sur transactions récentes
- Alerte automatique via issue GitHub si MAPE > 25 %

### ✅ Réentraînement automatique DVF
- **Responsable** : Kadiatou — **FAIT** (`.github/workflows/retrain.yml`)
- Cron annuel 1er mai (DVF N-1 disponible)
- Pipeline complet : téléchargement → gold parquet → entraînement → gate MAPE < 22 % → Docker → Render
- Validation humaine requise avant déploiement (GitHub Environment `production`)

### ✅ Base de données PostgreSQL
- **Responsable** : Akram (Backend) — **FAIT**
- SQLite par défaut, PostgreSQL via `docker-compose.postgres.yml`
- Historique des estimations avec isolation par utilisateur
- Docker Compose opérationnel en un seul `docker compose up`

---

## PRIORITÉ MOYENNE

### ✅ Filtre géographique IDF
- **Responsable** : Kadiatou — **FAIT** (`Backend/main.py`)
- Rejet 422 si code département hors {75, 77, 78, 91, 92, 93, 94, 95}
- Heuristique sur noms de communes hors IDF connus (Lyon, Marseille, Bordeaux…)

### ✅ Arrondissements Paris (20 codes INSEE)
- **Responsable** : Skander (Data) — **FAIT**
- ML : `arrondissement` (feature numérique) + `code_commune` (catégorielle) dans `config.yaml` et `gold.py`
- Carte choroplèthe : GeoJSON arrondissements via `geo.api.gouv.fr?type=arrondissement-municipal`

### DPE (Diagnostic de Performance Énergétique)
- **Responsable** : Skander (Data)
- Feature haute valeur depuis réforme 2021 (forte corrélation DPE F/G → décote prix)
- Source : data.ademe.fr (base DPE nationale, API publique)
- Jointure sur adresse BAN

### ✅ Export PDF fiche d'estimation
- **Responsable** : Yougarten (Frontend) — **FAIT**
- Bouton "Télécharger PDF" dans le ResultPanel via `window.print()` + CSS `@media print`
- Fiche : estimation, fourchette de confiance, modèle, date

---

## PRIORITÉ BASSE

### ✅ Tests de régression modèle ML
- **Responsable** : Kadiatou — **FAIT** (`ml/tests/test_regression_model.py`)
- Gate MAPE ≤ 25 %, R² ≥ 0,70, dans_20pct ≥ 60 % sur sample de référence
- 4 cas de référence IDF avec tolérance ±35 % (smoke test)
- Intégré dans le CI/CD (job `test-model-regression`)

### ✅ Tests E2E frontend
- **Responsable** : Kadiatou — **FAIT**
- Cypress — 23 tests sur estimation, auth, historique
- API mockée via `cy.intercept()` → CI sans backend

### ✅ Tests unitaires backend complets
- **Responsable** : Akram — **FAIT**
- `test_auth.py` : 19 tests (register, login, me, historique par user)
- Tests existants : estimation, santé, communes

### ✅ Historique des estimations côté utilisateur
- **Responsable** : Yougarten + Akram — **FAIT**
- SQLite avec isolation par `user_id` (JWT) ou session anonyme
- Pagination 5 items, comparaison side-by-side de 2 biens

### ✅ Authentification
- **Responsable** : équipe — **FAIT** (hors scope → livré)
- JWT 7 jours, register/login/me, gate sur estimation et onglets protégés
- Rate limiting : 5/min login, 3/min register (via `slowapi`)

---

## RÉSUMÉ

| Item | Priorité | Qui | Statut |
|------|----------|-----|--------|
| CI/CD ML | Haute | Kadiatou | ✅ Fait |
| Monitoring drift | Haute | Kadiatou | ✅ Fait |
| Réentraînement auto | Haute | Kadiatou | ✅ Fait |
| PostgreSQL / historique | Haute | Akram | ✅ Fait |
| Filtre géo IDF | Moyenne | Kadiatou | ✅ Fait |
| Arrondissements Paris | Moyenne | Skander | ✅ Fait |
| DPE | Moyenne | Skander | À faire |
| Export PDF | Moyenne | Yougarten | ✅ Fait |
| Tests régression ML | Basse | Kadiatou | ✅ Fait |
| Tests E2E frontend | Basse | Kadiatou | ✅ Fait |
| Tests unitaires backend | Basse | Akram | ✅ Fait |
| Historique utilisateur | Basse | Yougarten + Akram | ✅ Fait |
| Authentification | Hors scope | équipe | ✅ Fait |
