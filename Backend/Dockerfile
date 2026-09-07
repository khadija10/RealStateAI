# Build depuis la RACINE du projet (le dossier qui contient Backend/) :
#   docker build -f Backend/Dockerfile -t realestateai-backend .
FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    ENVIRONMENT=production

WORKDIR /app

# Ni gcc ni postgresql-client : fastapi, pandas et pyarrow ont tous des wheels.
# Les installer ajoutait ~150 Mo à l'image pour rien.
COPY Backend/requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt

COPY Backend/ /app/

# Le dataset est volumineux : on le monte en volume plutôt que de l'embarquer.
#   docker run -p 8000:8000 \
#     -v "$(pwd)/Backend/Data pipeline/outputs:/data:ro" \
#     -e DVF_OUTPUTS_DIR=/data realestateai-backend
ENV DVF_OUTPUTS_DIR="/app/Data pipeline/outputs"

RUN useradd --create-home --uid 1000 appuser && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

# urllib plutôt que requests : requests n'est pas installé dans l'image.
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD python -c "import urllib.request,sys; \
sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/api/health',timeout=5).status==200 else 1)"

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]