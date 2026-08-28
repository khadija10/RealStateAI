# =============================================================================
# Makefile — point d'entrée unique du projet RealStateAI.
# Objectif soutenance : le jury tape "make install && make run" et ça tourne.
# =============================================================================
.PHONY: help install setup ingest data train run stop lint test clean-data clean

PY_PIPELINE := data-pipeline/.venv/bin/python
PIP_PIPELINE := data-pipeline/.venv/bin/pip
PY_APP      := data_env/bin/python

# ─────────────────────────────────────────────────────────────────────────────
# ENTRÉE PRINCIPALE
# ─────────────────────────────────────────────────────────────────────────────

help:  ## Affiche les commandes disponibles
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}'

install:  ## 🚀 DÉMARRAGE RAPIDE — installe tout et lance l'application
	@echo "\n=== Étape 1/5 : Environnement Python (pipeline) ==="
	python3 -m venv data-pipeline/.venv
	$(PIP_PIPELINE) install --upgrade pip -q
	$(PIP_PIPELINE) install -e "data-pipeline[dev]" -q
	$(PY_PIPELINE) -m nbstripout --install --attributes .gitattributes
	@echo "\n=== Étape 2/5 : Environnement Python (app) ==="
	python3 -m venv data_env
	data_env/bin/pip install --upgrade pip -q
	data_env/bin/pip install -r requirements.txt lightgbm mlflow duckdb pyarrow pyyaml -q
	@echo "\n=== Étape 3/5 : Téléchargement données DVF ==="
	$(PY_PIPELINE) -m realstate_data.pipeline ingest
	@echo "\n=== Étape 4/5 : Pipeline bronze → silver → gold ==="
	$(PY_PIPELINE) -m realstate_data.pipeline run
	@echo "\n=== Étape 5/5 : Entraînement modèle ML ==="
	$(PY_APP) ml/train.py
	@echo "\n✅ Installation terminée. Lance 'make run' pour démarrer l'application."

run:  ## Lance l'application complète (Docker Compose)
	docker compose up --build -d
	@echo "\n✅ Application disponible sur http://localhost:8501"
	@echo "   API Swagger sur http://localhost:8000/docs"

stop:  ## Arrête l'application
	docker compose down

# ─────────────────────────────────────────────────────────────────────────────
# ÉTAPES INDIVIDUELLES (développement)
# ─────────────────────────────────────────────────────────────────────────────

setup:  ## Crée les environnements virtuels Python
	python3 -m venv data-pipeline/.venv
	$(PIP_PIPELINE) install --upgrade pip -q
	$(PIP_PIPELINE) install -e "data-pipeline[dev]" -q
	$(PY_PIPELINE) -m nbstripout --install --attributes .gitattributes
	python3 -m venv data_env
	data_env/bin/pip install --upgrade pip -q
	data_env/bin/pip install -r requirements.txt lightgbm mlflow duckdb pyarrow pyyaml -q

ingest:  ## Télécharge les millésimes DVF (idempotent — reprend depuis le cache)
	$(PY_PIPELINE) -m realstate_data.pipeline ingest

data:  ## Pipeline complet bronze → silver → gold
	$(PY_PIPELINE) -m realstate_data.pipeline run

train:  ## Entraîne le modèle LightGBM (nécessite make data au préalable)
	$(PY_APP) ml/train.py

# ─────────────────────────────────────────────────────────────────────────────
# QUALITÉ & TESTS
# ─────────────────────────────────────────────────────────────────────────────

lint:  ## Vérifie le style du code
	data-pipeline/.venv/bin/ruff check data-pipeline/src data-pipeline/tests

test:  ## Lance les tests unitaires (données synthétiques, pas de téléchargement)
	data-pipeline/.venv/bin/pytest data-pipeline/tests -v

# ─────────────────────────────────────────────────────────────────────────────
# NETTOYAGE
# ─────────────────────────────────────────────────────────────────────────────

clean-data:  ## Supprime les données dérivées (conserve data/raw — coûteux à retélécharger)
	rm -rf data/interim/* data/processed/*
	touch data/interim/.gitkeep data/processed/.gitkeep

clean: clean-data  ## Nettoyage complet (données dérivées + caches Python)
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	rm -rf .pytest_cache .ruff_cache
