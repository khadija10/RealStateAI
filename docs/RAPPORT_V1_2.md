# RAPPORT DE VERSION — RealEstateAI v1.2

**Version v1.2 — Septembre 2026**  
**Branche : `feature/ml-mlops`**  
**Dépôt : https://github.com/khadija10/RealStateAI**

---

## 1. CONTEXTE ET OBJECTIF

Ce rapport documente les évolutions apportées à RealEstateAI entre le **prototype v1.0 (mars 2026)** et la **version v1.2 (septembre 2026)**.

Le prototype avait validé la faisabilité du pipeline complet DVF → API → interface, mais présentait des limites importantes : modèle ML inefficace (RandomForest, MAPE 182 %), granularité géographique limitée à la commune, absence de géolocalisation, et interface minimaliste. La version v1.2 traite ces limites de façon systématique.

---

## 2. TABLEAU DE BORD — PROTOTYPE vs V1.2

| Axe | Prototype v1.0 (mars 2026) | Version v1.2 (sept. 2026) |
|-----|---------------------------|--------------------------|
| **Modèle ML** | RandomForest — MAPE 182 % | LightGBM — MAPE **19.2 %** |
| **Référence statistique** | Médiane commune — MAPE 158.5 % | Médiane commune (fallback DVF) |
| **Données d'entraînement** | 257 354 transactions (2023–2024) | **709 669 transactions (2021–2025)** |
| **Années couvertes** | 2023–2024 | 2021–2025 (S1) |
| **Géolocalisation** | Aucune | **BAN (Base Adresse Nationale)** — lat/lon, code commune |
| **Features modèle** | commune + type + surface | + latitude, longitude, prix_m2_ref_12m, volumes dept, mois, trimestre, terrain |
| **Granularité estimation** | Commune | **Adresse exacte** (si fournie) |
| **Prédictions dans ±20 %** | ~18 % (estimé RF) | **69.2 %** |
| **Prédictions dans ±10 %** | — | 40.5 % |
| **R² (prix/m²)** | — | **0.778** |
| **Interface** | 1 page (formulaire + résultat) | **3 onglets** : Estimation · Carte des prix · Référence du marché |
| **Carte interactive** | Non | **Oui** — Leaflet, 1 193 communes, filtres département |
| **Tendances marché** | Non | **Oui** — sparklines 2021–2025 par département |
| **Confiance modèle affiché** | Non | **Oui** — MAPE, méthode, n transactions, dispersion |
| **Validation inputs** | Basique | Ratio surface/pièces, type requis, commune conditionnelle |
| **Docker / déploiement** | Fonctionnel (sans ML) | ML intégré dans Docker (libgomp1, model path resolution) |
| **Avancement estimé** | 60 % | **85 %** |

---

## 3. AMÉLIORATIONS PAR RAPPORT AU PROTOTYPE

### 3.1 Modèle ML — passage RandomForest → LightGBM

Le prototype utilisait un RandomForest scikit-learn avec 3 features (commune, type, surface). Il était moins précis que la baseline statistique simple, ce qui le rendait inutile en production.

**Ce qui a changé :**

- Remplacement par **LightGBM** (`lgb.LGBMRegressor`)
- Pipeline gold parquet partitionné par année (`data/processed/gold_transactions/annee=…`)
- **12 features** au lieu de 3 : coordonnées géographiques (latitude, longitude), prix_m2 de référence sur 12 mois, volumes de ventes commune + département, mois, trimestre, flag terrain
- Split chronologique strict (train 2021–2024 / test 2025) pour éviter le data leakage
- Filtrage IQR automatique des outliers prix/m²

**Résultats sur test 2025 (130 154 transactions) :**

| Métrique | Prototype RF | V1.2 LightGBM | Gain |
|----------|-------------|----------------|------|
| MAPE prix/m² | 182 % | **19.2 %** | ×9.5 |
| MAPE prix total | ~158 % (baseline) | **19.2 %** | ×8.2 |
| MAE prix/m² | — | 999 €/m² | — |
| MAE prix total | — | 66 634 € | — |
| R² | — | 0.778 | — |
| Dans ±10 % | — | 40.5 % | — |
| Dans ±20 % | ~18 % | **69.2 %** | ×3.8 |

---

### 3.2 Géolocalisation BAN

