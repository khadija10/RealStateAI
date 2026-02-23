# SETUP - RealEstateAI

## Objectif
Ce guide explique comment lancer le prototype RealEstateAI, le vérifier rapidement, puis diagnostiquer les problèmes courants.

## Prérequis
- Docker Desktop (avec Docker Compose)
- Git
- Ports libres: `5432`, `8000`, `8501`, `5050`

## 1) Démarrage recommandé (Docker)
Depuis la racine du projet:

```bash
docker compose up --build -d
```

## 2) Vérification rapide

### Vérifier les conteneurs
```bash
docker compose ps
```

### Vérifier les logs
```bash
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f db
```

### Vérifier les endpoints
- Backend health: `http://localhost:8000/api/health`
- Frontend Streamlit: `http://localhost:8501`
- pgAdmin (optionnel): `http://localhost:5050`

## 3) Arrêt / redémarrage

### Arrêter
```bash
docker compose down
```

### Arrêter + supprimer volumes DB
```bash
docker compose down -v
```

### Rebuild complet
```bash
docker compose up --build -d
```

## 4) Démarrage local (sans Docker, optionnel)

### Backend
```bash
cd Backend
pip install -r ../requirements.txt
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### Frontend
Dans un autre terminal:
```bash
cd Frontend
$env:API_URL="http://localhost:8000"
streamlit run app.py
```

## 5) Commandes utiles

### Voir les images
```bash
docker images
```

### Ouvrir un shell dans le backend
```bash
docker compose exec backend sh
```

### Tester l’API depuis terminal
```bash
curl http://localhost:8000/api/health
```

## 6) Troubleshooting

### Erreur: `port is already allocated`
Un autre processus utilise le port (ex: `8000` ou `8501`).
- Stopper le processus en conflit ou
- Changer le port dans `docker-compose.yml`, puis relancer:
```bash
docker compose up --build -d
```

### Erreur frontend: impossible de joindre l’API
- Vérifier que `backend` est `Up`:
```bash
docker compose ps
```
- Vérifier la santé API: `http://localhost:8000/api/health`
- Vérifier la variable `API_URL` côté frontend (`http://backend:8000` en Docker).

### Erreur backend: connexion DB refusée
- Vérifier que `db` est `healthy`:
```bash
docker compose ps
docker compose logs db
```
- Vérifier `DATABASE_URL` dans `docker-compose.yml`.

### Changements de dépendances non pris en compte
Si `requirements.txt` a changé:
```bash
docker compose up --build -d
```

### Base de données dans un état incohérent
Réinitialiser complètement:
```bash
docker compose down -v
docker compose up --build -d
```

## 7) Critères de validation (Rôle 4)
- `backend`, `frontend`, `db` démarrent sans erreur.
- `GET /api/health` répond `200`.
- L’estimation fonctionne depuis l’UI Streamlit.
- Les logs ne montrent pas d’erreurs bloquantes.
