"""Suite de tests du backend.

Lancement :
    cd Backend
    pytest

Les tests injectent un dataset synthétique dans `app.state` : aucun fichier DVF
réel n'est nécessaire, la suite tourne donc en CI.
"""

from __future__ import annotations

from collections.abc import Generator

import numpy as np
import pandas as pd
import pytest
from fastapi.testclient import TestClient

from main import app
from utils.address_parser import city_root, normalize_commune, parse_address
from utils.dvf_search import (
    SearchConfig,
    commune_display_names,
    prepare_index,
    search_comparables,
)
from utils.price_calculation import NoComparableError, calculate_price


# ==========================================================================
#  FIXTURES
# ==========================================================================


@pytest.fixture(scope="session")
def fake_dvf() -> pd.DataFrame:
    rng = np.random.default_rng(42)
    rows = []
    marches = [
        ("PARIS 15", "75", "apartment", 11_000),
        ("PARIS 15", "75", "house", 12_500),
        ("PARIS 20", "75", "apartment", 9_000),
        ("VERSAILLES", "78", "apartment", 6_500),
        ("VERSAILLES", "78", "house", 6_000),
        ("MELUN", "77", "house", 2_800),
    ]
    for commune, dep, type_bien, base_ppm2 in marches:
        for _ in range(80):
            surface = float(rng.integers(20, 130))
            ppm2 = float(base_ppm2 * rng.normal(1.0, 0.08))
            rows.append({
                "commune": commune,
                "dep": dep,
                "code_postal": dep + "000",
                "type_bien": type_bien,
                "surface_m2": surface,
                "nb_pieces": float(max(1, round(surface / 25))),
                "prix_vente": round(surface * ppm2, 2),
                "prix_au_m2": round(ppm2, 2),
            })
    return prepare_index(pd.DataFrame(rows))


@pytest.fixture
def client(fake_dvf) -> Generator[TestClient, None, None]:
    with TestClient(app) as test_client:
        test_client.app.state.dvf = fake_dvf
        test_client.app.state.dvf_error = None
        test_client.app.state.dvf_path = "memory://fake"
        test_client.app.state.communes = commune_display_names(fake_dvf)
        yield test_client


@pytest.fixture
def client_without_dvf() -> Generator[TestClient, None, None]:
    with TestClient(app) as test_client:
        test_client.app.state.dvf = None
        test_client.app.state.dvf_error = "DVF file not found"
        test_client.app.state.dvf_path = None
        test_client.app.state.communes = []
        yield test_client


# ==========================================================================
#  UNITAIRES — normalisation
# ==========================================================================


@pytest.mark.parametrize(
    "raw,expected",
    [
        ("Paris 15", "paris 15"),
        ("PARIS 15", "paris 15"),
        ("paris 15e", "paris 15"),
        ("Paris 15ème", "paris 15"),
        ("PARIS 15EME ARRONDISSEMENT", "paris 15"),
        ("PARIS 01", "paris 01"),
        ("Paris 1er", "paris 01"),
        ("St-Denis", "saint denis"),
        ("Ste-Geneviève-des-Bois", "sainte genevieve des bois"),
        ("  Versailles  ", "versailles"),
        (None, ""),
    ],
)
def test_normalize_commune(raw, expected):
    assert normalize_commune(raw) == expected


def test_city_root():
    assert city_root("paris 15") == "paris"
    assert city_root("versailles") == "versailles"


# ==========================================================================
#  UNITAIRES — adresse
# ==========================================================================


def test_parse_address_avec_virgule():
    parsed = parse_address("10 Rue de Rivoli, 75001 Paris")
    assert parsed.code_postal == "75001"
    assert parsed.dep == "75"
    assert parsed.commune_norm == "paris"


def test_parse_address_sans_virgule():
    parsed = parse_address("12 rue de la Paix 78000 Versailles")
    assert parsed.code_postal == "78000"
    assert parsed.commune_norm == "versailles"


def test_parse_address_vide():
    parsed = parse_address("")
    assert parsed.code_postal is None
    assert parsed.commune_norm == ""


def test_parse_address_commune_seule():
    parsed = parse_address("Versailles")
    assert parsed.code_postal is None
    assert parsed.commune_norm == "versailles"


