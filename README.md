# RealEstateAI - Plateforme de Prédiction du Marché Immobilier

[![Status](https://img.shields.io/badge/status-in%20development-blue)](./ROADMAP.md)
[![Python 3.11+](https://img.shields.io/badge/python-3.11+-green)](https://www.python.org/)
[![Node 18+](https://img.shields.io/badge/node-18+-green)](https://nodejs.org/)

## 📖 Vue d'ensemble

RealEstateAI est une plateforme web complète combinant **ingénierie des données**, **analyse décisionnelle** et **intelligence artificielle** pour estimer les prix de biens immobiliers et analyser les marchés locaux.

Ce projet est une **certification professionnelle RNCP Titre 7** couvrant 4 activités principales :
1. **Stratégie d'innovation** - Veille technologique & business model
2. **Innovation digitale UX** - Design centré utilisateur & prototypage
3. **Gestion itérative** - Pipeline agile & amélioration continue
4. **Management d'équipe** - Leadership & gouvernance projet

---

## 🎯 Fonctionnalités principales

- **Page d'estimation** : Prédiction du prix via formulaire interactif
- **Carte interactive** : Visualisation des prix au m² par zone géographique
- **Analyse comparative** : Comparaison entre régions/quartiers
- **Tableau de bord** : Tendances du marché immobilier
- **Transparence IA** : Métriques du modèle et variables importantes
- **Admin panel** : Qualité des données et santé du pipeline

---

## 🏗️ Architecture technique

```
Frontend
   └─ React / Next.js (TypeScript)
      └─ Tailwind CSS, Recharts, Leaflet

Backend
   └─ FastAPI (Python 3.11)
      └─ SQLAlchemy, Pydantic

Data Pipeline
   └─ Python, Pandas, dbt (optionnel)
      └─ PostgreSQL, CSV/Parquet

ML Model
   └─ scikit-learn, XGBoost
      └─ Feature engineering, validation

Deployment
   └─ Docker, Docker Compose
      └─ Cloud Run (backend) / Vercel (frontend)
```

---

## 🚀 Quick Start

### Prérequis
- Docker & Docker Compose
- Node.js 18+
- Python 3.11+
- Git

### Installation locale (5 min)

```bash
# Cloner le repository
git clone https://github.com/your-org/RealEstateAI.git
cd RealEstateAI

# Démarrer les services
docker-compose up -d

# Frontend (http://localhost:3000)
cd frontend
npm install
npm run dev

# Backend (http://localhost:8000)
cd ../backend
pip install -r requirements.txt
python -m uvicorn main:app --reload
```

### Variables d'environnement
Créer `.env` à la racine :
```
DATABASE_URL=postgresql://user:password@db:5432/realestate
NEXT_PUBLIC_API_URL=http://localhost:8000
ENVIRONMENT=development
```

---

## 📊 Données

Structures de données supportées :
- **Sources** : APIs immobilières, CSV, données open data
- **Format** : Parquet, CSV, JSON
- **Nettoyage** : Scripts Python/SQL dans `/data/scripts`

Exemple schema :
```sql
CREATE TABLE properties (
  id SERIAL PRIMARY KEY,
  address VARCHAR,
  price DECIMAL,
  area_m2 DECIMAL,
  rooms INT,
  location_lat FLOAT,
  location_lng FLOAT,
  created_at TIMESTAMP
);
```

---

## 🧠 Modèle IA

**Approche** : Régression supervisée  
**Modèle** : XGBoost (Random Forest alternative)  
**Target** : Prix de vente (en €)

**Métriques** :
- MAE (Mean Absolute Error) : ±15% du prix moyen
- RMSE (Root Mean Squared Error) : évaluer stabilité
- Feature importance : visualiser impact variables

**Entraînement** :
```bash
cd backend/ml
python train_model.py
python evaluate_model.py
```

---

## 📋 Livrables RNCP

### ✅ À rendre :

| Activité | Livrables | Deadline |
|----------|-----------|----------|
| **A1 - Stratégie** | Rapport de veille + Business plan + Recommandations | Semaine 2 |
| **A2 - Innovation UX** | Prototype fonctionnel + Étude utilisateur | Semaine 4 |
| **A3 - Gestion itérative** | 4 Sprint reviews + Rapports + Gestion incidents | Semaine 8 |
| **A4 - Management** | Fiche de poste + Onboarding + Gouvernance | Semaine 8 |
| **Optionnel 1** | Architecture + Qualité code (optionnel) | Semaine 9 |
| **Optionnel 2** | Analytics + Recommandations DG (optionnel) | Semaine 9 |

Plus de détails : [ROADMAP.md](./ROADMAP.md)

---

## 🔄 Workflow de développement

```bash
# 1. Créer une branche feature
git checkout -b feature/estimation-page

# 2. Développer et committer
git add .
git commit -m "feat: add estimation form component"

# 3. Push et créer Pull Request
git push origin feature/estimation-page

# 4. Code review et merge
# Après approbation : merge to main

# 5. Deploy auto en staging
# GitHub Actions déclenche tests + déploiement
```

---

## 🧪 Tests

```bash
# Backend tests
cd backend
pytest tests/

# Frontend tests
cd ../frontend
npm test

# Integration tests
docker-compose exec backend pytest tests/integration/
```

---

## 📚 Documentation

- `./docs/architecture.md` - Architecture technique détaillée
- `./docs/api.md` - Documentation API (Swagger disponible à `/docs`)
- `./docs/data-pipeline.md` - Processus ETL
- `./docs/ml-model.md` - Détails du modèle IA
- `./ROADMAP.md` - Roadmap complète RNCP

---

## 🔐 Sécurité

- ✅ JWT authentication
- ✅ HTTPS en production
- ✅ SQL injection prevention (SQLAlchemy ORM)
- ✅ CORS configuré
- ✅ Rate limiting sur API
- ✅ Validation des inputs (Pydantic)

---

## 📞 Support & Contribution

**Questions ?** Créer une issue GitHub  
**Bugs ?** Signaler avec reproduction steps  
**Améliorations ?** Pull request bienvenue

---

## 📄 License

MIT License - voir [LICENSE.md](./LICENSE.md)

---

## 👥 Équipe

- **Chef de projet / Product Owner** : [Votre nom]
- **Tech Lead Backend** : [Nom]
- **Tech Lead Frontend** : [Nom]
- **Data Engineer** : [Nom]
- **QA / Devops** : [Nom]

---

**Last updated** : Aujourd'hui  
**Status** : 🔴 Phase 1 - Stratégie en cours  
**Prochaines étapes** : Validation prototype semaine 4