Le prototype ignorait l'adresse (unused feature). V1.2 intègre la **Base Adresse Nationale** (api-adresse.data.gouv.fr) :

- Géocodage de l'adresse → latitude, longitude, code commune INSEE
- Ces coordonnées sont injectées comme features dans LightGBM
- Meilleure précision que la commune seule : le modèle distingue un appartement rue de Rivoli d'un appartement rue de Turbigo dans le même arrondissement

**Logique de fallback :**
```
Adresse fournie → BAN → coordonnées → LightGBM (ML)
Commune uniquement              → DVF médiane (statistique)
```

---

### 3.3 Pipeline de données étendu

Le prototype travaillait sur `DVF_clean_2023_2024.csv` (257 354 lignes, 2 années).

V1.2 utilise un **gold parquet partitionné** :

- Sources : DVF 2021, 2022, 2023, 2024, 2025-S1
- Coordonnées géographiques ajoutées par jointure sur le référentiel BAN communes
- Nettoyage renforcé : contrôles qualité automatisés, 430 lignes avec nb_pieces aberrant retirées
- **709 669 transactions finales** — ×2.8 vs prototype
- Format Parquet (lecture ×5 plus rapide que CSV sur ce volume)

---

### 3.4 Interface — 3 onglets

Le prototype avait une interface mono-page. V1.2 ajoute deux modules d'analyse :

**Onglet 1 : Estimation** (existant, amélioré)
- Appartement sélectionné par défaut
- Indication dynamique BAN active / commune requise
- Panneau de confiance dans le résultat : méthode, MAPE du modèle, scope, n_transactions, dispersion

**Onglet 2 : Carte des prix par commune** (nouveau)
- Leaflet 1.9.4 (CDN)
- 1 193 communes d'Île-de-France
- Cercles colorés par fourchette prix/m² (6 tranches de vert → rouge)
- Popup : nom commune, n transactions, médian, Q1–Q3
- Filtres par département (75 → 95)

**Onglet 3 : Référence du marché** (nouveau)
- Sparklines SVG (sans librairie externe)
- Évolution mensuelle prix/m² 2021–2025 par département
- Sélecteur multi-département
- Cartes de prix avec variation annuelle (Δ YoY)

---

### 3.5 Validation des entrées

Le prototype acceptait des requêtes sans vérification de cohérence. V1.2 ajoute :

- **Champs requis** alignés sur les features modèle : surface, pièces, type, commune (ou adresse)
- **Ratio surface/pièces** : rejet si < 5 m²/pièce ou > 200 m²/pièce avec message lisible
- **Maisons** : flag `a_terrain=True` automatique pour LightGBM (corrige surestimation)
- **Petites surfaces** (< 30 m²) : fourchette élargie à ±20 %, fiabilité plafonnée à 0.65, note explicative

---

### 3.6 Intégration Docker complète

Le prototype livrait Docker mais le modèle ML ne fonctionnait pas à l'intérieur (3 mois après, image obsolète).

V1.2 corrige 4 problèmes d'intégration :

| Problème | Fix |
|----------|-----|
| `libgomp.so.1` manquant (LightGBM → OpenMP) | `apt-get install libgomp1` dans Dockerfile |
| `requirements.txt` introuvable dans le build context | Chemin corrigé vers racine du projet |
| Modèle non trouvé dans Docker (`/app/Backend/models/`) | `_trouver_modele()` — 3 chemins candidats dans l'ordre |
| `ModuleNotFoundError: geocoding` | `sys.path` enrichi avec `ml/` et son parent au démarrage |

---

### 4. PISTES D'AMÉLIORATION DU PROTOTYPE — SUIVI

| Piste identifiée en mars 2026 | Statut v1.2 |
|------------------------------|-------------|
| Filtrage outliers IQR | ✅ Implémenté (pipeline gold) |
| Modèle LightGBM / XGBoost | ✅ LightGBM, MAPE 19.2 % |
| Enrichissement features (coordonnées, dept, temporel) | ✅ 12 features dont lat/lon |
| Carte interactive Leaflet | ✅ 1 193 communes |
| Granularité géographique fine | ✅ Adresse → BAN → lat/lon |
| Déploiement cloud | ⬜ Non implémenté (Render / HuggingFace envisagés) |
| Base de données PostgreSQL | ⬜ Hors scope v1.2 |
| Tests automatisés complets | ⬜ Partiels |
| CI/CD GitHub Actions | ⬜ Non |
| DPE / état du bien | ⬜ Identifié, différé v1.3 |

