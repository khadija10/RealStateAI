# 🏗 ARCHITECTURE — RealStateAI

## Vue d’ensemble

Le projet est structuré selon une architecture modulaire :

```
Frontend (Streamlit)
        ↓
Backend API (FastAPI)
        ↓
Modèle ML (à intégrer)
        ↓
Data Pipeline DVF
```

---

## Backend

- Framework : FastAPI
- Validation : Pydantic
- Conteneurisation : Docker

Responsabilités :
- Recevoir les requêtes
- Valider les données
- Retourner une estimation

---

## Frontend

- Framework : Streamlit
- Interface utilisateur interactive
- Communication HTTP avec le backend

---

## Data Pipeline

- Nettoyage des données DVF
- Prétraitement
- Préparation features

---

## Infrastructure

- Docker
- Docker Compose
- Configuration via variables d’environnement

---

## Architecture cible (à atteindre)

```
Utilisateur
    ↓
Frontend
    ↓
Backend
    ↓
Modèle ML entraîné
    ↓
Base de données
```

Objectif : transformer le prototype actuel en application complète prête pour la production.
