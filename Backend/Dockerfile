FROM python:3.11-slim

WORKDIR /app

# requirements à la racine (maintenant accessible car context = .)
COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

# copier uniquement le backend
COPY Backend/ /app

EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
