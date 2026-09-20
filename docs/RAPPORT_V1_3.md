# RAPPORT DE VERSION — RealEstateAI v1.3

**Version v1.3 — Septembre 2026**  
**Branche : `development`**  
**Dépôt : https://github.com/khadija10/RealStateAI**

---

## 1. CONTEXTE ET OBJECTIF

Ce rapport documente les évolutions apportées à RealEstateAI entre la **version v1.2 (7 septembre 2026)** et la **version v1.3 (20 septembre 2026)**.

La v1.2 avait livré le modèle LightGBM (MAPE 19.2 %), le déploiement Render.com, et l'interface 3 onglets. La v1.3 consolide l'infrastructure MLOps, introduit la persistance des données, et étend le périmètre fonctionnel avec un moteur de financement immobilier.

---

## 2. TABLEAU DE BORD — V1.2 vs V1.3

| Axe | V1.2 (7 sept) | V1.3 (20 sept) |
|-----|---------------|----------------|
| **Modèle ML** | LightGBM — MAPE 19.2 % | LightGBM — MAPE 19.64 % (monitoring réel) |
| **CI/CD** | Manuel | **GitHub Actions — push → test → Docker → Render** |
| **Monitoring modèle** | Absent | **Cron hebdomadaire — alerte GitHub si drift > 25 %** |
| **Réentraînement** | Manuel | **Cron annuel 1er mai + gate MAPE < 22 % + validation humaine** |
| **Filtre géographique** | Absent (biens hors IDF acceptés) | **Rejet 422 si hors IDF, heuristique commune** |
| **Base de données** | Absente | **SQLite/PostgreSQL — historique des recherches** |
| **Financement** | Absent | **Moteur HCSF + agent conversationnel + dossier de prêt** |
| **Tests unitaires** | Partiels | **132 tests — 88 nouveaux (evaluate, predict, market, IDF, monitoring)** |
| **Tests E2E** | Absents | Absents (à faire) |
| **Arrondissements Paris** | Commune unique | Commune unique (à faire) |
| **DPE** | Absent | Absent (à faire) |
| **Export PDF** | Absent | Absent (à faire) |

---

## 3. DÉTAIL DES AMÉLIORATIONS

### 3.1 Pipeline CI/CD — GitHub Actions (Kadiatou)

Trois workflows automatisent le cycle de vie du modèle ML :

**`.github/workflows/ml_cicd.yml`** — déclenché sur chaque push `main`
1. `test-backend` : pytest sur tous les tests unitaires Backend
2. `test-model-regression` : gate MAPE ≤ 25 %, R² ≥ 0.70, dans_20pct ≥ 60 % — bloque le déploiement si le modèle régresse
3. `build-and-push` : build image Docker + push sur Docker Hub `khdj0/realestateai-backend`
4. `deploy-render` : redéploiement Render via webhook (main seulement)

**`.github/workflows/monitoring.yml`** — cron tous les lundis 7h UTC
- Calcule MAPE/MAE/R² sur les transactions gold récentes
- Ouvre une issue GitHub automatiquement si MAPE > 25 %

**`.github/workflows/retrain.yml`** — cron 1er mai (publication DVF N-1)
- Pipeline complet : téléchargement DVF → silver → gold → entraînement → gate MAPE < 22 %
- Gate échouée → déploiement bloqué automatiquement
- Gate passée → validation humaine requise (GitHub Environment `production`)
- Déploiement : nouveau tag Docker + redéploiement Render

---

### 3.2 Script de monitoring (`ml/monitoring.py`) — Kadiatou

Script standalone exécutable en CLI et en CI :

```
python ml/monitoring.py
→ {"mape_pct": 19.64, "r2": 0.7776, "dans_20pct": 68.4, "drift_detecte": false, "statut": "✅ MODÈLE SAIN"}
```

- Charge le gold parquet le plus récent (fallback sur sample statique)
- Filtre automatiquement les transactions hors IDF
- Exit 0 si sain, Exit 1 si drift détecté, Exit 2 si données insuffisantes (< 50 transactions)
- Sauvegarde un rapport JSON horodaté

**Bug corrigé :** les colonnes utilisées étaient `prix_au_m2` et `type_bien` — les vraies colonnes gold sont `prix_m2` et `code_type_local`. Le script était silencieusement aveugle.

---

### 3.3 Filtre géographique IDF (`Backend/main.py`) — Kadiatou

