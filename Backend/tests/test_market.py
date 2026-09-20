"""Tests des endpoints /api/market/map et /api/market/trends.

Ces endpoints lisent des fichiers JSON statiques générés par le pipeline data.
On teste : structure de la réponse, filtre département, comportement 503 si
fichier absent, et cohérence des données (pas de prix négatifs, deps IDF seuls).
"""

from __future__ import annotations

import json
from pathlib import Path
from unittest.mock import patch

import numpy as np
import pytest
from fastapi.testclient import TestClient

from main import app


# ── fixtures ──────────────────────────────────────────────────────────────────

COMMUNE_STATS_SAMPLE = [
    {
        "nom_commune": "Paris 15e Arrondissement",
        "code_departement": "75",
        "lat": 48.84175,
        "lon": 2.29628,
        "prix_m2_median": 9930.0,
        "prix_m2_q1": 8710.0,
        "prix_m2_q3": 11173.0,
        "n_transactions": 12122,
    },
    {
        "nom_commune": "Versailles",
        "code_departement": "78",
        "lat": 48.8014,
        "lon": 2.1301,
        "prix_m2_median": 6200.0,
        "prix_m2_q1": 5500.0,
        "prix_m2_q3": 7100.0,
        "n_transactions": 3450,
    },
    {
        "nom_commune": "Montreuil",
        "code_departement": "93",
        "lat": 48.8638,
        "lon": 2.4481,
        "prix_m2_median": 5600.0,
        "prix_m2_q1": 4900.0,
        "prix_m2_q3": 6300.0,
        "n_transactions": 2800,
    },
]

MARKET_TRENDS_SAMPLE = [
    {"annee": 2024, "mois": 1, "mois_index": 37, "code_departement": "75", "prix_m2_median": 10_800.0, "n_transactions": 1900},
    {"annee": 2024, "mois": 2, "mois_index": 38, "code_departement": "75", "prix_m2_median": 10_950.0, "n_transactions": 2100},
    {"annee": 2024, "mois": 1, "mois_index": 37, "code_departement": "92", "prix_m2_median": 7_200.0, "n_transactions": 1400},
    {"annee": 2024, "mois": 2, "mois_index": 38, "code_departement": "92", "prix_m2_median": 7_350.0, "n_transactions": 1500},
    {"annee": 2024, "mois": 1, "mois_index": 37, "code_departement": "93", "prix_m2_median": 5_500.0, "n_transactions": 1100},
]


@pytest.fixture(scope="module")
def client_market(tmp_path_factory):
    """Client avec fichiers JSON market dans un répertoire temporaire."""
    samples_dir = tmp_path_factory.mktemp("samples")
    stats_path  = samples_dir / "commune_stats.json"
    trends_path = samples_dir / "market_trends.json"
    stats_path.write_text(json.dumps(COMMUNE_STATS_SAMPLE, ensure_ascii=False))
    trends_path.write_text(json.dumps(MARKET_TRENDS_SAMPLE, ensure_ascii=False))

    with (
        patch("main._COMMUNE_STATS_PATH", stats_path),
        patch("main._MARKET_TRENDS_PATH", trends_path),
        TestClient(app) as c,
    ):
        yield c


@pytest.fixture
def client_sans_fichiers(tmp_path):
    """Client dont les fichiers market n'existent pas → 503 attendu."""
    vide = tmp_path
    with (
        patch("main._COMMUNE_STATS_PATH", vide / "commune_stats.json"),
        patch("main._MARKET_TRENDS_PATH", vide / "market_trends.json"),
        TestClient(app) as c,
    ):
        yield c


# ── /api/market/map ───────────────────────────────────────────────────────────

class TestMarketMap:

    def test_statut_200(self, client_market):
        r = client_market.get("/api/market/map")
        assert r.status_code == 200

    def test_retourne_une_liste(self, client_market):
        body = client_market.get("/api/market/map").json()
        assert isinstance(body, list)
        assert len(body) == len(COMMUNE_STATS_SAMPLE)

    def test_cles_obligatoires(self, client_market):
        body = client_market.get("/api/market/map").json()
        cles = {"nom_commune", "code_departement", "lat", "lon",
                "prix_m2_median", "n_transactions"}
        for entry in body:
            assert cles <= set(entry.keys()), f"Clés manquantes dans : {entry}"

    def test_prix_strictement_positifs(self, client_market):
        body = client_market.get("/api/market/map").json()
        for entry in body:
            assert entry["prix_m2_median"] > 0, (
                f"Prix négatif ou nul pour {entry['nom_commune']}"
            )

    def test_coordonnees_en_idf(self, client_market):
        """Toutes les communes du fichier doivent être en Île-de-France (approx)."""
        body = client_market.get("/api/market/map").json()
        for entry in body:
            assert 48.0 <= entry["lat"] <= 49.2, f"lat hors IDF : {entry}"
            assert 1.5 <= entry["lon"] <= 3.5,   f"lon hors IDF : {entry}"

    def test_503_si_fichier_absent(self, client_sans_fichiers):
        r = client_sans_fichiers.get("/api/market/map")
        assert r.status_code == 503
        assert "detail" in r.json()


# ── /api/market/trends ────────────────────────────────────────────────────────

class TestMarketTrends:

    def test_statut_200(self, client_market):
        r = client_market.get("/api/market/trends")
        assert r.status_code == 200

    def test_retourne_une_liste(self, client_market):
        body = client_market.get("/api/market/trends").json()
        assert isinstance(body, list)
        assert len(body) == len(MARKET_TRENDS_SAMPLE)

    def test_cles_obligatoires(self, client_market):
        body = client_market.get("/api/market/trends").json()
        cles = {"annee", "mois", "code_departement", "prix_m2_median", "n_transactions"}
        for row in body:
            assert cles <= set(row.keys())

    def test_filtre_dep_75(self, client_market):
        body = client_market.get("/api/market/trends", params={"dep": "75"}).json()
        assert len(body) == 2   # 2 lignes dep=75 dans le sample
        assert all(r["code_departement"] == "75" for r in body)

    def test_filtre_dep_92(self, client_market):
        body = client_market.get("/api/market/trends", params={"dep": "92"}).json()
        assert len(body) == 2
        assert all(r["code_departement"] == "92" for r in body)

    def test_filtre_dep_inexistant_retourne_liste_vide(self, client_market):
        body = client_market.get("/api/market/trends", params={"dep": "99"}).json()
        assert body == []

    def test_sans_filtre_retourne_tous_les_deps(self, client_market):
        body = client_market.get("/api/market/trends").json()
        deps = {r["code_departement"] for r in body}
        assert deps == {"75", "92", "93"}

    def test_prix_strictement_positifs(self, client_market):
        body = client_market.get("/api/market/trends").json()
        for row in body:
            assert row["prix_m2_median"] > 0

    def test_503_si_fichier_absent(self, client_sans_fichiers):
        r = client_sans_fichiers.get("/api/market/trends")
        assert r.status_code == 503
