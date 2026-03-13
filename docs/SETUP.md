# Setup Guide - RealStateAI

## Goal
Start the project locally with real DVF data and validate end-to-end behavior.

## Prerequisites
- Docker + Docker Compose
- Python 3.11+
- `unzip`

## 1) Python environment
```bash
cd ~/RealStateAI
python3 -m venv data_env
source data_env/bin/activate
python3 -m pip install --upgrade pip
python3 -m pip install -r requirements.txt
```

## 2) Prepare DVF dataset (2024 run recommended)
```bash
cd ~/RealStateAI
unzip -o "Backend/Data pipeline/Data/valeursfoncieres-2024.txt.zip" -d "Backend/Data pipeline/Data"
unzip -o "Backend/Data pipeline/Data/valeursfoncieres-2023.txt.zip" -d "Backend/Data pipeline/Data"

cd "Backend/Data pipeline/Traitement"
python3 - <<'PY'
from dvf_data_pipeline import pipeline_dvf
pipeline_dvf('../Data/', 2024)
PY
```

## 3) Start application with Docker
```bash
cd ~/RealStateAI
sudo docker compose up --build -d
```

## 4) Verify startup

### Containers
```bash
sudo docker compose ps
```

### Logs
```bash
sudo docker compose logs -f backend
sudo docker compose logs -f frontend
```

### Health endpoint
```bash
curl http://localhost:8000/api/health
```

Expected:
- `status = "healthy"`
- `dvf_loaded = true`
- `dvf_file` set to `DVF_clean_*.csv`

### Frontend
- Open: `http://localhost:8501`

## 5) Optional local run (without Docker)

### Backend
```bash
source data_env/bin/activate
cd ~/RealStateAI/Backend
python3 -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### Frontend (Vite)
```bash
source data_env/bin/activate
cd ~/RealStateAI/Frontend
npm install
VITE_API_URL=http://localhost:8000 npm run dev
```

## 6) Tests
```bash
cd ~/RealStateAI
source data_env/bin/activate
python3 -m pytest -q
```

## 7) Troubleshooting

### Docker permission denied (`/var/run/docker.sock`)
Use:
```bash
sudo docker compose up --build -d
```

### Backend returns `dvf_loaded: false`
Regenerate DVF clean output and restart backend.

### API `404 aucune transaction trouvée`
Use the commune dropdown in frontend (`/api/metadata/communes` source).

### Rebuild after dependency changes
```bash
sudo docker compose up --build -d
```

## 8) Stop services
```bash
sudo docker compose down
```