# ==========================================================================
#  UNITAIRES — recherche
# ==========================================================================


def test_search_match_strict(fake_dvf):
    outcome = search_comparables(fake_dvf, "paris 15", "apartment", 60)
    assert not outcome.is_empty
    assert outcome.scope == "commune"
    assert outcome.fallback_level == 0
    assert outcome.notes == []


def test_search_commune_avant_geographie(fake_dvf):
    """La commune doit être épuisée avant d'élargir : la localisation prime."""
    outcome = search_comparables(fake_dvf, "paris 15", "apartment", 60, rooms=3)
    assert outcome.scope == "commune"


def test_search_type_other_explore_les_deux(fake_dvf):
    outcome = search_comparables(fake_dvf, "versailles", "other", 90)
    assert not outcome.is_empty
    assert outcome.type_used in {"apartment", "house"}
    assert any("type de bien" in note for note in outcome.notes)


def test_search_studio_replie_sur_apartment(fake_dvf):
    outcome = search_comparables(fake_dvf, "paris 20", "studio", 25)
    assert outcome.type_used == "apartment"


def test_search_elargit_la_tolerance(fake_dvf):
    outcome = search_comparables(
        fake_dvf, "paris 15", "apartment", 60,
        config=SearchConfig(min_transactions=40),
    )
    assert outcome.surface_tolerance is not None
    assert outcome.surface_tolerance > 0.15


def test_search_rooms_incoherent_est_relache(fake_dvf):
    """Un 60 m² déclaré 12 pièces ne doit pas produire un 404."""
    outcome = search_comparables(fake_dvf, "paris 15", "apartment", 60, rooms=12)
    assert not outcome.is_empty
    assert any("pièces" in note for note in outcome.notes)


def test_search_commune_inconnue(fake_dvf):
    assert search_comparables(fake_dvf, "trifouillis les oies", "apartment", 60).is_empty


def test_search_dataframe_vide():
    assert search_comparables(pd.DataFrame(), "paris 15", "apartment", 60).is_empty


# ==========================================================================
#  UNITAIRES — calcul de prix
# ==========================================================================


def test_calculate_price_nominal():
    tx = pd.DataFrame({"prix_au_m2": [9000, 10000, 11000, 10500, 9500]})
    result = calculate_price(tx, 50)
    assert result.price_per_m2 == 10000
    assert result.estimated_price == 500_000
    assert result.range_low < result.estimated_price < result.range_high
    assert 0 <= result.reliability <= 1


def test_calculate_price_echantillon_vide():
    with pytest.raises(NoComparableError):
        calculate_price(pd.DataFrame({"prix_au_m2": []}), 50)


def test_calculate_price_que_des_nan():
    with pytest.raises(NoComparableError):
        calculate_price(pd.DataFrame({"prix_au_m2": [None, None]}), 50)


def test_calculate_price_une_seule_transaction():
    """La jauge exige low < estimation < high, même avec une seule transaction."""
    result = calculate_price(pd.DataFrame({"prix_au_m2": [8000]}), 30)
    assert result.n_transactions == 1
    assert result.range_low < result.estimated_price < result.range_high
    assert result.reliability < 0.7


# ==========================================================================
#  ENDPOINTS — santé
# ==========================================================================


