# 🏠 RealStateAI

RealStateAI est une application d’estimation immobilière basée sur les données DVF (Demandes de Valeurs Foncières).  
Le projet combine un backend API, une interface utilisateur interactive et un pipeline de traitement des données.

---

## 🎯 Objectif du projet

Développer un système capable d’estimer le prix d’un bien immobilier à partir de :

- Surface (m²)
- Nombre de pièces
- Localisation (latitude / longitude)
- Type de bien

L’objectif final est d’intégrer un modèle de Machine Learning entraîné sur les données DVF.

---

## 🏗 Architecture du projet

Le projet repose sur une architecture modulaire :

- **Backend API** : FastAPI
- **Frontend** : Streamlit
- **Pipeline Data** : Traitement des données DVF
- **Infrastructure** : Docker & Docker Compose

```
Utilisateur → Frontend (Streamlit) → Backend (FastAPI) → Modèle ML
```

---

## 🚀 État actuel du projet

| Module | Statut |
|--------|--------|
| Architecture globale | ✅ Avancée |
| API FastAPI | ✅ Fonctionnelle |
| Frontend Streamlit | ✅ Fonctionnel |
| Pipeline DVF | 🟡 Partiellement implémenté |
| Modèle Machine Learning réel | 🔴 Non intégré |
| Base de données | 🔴 Non connectée |

---

## 🖥 Backend

- Endpoint de santé : `/api/health`
- Endpoint d’estimation : `/api/predictions/estimate`
- Validation des données avec Pydantic
- Dockerisé

⚠️ Actuellement, l’estimation repose sur une formule simulée et non sur un modèle ML entraîné.

---

## 🎨 Frontend

- Interface interactive avec Streamlit
- Formulaire d’estimation
- Affichage du prix estimé
- Version UI améliorée disponible dans la branche `frontend-ui`

---

## 📊 Data Pipeline

- Nettoyage des données DVF
- Prétraitement
- Filtrage
- Gestion initiale des outliers

⚠️ L’entraînement d’un modèle ML n’est pas encore intégré.

---

## 🐳 Lancement du projet

```bash
docker-compose up --build
```

Backend : http://localhost:8000  
Frontend : http://localhost:8501  

---

## 📌 Prochaines étapes

- Implémenter un modèle ML réel
- Intégrer le modèle au backend
- Connecter une base de données
- Ajouter des tests automatisés
- Mettre en place un monitoring

---

## 👥 Répartition des rôles

- Backend
- Frontend
- Data
- Infrastructure
- Documentation & Reporting

---

## 📄 Documentation détaillée

Voir :

- `docs/PROJECT_REPORT.md`
- `docs/ARCHITECTURE.md`
- `docs/NEXT_STEPS.md`
