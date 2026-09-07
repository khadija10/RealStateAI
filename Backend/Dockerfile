# Build depuis la RACINE du projet (le dossier qui contient Backend/) :
#   docker build -f Backend/Dockerfile -t realestateai-backend .
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    ENVIRONMENT=production

WORKDIR /app

# Dépendances backend + ML
COPY Backend/requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt \
    lightgbm duckdb pyarrow pyyaml

# Code backend + module ML + table de référence marché
COPY Backend/ /app/
COPY ml/ /app/ml/
COPY data/samples/ /app/data/samples/

ENV DVF_OUTPUTS_DIR="/app/Data pipeline/outputs"

RUN useradd --create-home --uid 1000 appuser && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD python -c "import urllib.request,sys; \
sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/api/health',timeout=5).status==200 else 1)"

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
