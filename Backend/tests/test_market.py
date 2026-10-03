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


@pytest.fixture
def client_market(tmp_path):
    """Client avec fichiers JSON market dans un répertoire temporaire (repli statique).

    Portée « fonction » : l'application est un objet global, et chaque client qui
    démarre recharge le marché calculé ; le repli doit être posé à chaque test."""
    samples_dir = tmp_path / "samples"
    samples_dir.mkdir()
    stats_path  = samples_dir / "commune_stats.json"
    trends_path = samples_dir / "market_trends.json"
    stats_path.write_text(json.dumps(COMMUNE_STATS_SAMPLE, ensure_ascii=False))
    trends_path.write_text(json.dumps(MARKET_TRENDS_SAMPLE, ensure_ascii=False))

    with (
        patch("main._COMMUNE_STATS_PATH", stats_path),
        patch("main._MARKET_TRENDS_PATH", trends_path),
        TestClient(app) as c,
    ):
        # Repli sur les fichiers statiques : sans marché calculé depuis le dataset
        calcule, c.app.state.marche = c.app.state.marche, {}
        yield c
        c.app.state.marche = calcule


@pytest.fixture
def client_sans_fichiers(tmp_path):
    """Client dont les fichiers market n'existent pas → 503 attendu."""
    vide = tmp_path
    with (
        patch("main._COMMUNE_STATS_PATH", vide / "commune_stats.json"),
        patch("main._MARKET_TRENDS_PATH", vide / "market_trends.json"),
        TestClient(app) as c,
    ):
        calcule, c.app.state.marche = c.app.state.marche, {}
        yield c
        c.app.state.marche = calcule


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


# ── /api/market/secteurs : statistiques calculées sur le dataset ─────────────

import pandas as pd

from main import _construire_secteurs


def _dvf_secteurs() -> pd.DataFrame:
    """Une commune, deux années : 2024 (3 ventes) et 2025 (12 ventes)."""
    lignes = [("2024-06-01", 9000.0)] * 3 + [("2025-06-01", 10000.0 + 100 * i) for i in range(12)]
    return pd.DataFrame({
        "code_commune": "75111", "commune": "Paris 11e Arrondissement",
        "type_bien_norm": "apartment",
        "date_mutation": [d for d, _ in lignes], "prix_au_m2": [p for _, p in lignes],
    })


class TestSecteurs:
    def test_mediane_et_deciles_de_la_derniere_annee(self):
        s = _construire_secteurs(_dvf_secteurs())[("75111", "apartment")]
        assert s["annee"] == 2025
        assert s["med"] == 10550          # médiane des 12 ventes 2025
        assert s["p10"] < s["med"] < s["p90"]
        assert s["n"] == 15               # toutes les ventes de la période

    def test_evolution_annuelle_avec_annees_manquantes(self):
        s = _construire_secteurs(_dvf_secteurs())[("75111", "apartment")]
        assert s["eco"] == [None, None, None, 9000, 10550]

    def test_peu_de_ventes_recentes_repli_sur_toute_la_periode(self):
        df = _dvf_secteurs().iloc[:8]     # 3 ventes 2024 + 5 ventes 2025 (< 10)
        s = _construire_secteurs(df)[("75111", "apartment")]
        assert s["med"] == round(df["prix_au_m2"].median())

    def test_dataset_absent(self):
        assert _construire_secteurs(None) == {}

    def test_endpoint_classe_par_prix_et_filtre_le_volume(self):
        with TestClient(app) as client:
            app.state.secteurs = {
                ("A", "apartment"): {"code": "A", "nom": "A", "med": 5000, "n": 500},
                ("B", "apartment"): {"code": "B", "nom": "B", "med": 9000, "n": 300},
                ("C", "apartment"): {"code": "C", "nom": "C", "med": 12000, "n": 50},
                ("D", "house"): {"code": "D", "nom": "D", "med": 4000, "n": 900},
            }
            r = client.get("/api/market/secteurs?property_type=apartment&min_ventes=200")
        assert r.status_code == 200
        assert [s["code"] for s in r.json()] == ["B", "A"]



# ── Marché calculé depuis le dataset : séparé par type de bien et par marché ──

def test_construire_marche_separe_maisons_et_appartements():
    import pandas as pd
    from main import _construire_marche
    lignes = []
    for i in range(12):   # 12 ventes de chaque type, réparties sur 2 mois (6 par mois)
        lignes.append({"commune": "Versailles", "type_bien_norm": "apartment", "dep": "78",
                       "date_mutation": f"2025-0{1 + i % 2}-15", "prix_au_m2": 6000 + 10 * i,
                       "latitude": 48.80, "longitude": 2.13, "est_vefa": i < 3})
        lignes.append({"commune": "Versailles", "type_bien_norm": "house", "dep": "78",
                       "date_mutation": f"2025-0{1 + i % 2}-15", "prix_au_m2": 9000 + 10 * i,
                       "latitude": 48.80, "longitude": 2.13, "est_vefa": False})
    m = _construire_marche(pd.DataFrame(lignes))
    appart = m["carte"][("apartment", "tous")][0]
    maison = m["carte"][("house", "tous")][0]
    assert appart["prix_m2_median"] < 7000 < maison["prix_m2_median"]
    assert appart["n_transactions"] == 12 and appart["periode"] == "2025"
    # ancien : sans les 3 ventes sur plan ; neuf : moins de 5 ventes, commune absente
    assert m["carte"][("apartment", "ancien")][0]["n_transactions"] == 9
    assert m["carte"][("apartment", "neuf")] == []
    mois = m["tendances"][("house", "tous")]
    assert {r["code_departement"] for r in mois} == {"78"} and all(r["mois_index"] > 300 for r in mois)


def test_endpoints_filtrent_par_type_et_marche():
    with TestClient(app) as c:
        if not c.app.state.marche:
            pytest.skip("dataset absent : marché non calculé")
        appart = c.get("/api/market/map", params={"type_bien": "apartment"}).json()
        maison = c.get("/api/market/map", params={"type_bien": "house"}).json()
        assert appart and maison and appart != maison
        assert {"nom_commune", "prix_m2_median", "n_transactions", "periode"} <= set(appart[0])
        t = c.get("/api/market/trends", params={"dep": "78", "type_bien": "house", "marche": "ancien"}).json()
        assert t and all(r["code_departement"] == "78" for r in t)


def test_secteurs_calcules_sur_l_ancien():
    import pandas as pd
    from main import _construire_secteurs
    lignes = [{"code_commune": "93008", "commune": "Bobigny", "type_bien_norm": "apartment",
               "date_mutation": "2025-03-01", "prix_au_m2": 3400 + i, "est_vefa": False} for i in range(12)]
    lignes += [{"code_commune": "93008", "commune": "Bobigny", "type_bien_norm": "apartment",
                "date_mutation": "2025-03-01", "prix_au_m2": 7400, "est_vefa": True} for _ in range(20)]
    s = _construire_secteurs(pd.DataFrame(lignes))[("93008", "apartment")]
    assert s["n"] == 12 and s["med"] < 3500     # les 20 ventes sur plan sont écartées
