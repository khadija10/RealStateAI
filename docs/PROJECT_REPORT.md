# 📊 PROJECT REPORT — RealStateAI

## 1️⃣ Introduction

RealStateAI est un projet visant à développer un outil d’estimation immobilière basé sur les données publiques DVF.

Le projet suit une architecture moderne séparant :
- Frontend
- Backend
- Data Pipeline
- Infrastructure

---

## 2️⃣ Travail réalisé

### ✅ Backend

- Mise en place de FastAPI
- Création des endpoints :
  - `/api/health`
  - `/api/predictions/estimate`
- Validation des requêtes via Pydantic
- Conteneurisation Docker

Limite actuelle :
L’estimation repose sur une formule simulée et non sur un modèle ML réel.

---

### ✅ Frontend

- Développement avec Streamlit
- Interface d’estimation fonctionnelle
- Connexion au backend
- Version UI avancée dans branche dédiée

---

### 🟡 Data Pipeline

- Script de traitement des données DVF
- Nettoyage des données
- Préparation des variables
- Gestion initiale des outliers

Limite :
Pas d’entraînement automatique d’un modèle ML.

---

### 🟡 Machine Learning (évaluation simple)

Comparaison sur un échantillon de 50k lignes (DVF 2023–2024) :
- Baseline (médiane prix/m² par commune + type) : MAE ≈ 190 882 ; MAPE ≈ 158.51
- Modèle RandomForest (features simples) : MAE ≈ 244 177 ; MAPE ≈ 182.04

Conclusion :
La baseline médiane est plus précise que le modèle simple à ce stade.

---

### 🟡 Infrastructure

- Dockerfiles backend & frontend
- docker-compose.yml
- Fichiers .env.example

Limite :
Pas encore de déploiement cloud.

---

## 3️⃣ État d’avancement global

Estimation de progression :

- Architecture : 80%
- Backend API : 75%
- Frontend : 70%
- Data : 50%
- Machine Learning réel : 20%
- Production ready : 30%

Avancement global estimé : ~60%

---

## 4️⃣ Limites actuelles

- Pas de modèle ML intégré
- Pas de base de données connectée
- Pas de persistance des estimations
- Pas de tests unitaires
- Pas de monitoring

---

## 5️⃣ Conclusion

Le projet dispose d’une base technique solide et d’une architecture claire.

Il s’agit actuellement d’un MVP simulé fonctionnel, nécessitant l’intégration d’un modèle Machine Learning réel pour atteindre sa version finale.