Tout bien soumis hors Île-de-France est rejeté en **422 Unprocessable Entity** avec un message explicite.

**Logique :**
1. Si `code_postal` fourni : extrait le code département → rejet si hors `{75, 77, 78, 91, 92, 93, 94, 95}`
2. Si commune seule : comparaison sur le nom normalisé complet contre une liste de villes hors IDF connues (Lyon, Marseille, Bordeaux, Nice, Toulouse, Strasbourg, Montpellier, Nantes…)

**Bug corrigé :** l'heuristique comparait `commune.split()[0]` (premier mot) au lieu du nom complet. "Saint-Étienne" → "saint" n'était pas dans la liste → passait le filtre. Corrigé en comparant le nom entier normalisé.

---

### 3.4 Base de données — historique des recherches (`Backend/database.py`) — Akram

Nouveau service `SearchHistoryService` — chaque estimation est automatiquement sauvegardée.

**Schéma :**
```sql
search_history (
    id           INTEGER PRIMARY KEY,
    query        TEXT,
    commune      TEXT,
    property_type TEXT,
    area_m2      REAL,
    estimated_price REAL,
    created_at   TEXT
)
```

- **SQLite** en développement (sans configuration)
- **PostgreSQL** en production (`DATABASE_URL` dans les variables d'environnement Render)
- Nouveau endpoint `GET /api/historique` — liste les recherches récentes
- Chaque appel à `/api/predictions/estimate` enregistre automatiquement le résultat

---

### 3.5 API de financement (`Backend/financing_api.py`) — Akram

Nouveau router FastAPI `POST /api/financing/...` qui intègre le moteur de règles HCSF de Skander.

- Reçoit un profil emprunteur (revenus, apport, charges, situation pro)
- Retourne capacité d'emprunt, budget max, plan de financement, score dossier
- Sessions conversationnelles en mémoire (`SESSIONS` dict) pour l'agent multi-tours

---

### 3.6 Moteur de financement immobilier (`financement/`) — Skander

Module Python autonome, installable via `pip install -e financement/[agent]`.

**Règles HCSF implémentées :**

| Règle | Valeur |
|-------|--------|
| Taux d'endettement max | 35 % assurance comprise |
| Durée maximale | 25 ans (27 en VEFA ou travaux ≥ 10 %) |
| Marge de dérogation | 20 % de la production trimestrielle |
| DMTO ancien | 6.32 % (5.81 % primo-accédants) |
| DMTO neuf (VEFA) | 0.715 % |

**Modules :**

| Fichier | Rôle |
|---------|------|
| `hcsf.py` | Calcul taux d'effort, conformité réglementaire |
| `budget.py` | Budget max atteignable frais compris |
| `pret.py` | Simulation mensualités, coût total crédit |
| `frais.py` | DMTO, émoluments notaire, garantie |
| `scoring.py` | Score dossier /100 par composantes |
| `dossier.py` | Génération dossier de prêt structuré |
| `agent.py` | Agent conversationnel multi-tours |
| `moteur.py` | Orchestration — point d'entrée principal |

Tous les paramètres sont dans `config/bareme.yaml` — aucune valeur codée en dur.

**Suite de tests :** 5 fichiers de tests (`test_agent.py`, `test_budget.py`, `test_dossier.py`, `test_moteur.py`, `test_outils.py`).

---

### 3.7 Tests unitaires — 88 nouveaux tests (Kadiatou)

| Fichier | Tests | Ce qui est vérifié |
|---------|-------|--------------------|
| `Backend/tests/test_idf_filter.py` | 21 | Filtre par département, noms de commune, cas limites |
| `ml/tests/test_monitoring.py` | 20 | Détection drift, seuils, filtre IDF, sauvegarde JSON |
| `ml/tests/test_evaluate.py` | 18 | MAPE, R², dans_10/20pct, structure du dict |
| `ml/tests/test_predict.py` | 14 | Prix total = prix/m² × surface, fourchette ±15%, features |
| `Backend/tests/test_market.py` | 15 | `/market/map`, `/market/trends`, filtre dept, 503 si absent |

**Résultat : 132 passés, 1 sauté, 0 échoué.**

---

## 4. CORRECTIONS DE BUGS

| Bug | Impact | Fix |
|-----|--------|-----|
| `monitoring.py` colonnes `prix_au_m2` / `type_bien` | Monitoring aveugle — lisait des colonnes inexistantes | Corrigé → `prix_m2` / `code_type_local` |
| Filtre IDF `commune.split()[0]` | Saint-Étienne, Saint-Denis passaient le filtre | Corrigé → comparaison nom complet normalisé |
| `test_regression_model.py` — `Path("")` → `IsADirectoryError` | Test CI crashait au lieu de skiper | Corrigé → `p.is_file()` au lieu de `p.exists()` |

---

## 5. ARCHITECTURE v1.3

```
UTILISATEUR (Browser)
        │
        ▼
FRONTEND — React 18 + Vite + Tailwind (Nginx)
  ├── Estimation          (formulaire + confiance modèle)
  ├── Carte des prix      (Leaflet, 1 193 communes IDF)
  └── Tendances marché    (sparklines SVG 2021–2025)
        │
        ▼ JSON REST
BACKEND — FastAPI Python 3.12
  ├── POST /api/predictions/estimate   → LightGBM + BAN géocodage
  ├── GET  /api/market/map             → 1 193 communes stats
  ├── GET  /api/market/trends          → 480 points mensuels
  ├── GET  /api/historique             → historique des recherches  [NOUVEAU]
  ├── POST /api/financing/...          → moteur HCSF               [NOUVEAU]
  └── GET  /api/health
        │
        ├──► ml/predict.py       → LightGBM (709k transactions)
        ├──► ml/monitoring.py    → drift detection
        ├──► Backend/database.py → SQLite / PostgreSQL             [NOUVEAU]
        └──► financement/        → moteur règles HCSF              [NOUVEAU]

Infrastructure :
  ├── Docker Compose (dev) — backend + frontend
  ├── Render.com (prod)    — backend Docker + frontend static + PostgreSQL
  └── GitHub Actions       — CI/CD + monitoring + réentraînement annuel
```

---

## 6. MÉTRIQUES MODÈLE — MONITORING RÉEL (17 sept 2026)

| Métrique | V1.2 (test set) | V1.3 (monitoring prod) |
|----------|----------------|------------------------|
| MAPE prix/m² | 19.2 % | **19.64 %** |
| R² | 0.778 | **0.7776** |
| Prédictions dans ±20 % | 69.2 % | **68.4 %** |
| Drift détecté | — | **Non** |
| Statut | — | **✅ MODÈLE SAIN** |

Légère dégradation par rapport au test set (données 2025 vs monitoring récent) — dans les tolérances normales, pas de drift.

---

## 7. BACKLOG v1.3 — BILAN

| Item | Priorité | Responsable | Statut |
|------|----------|-------------|--------|
| CI/CD ML | Haute | Kadiatou | ✅ Fait |
| Monitoring drift | Haute | Kadiatou | ✅ Fait |
| Réentraînement auto | Haute | Kadiatou | ✅ Fait |
| PostgreSQL / historique | Haute | Akram | ✅ Fait |
| Filtre géo IDF | Moyenne | Kadiatou | ✅ Fait |
| Tests unitaires backend | Basse | Kadiatou | ✅ Fait (88 tests) |
| Tests régression ML | Basse | Kadiatou | ✅ Fait |
| Arrondissements Paris | Moyenne | Skander | ❌ À faire |
| DPE | Moyenne | Skander | ❌ À faire |
| Export PDF | Moyenne | Yougarten | ❌ À faire |
| Historique frontend | Basse | Yougarten | ❌ À faire |
| Tests E2E frontend | Basse | Kadiatou | ❌ À faire |

**Score : 8/12 (67 %) — contre 5/12 au 17 septembre.**

---

## 8. ÉVOLUTIONS ENVISAGÉES (V1.4)

1. **Arrondissements Paris** (Skander) — 20 codes INSEE distincts au lieu d'une seule commune
2. **DPE** (Skander) — feature corrélée au prix depuis la réforme 2021, source data.ademe.fr
3. **Export PDF** (Yougarten) — fiche estimation téléchargeable pour agents immobiliers
4. **Historique frontend** (Yougarten) — affichage des estimations précédentes côté utilisateur
5. **Tests E2E** (Kadiatou) — Playwright sur formulaire, carte, tendances
6. **Intégration financement → frontend** — afficher la capacité d'emprunt en regard de l'estimation

---

*Rapport rédigé le 20 septembre 2026 — Version v1.3*  
*Dépôt : https://github.com/khadija10/RealStateAI — Branche : development*  
*Application : https://realestateai-frontend.onrender.com*