---

## 5. ARCHITECTURE v1.2

```
UTILISATEUR (Browser) — http://localhost:8501
        │
        ▼  HTTP
FRONTEND — React 18 + Vite + Tailwind CSS (Nginx, port 8501)
  ├── App.jsx              (3 onglets : Estimation · Carte · Marché)
  ├── EstimationForm.jsx   (validation native HTML + Pydantic côté API)
  ├── ResultPanel.jsx      (confiance modèle : MAPE, scope, dispersion)
  ├── PriceMap.jsx         (Leaflet, 1 193 communes)
  └── MarketTrends.jsx     (sparklines SVG, 2021–2025)
        │
        ▼  JSON REST (CORS port 8501 autorisé)
BACKEND — FastAPI Python 3.11 (Uvicorn, port 8000)
  ├── GET  /api/health                → statut + model_loaded
  ├── GET  /api/metadata/communes     → liste communes DVF
  ├── POST /api/predictions/estimate  → estimation prix
  ├── GET  /api/market/map            → 1 193 communes stats
  └── GET  /api/market/trends         → 480 points mensuels
        │
        ├──► ml/estimator.py → BAN geocoding → LightGBM predict
        │         └── Backend/models/price_model.pkl (709 k transactions)
        └──► DVF gold parquet (fallback statistique)

Infrastructure : Docker Compose (2 services)
  ├── realestate_backend   (python:3.11-slim + libgomp1)
  └── realestate_frontend  (node:20-alpine → nginx:alpine)

Data samples (dans l'image) :
  ├── data/samples/commune_stats.json    (1 193 communes, 221 KB)
  └── data/samples/market_trends.json   (480 points mensuels, 59 KB)
```

---

## 6. MÉTRIQUES DE PERFORMANCE MODÈLE (DÉTAIL)

**Split :** entraînement 2021–2024 (579 515 trans.) | test 2025 (130 154 trans.)  
**Cible :** prix_m2 (régression)

| Métrique | Valeur |
|----------|--------|
| MAPE prix/m² | **19.2 %** |
| MAPE prix total | 19.2 % |
| MAE prix/m² | 999 €/m² |
| MAE prix total | 66 634 € |
| R² | 0.778 |
| Prédictions dans ±10 % | 40.5 % |
| Prédictions dans ±20 % | **69.2 %** |

**Top features (importance LightGBM) :**
1. `prix_m2_reference_12m` — référence marché locale sur 12 mois
2. `latitude` / `longitude` — signal géographique fin
3. `surface_bati` — surface habitable
4. `code_departement` — effet département (75 vs 77 notamment)
5. `nb_ventes_commune_12m` — liquidité du marché local

---

## 7. LIMITES ACTUELLES

| Limite | Impact | Priorité |
|--------|--------|----------|
| MAPE 19 % encore élevé pour Paris intra-muros | Écart ±66 k€ en médiane | Haute |
| Petites surfaces (< 30 m²) sous-représentées dans DVF | Fourchette élargie, moins précis | Haute |
| Maisons rares dans certains départements (< 50 transactions) | Modèle peu fiable type "house" zones peu denses | Moyenne |
| Pas de filtre géographique sur l'entrée (biens hors IDF acceptés) | Résultat incohérent si commune hors IDF saisie | Moyenne |
| Données 2025 limitées à S1 | Légère sous-représentation des prix 2025 | Basse |
| Déploiement cloud absent | Demo uniquement en local | Basse |

---

## 8. ÉVOLUTIONS ENVISAGÉES (V1.3)

1. **DPE (Diagnostic de Performance Énergétique)** : feature haute valeur, fortement corrélée au prix depuis la réforme 2021
2. **Arrondissements Paris** : découper Paris en 20 codes INSEE distincts vs une seule commune
3. **Déploiement cloud** : Render (backend) + Vercel (frontend) — coût ≈ 0 € pour usage démo
4. **Historique d'estimations** : stockage localStorage ou base légère (SQLite)
5. **Export PDF** : fiche d'estimation téléchargeable pour présentation en démo

---

*Rapport rédigé le 7 septembre 2026 — Version v1.2*  
*Dépôt : https://github.com/khadija10/RealStateAI — Branche : feature/ml-mlops*
