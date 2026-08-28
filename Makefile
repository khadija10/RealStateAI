# =============================================================================
# Makefile — point d'entrée unique du pipeline data.
# Objectif soutenance : le jury tape "make setup && make data" et ça tourne.
# =============================================================================
.PHONY: help setup lint test data ingest clean-data clean

PY := data-pipeline/.venv/bin/python
PIP := data-pipeline/.venv/bin/pip

help:  ## Affiche les commandes disponibles
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}'

setup:  ## Crée l'environnement virtuel et installe les dépendances
	python3 -m venv data-pipeline/.venv
	$(PIP) install --upgrade pip
	$(PIP) install -e "data-pipeline[dev]"
	$(PY) -m nbstripout --install --attributes .gitattributes

lint:  ## Vérifie le style du code
	data-pipeline/.venv/bin/ruff check data-pipeline/src data-pipeline/tests

test:  ## Lance les tests unitaires (sur data/samples/, pas sur les vraies données)
	data-pipeline/.venv/bin/pytest data-pipeline/tests -v

ingest:  ## Étape 1 : télécharge les millésimes DVF du périmètre
	$(PY) -m realstate_data.pipeline ingest

data:  ## Pipeline complet bronze -> silver -> gold
	$(PY) -m realstate_data.pipeline run

clean-data:  ## Supprime les données dérivées (garde data/raw, coûteux à retélécharger)
	rm -rf data/interim/* data/processed/*
	touch data/interim/.gitkeep data/processed/.gitkeep

clean: clean-data  ## Nettoyage complet, y compris les caches Python
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	rm -rf .pytest_cache .ruff_cache