def test_health_ok(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "healthy"
    assert body["dvf_loaded"] is True
    assert body["n_rows"] > 0


def test_health_degraded(client_without_dvf):
    body = client_without_dvf.get("/api/health").json()
    assert body["status"] == "degraded"
    assert body["dvf_loaded"] is False


# ==========================================================================
#  ENDPOINTS — métadonnées
# ==========================================================================


def test_communes_renvoie_un_tableau(client):
    """normalizeCommunes() commence par Array.isArray() : un objet donnerait []."""
    body = client.get("/api/metadata/communes").json()
    assert isinstance(body, list)
    assert all(isinstance(c, str) for c in body)
    assert len(body) > 0


def test_communes_filtre(client):
    body = client.get("/api/metadata/communes", params={"q": "paris"}).json()
    assert all("PARIS" in c for c in body)


# ==========================================================================
#  ENDPOINTS — estimation
# ==========================================================================


def test_estimate_nominal(client):
    response = client.post(
        "/api/predictions/estimate",
        json={"area_m2": 60, "rooms": 3, "property_type": "apartment", "commune": "PARIS 15"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["model"] == "dvf"
    assert body["estimated_price"] > 0


def test_contrat_normalize_result(client):
    """Clés exactes lues par normalizeResult() côté React."""
    body = client.post(
        "/api/predictions/estimate",
        json={"area_m2": 60, "rooms": 3, "property_type": "apartment", "commune": "PARIS 15"},
    ).json()

    assert "estimated_price" in body       # -> result.price
    assert "price_per_m2" in body          # -> result.pricePerM2
    assert "low" in body["price_range"]    # -> result.low
    assert "high" in body["price_range"]   # -> result.high

    # La jauge suppose low < price < high, sinon le repère sort de la règle.
    assert body["price_range"]["low"] < body["estimated_price"] < body["price_range"]["high"]


def test_estimate_commune_saisie_librement(client):
    """Le datalist n'empêche pas la saisie libre : « Paris 15e » doit marcher."""
    response = client.post(
        "/api/predictions/estimate",
        json={"area_m2": 60, "rooms": 3, "property_type": "apartment", "commune": "Paris 15e"},
    )
    assert response.status_code == 200


def test_estimate_type_other(client):
    """Le bouton « Autre » du formulaire envoie property_type=other."""
    response = client.post(
        "/api/predictions/estimate",
        json={"area_m2": 90, "rooms": 4, "property_type": "other", "commune": "VERSAILLES"},
    )
    assert response.status_code == 200
    assert response.json()["meta"]["property_type_used"] in {"apartment", "house"}


def test_estimate_avec_adresse(client):
    response = client.post(
        "/api/predictions/estimate",
        json={
            "area_m2": 60, "rooms": 3, "property_type": "apartment",
            "commune": "VERSAILLES", "address": "3 avenue de Paris, 78000 Versailles",
        },
    )
    assert response.status_code == 200


def test_estimate_adresse_seule(client):
    response = client.post(
        "/api/predictions/estimate",
        json={"area_m2": 60, "property_type": "apartment",
              "address": "3 avenue de Paris, 78000 Versailles"},
    )
    assert response.status_code == 200


def test_estimate_commune_inconnue(client):
    response = client.post(
        "/api/predictions/estimate",
        json={"area_m2": 60, "rooms": 3, "property_type": "apartment", "commune": "Trifouillis"},
    )
    assert response.status_code == 404
    assert isinstance(response.json()["detail"], str)


# ==========================================================================
#  ENDPOINTS — erreurs et repli
# ==========================================================================


def test_erreur_validation_est_une_chaine(client):
    """ResultPanel affiche e.message : une liste d'objets donnerait [object Object]."""
    response = client.post(
        "/api/predictions/estimate",
        json={"area_m2": 2, "rooms": 3, "property_type": "apartment", "commune": "PARIS 15"},
    )
    assert response.status_code == 422
    detail = response.json()["detail"]
    assert isinstance(detail, str)
    assert "surface" in detail.lower()


def test_erreur_sans_localisation(client):
    response = client.post("/api/predictions/estimate", json={"area_m2": 60})
    assert response.status_code == 422
    assert isinstance(response.json()["detail"], str)


def test_erreur_type_invalide(client):
    response = client.post(
        "/api/predictions/estimate",
        json={"area_m2": 60, "property_type": "chateau", "commune": "PARIS 15"},
    )
    assert response.status_code == 422


def test_rooms_vide_est_tolere(client):
    """Number('') === 0 côté React : ne doit pas produire une erreur."""
    response = client.post(
        "/api/predictions/estimate",
        json={"area_m2": 60, "rooms": 0, "property_type": "apartment", "commune": "PARIS 15"},
    )
    assert response.status_code == 200


def test_mock_si_dataset_absent(client_without_dvf):
    body = client_without_dvf.post(
        "/api/predictions/estimate",
        json={"area_m2": 60, "rooms": 3, "property_type": "apartment", "commune": "PARIS 15"},
    ).json()
    assert body["model"] == "mock"
    assert body["price_range"]["low"] < body["estimated_price"] < body["price_range"]["high"]