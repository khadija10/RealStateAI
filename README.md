# RealStateAI

RealStateAI is a full-stack real estate estimation prototype based on French DVF open data.

## Current Scope
- FastAPI backend for price estimation
- Streamlit frontend with interactive form
- DVF data pipeline (cleaning + filtering for Ile-de-France)
- Dockerized local deployment

## Tech Stack
- Backend: FastAPI, Pydantic, Pandas
- Frontend: Streamlit
- Data: DVF TXT files -> cleaned CSV
- Infra: Docker, Docker Compose

## Project Structure
```text
RealStateAI/
├── Backend/
│   ├── main.py
│   ├── utils/
│   ├── tests/
│   └── Data pipeline/
│       ├── Data/
│       ├── Traitement/
│       └── outputs/
├── Frontend/
│   └── app.py
├── docs/
│   ├── SETUP.md
│   └── TECHNICAL_GUIDE.md
├── docker-compose.yml
└── requirements.txt
```

## Prerequisites
- Python 3.11+
- Docker + Docker Compose
- `unzip`

## Installation and Run (Recommended)

### 1) Clone and enter project
```bash
git clone <your-repo-url>
cd RealStateAI
```

### 2) Create Python environment (for pipeline and tests)
```bash
python3 -m venv data_env
source data_env/bin/activate
python3 -m pip install --upgrade pip
python3 -m pip install -r requirements.txt
```

### 3) Prepare DVF data (run 2024 recommended)
```bash
unzip -o "Backend/Data pipeline/Data/valeursfoncieres-2024.txt.zip" -d "Backend/Data pipeline/Data"
unzip -o "Backend/Data pipeline/Data/valeursfoncieres-2023.txt.zip" -d "Backend/Data pipeline/Data"

cd "Backend/Data pipeline/Traitement"
python3 - <<'PY'
from dvf_data_pipeline import pipeline_dvf
pipeline_dvf('../Data/', 2024)
PY
cd ~/RealStateAI
```

### 4) Start application
```bash
sudo docker compose up --build -d
```

### 5) Validate services
```bash
curl http://localhost:8000/api/health
```
Expected in JSON:
- `status: "healthy"`
- `dvf_loaded: true`
- `dvf_file` points to `DVF_clean_*.csv`

Frontend URL:
- http://localhost:8501

## Local Run Without Docker (Optional)

### Backend
```bash
source data_env/bin/activate
cd Backend
python3 -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### Frontend (new terminal)
```bash
source data_env/bin/activate
cd Frontend
BACKEND_URL=http://localhost:8000 streamlit run app.py
```

## Testing
```bash
source data_env/bin/activate
python3 -m pytest -q
```

## API Summary
- `GET /api/health`: backend and DVF load status
- `GET /api/metadata/communes`: list of available communes from dataset
- `POST /api/predictions/estimate`: estimation endpoint

Example payload:
```json
{
  "area_m2": 65,
  "rooms": 2,
  "property_type": "apartment",
  "commune": "PARIS 01",
  "address": "10 Rue de Rivoli, 75001 Paris"
}
```

## Common Issues
- Docker permission denied on `/var/run/docker.sock`: run with `sudo docker ...` or fix docker group rights.
- `404 aucune transaction trouvée`: choose a commune from the frontend select list.
- `dvf_loaded: false`: regenerate DVF clean output and restart backend.

## Documentation
- Setup: [docs/SETUP.md](docs/SETUP.md)
- Technical documentation: [docs/TECHNICAL_GUIDE.md](docs/TECHNICAL_GUIDE.md)
- Architecture overview: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

## License
See [LICENSE](LICENSE).
