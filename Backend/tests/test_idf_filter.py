"""Tests du filtre géographique Île-de-France.

Le filtre a deux chemins de rejet distincts :
  1. code_postal fourni → dep extrait → rejet si dep hors {75,77,78,91,92,93,94,95}
  2. aucun code_postal  → commune_norm comparée à la liste hors-IDF connue

Un bug dans l'un ou l'autre rend le filtre silencieux (accepte des villes hors IDF)
ou trop agressif (rejette des communes IDF valides).
"""

from __future__ import annotations

import numpy as np
import pandas as pd
import pytest
from fastapi.testclient import TestClient

from main import app
from utils.dvf_search import commune_display_names, prepare_index


# ── fixture commune à tous les tests ─────────────────────────────────────────

@pytest.fixture(scope="module")
def client_idf():
    """Client avec un dataset couvrant Paris, Versailles et Montreuil uniquement."""
    rng = np.random.default_rng(0)
    rows = []
    for commune, dep, base in [
        ("PARIS 15", "75", 11_000),
        ("VERSAILLES", "78", 6_500),
        ("MONTREUIL", "93", 5_600),
        ("MELUN", "77", 2_800),
    ]:
        for _ in range(60):
            surface = float(rng.integers(25, 120))
            ppm2 = float(base * rng.normal(1.0, 0.07))
            rows.append({
                "commune": commune, "dep": dep,
                "code_postal": dep + "000",
                "type_bien": "apartment", "surface_m2": surface,
                "nb_pieces": float(max(1, round(surface / 25))),
                "prix_vente": round(surface * ppm2, 2),
                "prix_au_m2": round(ppm2, 2),
            })
    dvf = prepare_index(pd.DataFrame(rows))
    with TestClient(app) as c:
        c.app.state.dvf = dvf
        c.app.state.dvf_error = None
        c.app.state.dvf_path = "memory://idf_test"
        c.app.state.communes = commune_display_names(dvf)
        yield c


def _post(client, commune=None, code_postal=None, address=None):
    body = {"area_m2": 60, "rooms": 3, "property_type": "apartment"}
    if commune:
        body["commune"] = commune
    if code_postal:
        body["code_postal"] = code_postal
    if address:
        body["address"] = address
    return client.post("/api/predictions/estimate", json=body)


# ── chemin 1 : département extrait du code postal ────────────────────────────

class TestFiltreParDepartement:

    def test_paris_75_accepte(self, client_idf):
        r = _post(client_idf, commune="Paris 15e", address="75015 Paris")
        assert r.status_code == 200

    def test_versailles_78_accepte(self, client_idf):
        r = _post(client_idf, address="78000 Versailles")
        assert r.status_code == 200

    def test_montreuil_93_accepte(self, client_idf):
        r = _post(client_idf, address="93100 Montreuil")
        assert r.status_code == 200

    def test_melun_77_accepte(self, client_idf):
        r = _post(client_idf, address="77000 Melun")
        assert r.status_code == 200

    def test_lyon_69_rejete(self, client_idf):
        r = _post(client_idf, address="69001 Lyon")
        assert r.status_code == 422
        assert "Île-de-France" in r.json()["detail"]
        assert "69" in r.json()["detail"]

    def test_marseille_13_rejete(self, client_idf):
        r = _post(client_idf, address="13001 Marseille")
        assert r.status_code == 422

    def test_bordeaux_33_rejete(self, client_idf):
        r = _post(client_idf, address="33000 Bordeaux")
        assert r.status_code == 422

    def test_strasbourg_67_rejete(self, client_idf):
        r = _post(client_idf, address="67000 Strasbourg")
        assert r.status_code == 422

    def test_dep_01_ain_rejete(self, client_idf):
        """Département hors IDF à un seul chiffre normalisé."""
        r = _post(client_idf, address="01000 Bourg-en-Bresse")
        assert r.status_code == 422

    def test_tous_les_deps_idf_passsent(self, client_idf):
        """Aucun département IDF ne doit être rejeté par le filtre."""
        idf_exemples = {
            "75": "75015 Paris",
            "77": "77000 Melun",
            "78": "78000 Versailles",
            "91": "91000 Évry",
            "92": "92100 Boulogne",
            "93": "93100 Montreuil",
            "94": "94000 Créteil",
            "95": "95000 Cergy",
        }
        for dep, addr in idf_exemples.items():
            r = _post(client_idf, address=addr)
            # 200 ou 404 (commune inconnue du dataset synthétique) — jamais 422
            assert r.status_code != 422, (
                f"département {dep} rejeté à tort par le filtre IDF"
            )


# ── chemin 2 : heuristique sur le nom de commune (sans code postal) ──────────

class TestFiltreParNomCommune:

    def test_lyon_sans_cp_rejete(self, client_idf):
        r = _post(client_idf, commune="Lyon")
        assert r.status_code == 422
        assert "Île-de-France" in r.json()["detail"]

    def test_marseille_sans_cp_rejete(self, client_idf):
        r = _post(client_idf, commune="Marseille")
        assert r.status_code == 422

    def test_nice_sans_cp_rejete(self, client_idf):
        r = _post(client_idf, commune="Nice")
        assert r.status_code == 422

    def test_toulouse_sans_cp_rejete(self, client_idf):
        r = _post(client_idf, commune="Toulouse")
        assert r.status_code == 422

    def test_paris_sans_cp_accepte(self, client_idf):
        """Paris sans code postal ne doit pas être rejeté par l'heuristique."""
        r = _post(client_idf, commune="Paris 15e")
        # 200 ou 404 mais jamais 422
        assert r.status_code != 422

    def test_versailles_sans_cp_accepte(self, client_idf):
        r = _post(client_idf, commune="Versailles")
        assert r.status_code != 422

    def test_saint_etienne_rejete(self, client_idf):
        """Commune à deux mots — la heuristique compare le premier token."""
        r = _post(client_idf, commune="Saint-Étienne")
        assert r.status_code == 422

    def test_message_contient_le_nom_saisi(self, client_idf):
        """Le message d'erreur doit citer la commune pour que l'utilisateur comprenne."""
        r = _post(client_idf, commune="Marseille")
        detail = r.json()["detail"]
        assert "Marseille" in detail or "marseille" in detail


# ── cas limites ───────────────────────────────────────────────────────────────

class TestCasLimites:

    def test_code_postal_prime_sur_commune(self, client_idf):
        """Si le code postal indique IDF mais la commune est dans la liste noire,
        le code postal l'emporte : pas de faux rejet."""
        # Scénario : utilisateur tape une commune hors IDF par erreur mais
        # met un code postal IDF → le filtre doit laisser passer (dep=75 → OK)
        r = _post(client_idf, commune="Lyon", address="75015 Paris")
        # Le code postal 75 l'emporte — pas de 422 pour "hors IDF"
        assert r.status_code != 422

    def test_commune_vide_rejete_422(self, client_idf):
        r = _post(client_idf)  # ni commune ni adresse
        assert r.status_code == 422

    def test_surface_hors_bornes_rejete(self, client_idf):
        """La validation de surface est indépendante du filtre IDF."""
        body = {"area_m2": 3, "property_type": "apartment", "commune": "Paris 15e"}
        r = client_idf.post("/api/predictions/estimate", json=body)
        assert r.status_code == 422
        assert "surface" in r.json()["detail"].lower()
