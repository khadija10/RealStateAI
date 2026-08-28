FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Dépendances backend
COPY requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt \
    lightgbm duckdb pyarrow pyyaml

# Code backend + module ML
COPY Backend/ /app/
COPY ml/ /app/ml/
COPY data/samples/ /app/data/samples/

ENV PYTHONUNBUFFERED=1
ENV ENVIRONMENT=production

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/api/health', timeout=5)" || exit 1

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
