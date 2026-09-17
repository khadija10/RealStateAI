# BACKLOG — RealEstateAI v1.3

> Éléments identifiés comme manquants en v1.2. À prioriser pour la prochaine itération.
> Mis à jour le 17 septembre 2026.

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

### Base de données PostgreSQL
- **Responsable** : Akram (Backend)
- Stocker l'historique des estimations (adresse, surface, type, résultat, timestamp)
- Journaliser les requêtes API (latence, erreurs, taux de succès)
- Permettre analyse rétrospective des estimations vs ventes réelles DVF

---

## PRIORITÉ MOYENNE

### ✅ Filtre géographique IDF
- **Responsable** : Kadiatou — **FAIT** (`Backend/main.py`)
- Rejet 422 si code département hors {75, 77, 78, 91, 92, 93, 94, 95}
- Heuristique sur noms de communes hors IDF connus (Lyon, Marseille, Bordeaux…)

### Arrondissements Paris (20 codes INSEE)
- **Responsable** : Skander (Data)
- Paris est actuellement une seule commune dans le modèle
- Découper en 20 entités distinctes améliorerait significativement la précision Paris intra-muros

### DPE (Diagnostic de Performance Énergétique)
- **Responsable** : Skander (Data)
- Feature haute valeur depuis réforme 2021 (forte corrélation DPE F/G → décote prix)
- Source : data.ademe.fr (base DPE nationale, API publique)
- Jointure sur adresse BAN

### Export PDF fiche d'estimation
- **Responsable** : Yougarten (Frontend)
- Fiche téléchargeable : estimation, fourchette, méthode, date, carte mini
- Utile pour les agents immobiliers

---

## PRIORITÉ BASSE

### ✅ Tests de régression modèle ML
- **Responsable** : Kadiatou — **FAIT** (`ml/tests/test_regression_model.py`)
- Gate MAPE ≤ 25 %, R² ≥ 0,70, dans_20pct ≥ 60 % sur sample de référence
- 4 cas de référence IDF avec tolérance ±35 % (smoke test)
- Intégré dans le CI/CD (job `test-model-regression`)

### Tests E2E frontend
- **Responsable** : Kadiatou
- Playwright ou Cypress — à implémenter
- Couvrir : formulaire estimation, carte des prix, tendances marché

### Tests unitaires backend complets
- **Responsable** : Akram (en support)
- Couverture actuelle partielle — compléter les endpoints non couverts

### Historique des estimations côté utilisateur
- **Responsable** : Yougarten (Frontend) + Akram (Backend)
- LocalStorage pour session courante
- PostgreSQL pour persistance longue durée

### Authentification
- **Hors scope v1.3** — aucun besoin métier identifié pour l'instant
- À reconsidérer si le produit passe en SaaS

---

## RÉSUMÉ

| Item | Priorité | Qui | Statut |
|------|----------|-----|--------|
| CI/CD ML | Haute | Kadiatou | ✅ Fait |
| Monitoring drift | Haute | Kadiatou | ✅ Fait |
| Réentraînement auto | Haute | Kadiatou | ✅ Fait |
| PostgreSQL / historique | Haute | Akram | À faire |
| Filtre géo IDF | Moyenne | Kadiatou | ✅ Fait |
| Arrondissements Paris | Moyenne | Skander | À faire |
| DPE | Moyenne | Skander | À faire |
| Export PDF | Moyenne | Yougarten | À faire |
| Tests régression ML | Basse | Kadiatou | ✅ Fait |
| Tests E2E frontend | Basse | Kadiatou | À faire |
| Tests unitaires backend | Basse | Akram | À faire |
| Historique utilisateur | Basse | Yougarten + Akram | À faire |
| Authentification | Hors scope | — | — |
