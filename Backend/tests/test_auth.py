"""Tests des endpoints d'authentification.

Couvre :
  - POST /api/auth/register  (création de compte)
  - POST /api/auth/login     (connexion)
  - GET  /api/auth/me        (profil authentifié)
  - Historique filtré par user_id (estimations liées au compte)

Utilise SQLite en mémoire via tmp_path pour isoler chaque test.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from database import SearchHistoryService
from main import app


# ==========================================================================
#  FIXTURE : client avec base auth initialisée
# ==========================================================================

@pytest.fixture
def client_auth(tmp_path, monkeypatch):
    """Client avec une base SQLite fraîche incluant la table users."""
    db_url = f"sqlite:///{tmp_path / 'auth_test.db'}"
    monkeypatch.setenv("DATABASE_URL", db_url)

    service = SearchHistoryService(database_url=db_url)
    service.init_db()

    with TestClient(app) as c:
        c.app.state.search_history = service
        yield c


# ==========================================================================
#  REGISTER
# ==========================================================================

class TestRegister:

    def test_register_cree_un_compte(self, client_auth):
        r = client_auth.post(
            "/api/auth/register",
            json={"email": "alice@example.com", "password": "motdepasse123"},
        )
        assert r.status_code == 200
        body = r.json()
        assert "token" in body
        assert body["user"]["email"] == "alice@example.com"
        assert isinstance(body["user"]["id"], int)

    def test_register_token_non_vide(self, client_auth):
        r = client_auth.post(
            "/api/auth/register",
            json={"email": "bob@example.com", "password": "secret99"},
        )
        assert len(r.json()["token"]) > 20

    def test_register_email_deja_utilise_retourne_409(self, client_auth):
        payload = {"email": "double@example.com", "password": "abcdef"}
        client_auth.post("/api/auth/register", json=payload)
        r = client_auth.post("/api/auth/register", json=payload)
        assert r.status_code == 409
        assert "existe déjà" in r.json()["detail"]

    def test_register_password_trop_court_retourne_422(self, client_auth):
        r = client_auth.post(
            "/api/auth/register",
            json={"email": "short@example.com", "password": "abc"},  # < 6 chars
        )
        assert r.status_code == 422

    def test_register_email_invalide_retourne_422(self, client_auth):
        r = client_auth.post(
            "/api/auth/register",
            json={"email": "ab", "password": "motdepasse"},  # < 3 chars
        )
        assert r.status_code == 422

    def test_register_password_vide_retourne_422(self, client_auth):
        r = client_auth.post(
            "/api/auth/register",
            json={"email": "vide@example.com", "password": ""},
        )
        assert r.status_code == 422


# ==========================================================================
#  LOGIN
# ==========================================================================

class TestLogin:

    @pytest.fixture(autouse=True)
    def _creer_compte(self, client_auth):
        client_auth.post(
            "/api/auth/register",
            json={"email": "user@example.com", "password": "bonmotdepasse"},
        )

    def test_login_bon_mot_de_passe_retourne_token(self, client_auth):
        r = client_auth.post(
            "/api/auth/login",
            json={"email": "user@example.com", "password": "bonmotdepasse"},
        )
        assert r.status_code == 200
        body = r.json()
        assert "token" in body
        assert body["user"]["email"] == "user@example.com"

    def test_login_mauvais_mot_de_passe_retourne_401(self, client_auth):
        r = client_auth.post(
            "/api/auth/login",
            json={"email": "user@example.com", "password": "mauvais"},
        )
        assert r.status_code == 401
        assert "mot de passe" in r.json()["detail"].lower() or "incorrect" in r.json()["detail"].lower()

    def test_login_email_inconnu_retourne_401(self, client_auth):
        r = client_auth.post(
            "/api/auth/login",
            json={"email": "fantome@example.com", "password": "quelconque"},
        )
        assert r.status_code == 401

    def test_login_password_vide_retourne_422(self, client_auth):
        """password min_length=1 pour login → vide doit échouer la validation."""
        r = client_auth.post(
            "/api/auth/login",
            json={"email": "user@example.com", "password": ""},
        )
        assert r.status_code == 422

    def test_login_message_erreur_est_une_chaine(self, client_auth):
        """Le frontend lit e.message : une liste d'objets donnerait [object Object]."""
        r = client_auth.post(
            "/api/auth/login",
            json={"email": "user@example.com", "password": "mauvais"},
        )
        assert isinstance(r.json()["detail"], str)


# ==========================================================================
#  ME
# ==========================================================================

class TestMe:

    @pytest.fixture
    def token(self, client_auth):
        r = client_auth.post(
            "/api/auth/register",
            json={"email": "me@example.com", "password": "passvalide"},
        )
        return r.json()["token"]

    def test_me_avec_token_valide(self, client_auth, token):
        r = client_auth.get(
            "/api/auth/me",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert r.status_code == 200
        body = r.json()
        assert body["email"] == "me@example.com"
        assert isinstance(body["id"], int)

    def test_me_sans_token_retourne_401(self, client_auth):
        r = client_auth.get("/api/auth/me")
        assert r.status_code == 401

    def test_me_token_invalide_retourne_401(self, client_auth):
        r = client_auth.get(
            "/api/auth/me",
            headers={"Authorization": "Bearer token.faux.invalide"},
        )
        assert r.status_code == 401

    def test_me_header_malformed_retourne_401(self, client_auth):
        """Sans le préfixe 'Bearer ' le token ne doit pas être lu."""
        r = client_auth.get(
            "/api/auth/me",
            headers={"Authorization": "Basic dXNlcjpwYXNz"},
        )
        assert r.status_code == 401


# ==========================================================================
#  HISTORIQUE FILTRÉ PAR USER
# ==========================================================================

class TestHistoriqueParUser:

    @pytest.fixture(autouse=True)
    def _setup_dvf(self, client_auth):
        """Injecte un dataset minimal pour que /estimate fonctionne."""
        import numpy as np
        import pandas as pd
        from utils.dvf_search import commune_display_names, prepare_index

        rng = np.random.default_rng(7)
        rows = []
        for _ in range(60):
            surface = float(rng.integers(30, 100))
            ppm2 = float(10_000 * rng.normal(1.0, 0.08))
            rows.append({
                "commune": "PARIS 15", "dep": "75",
                "code_postal": "75015", "type_bien": "apartment",
                "surface_m2": surface,
                "nb_pieces": float(max(1, round(surface / 25))),
                "prix_vente": round(surface * ppm2, 2),
                "prix_au_m2": round(ppm2, 2),
            })
        dvf = prepare_index(pd.DataFrame(rows))
        client_auth.app.state.dvf = dvf
        client_auth.app.state.dvf_error = None
        client_auth.app.state.communes = commune_display_names(dvf)

    def _register_and_token(self, client, email):
        r = client.post(
            "/api/auth/register",
            json={"email": email, "password": "mdp_valide"},
        )
        return r.json()["token"]

    def _estimate(self, client, token=None):
        headers = {"Authorization": f"Bearer {token}"} if token else {}
        return client.post(
            "/api/predictions/estimate",
            json={"area_m2": 60, "rooms": 3, "property_type": "apartment", "commune": "PARIS 15"},
            headers=headers,
        )

    def test_estimation_anonyme_visible_sans_auth(self, client_auth):
        self._estimate(client_auth)
        r = client_auth.get("/api/search-history")
        assert r.status_code == 200
        assert len(r.json()) >= 1

    def test_estimation_liee_au_compte(self, client_auth):
        token = self._register_and_token(client_auth, "proprio@example.com")
        self._estimate(client_auth, token)

        r = client_auth.get(
            "/api/search-history",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert r.status_code == 200
        entries = r.json()
        assert len(entries) >= 1
        assert entries[0]["commune"] == "PARIS 15"

    def test_deux_users_ne_voient_pas_les_estimations_des_autres(self, client_auth):
        token_a = self._register_and_token(client_auth, "alice2@example.com")
        token_b = self._register_and_token(client_auth, "bob2@example.com")

        self._estimate(client_auth, token_a)

        r_b = client_auth.get(
            "/api/search-history",
            headers={"Authorization": f"Bearer {token_b}"},
        )
        assert r_b.status_code == 200
        # Bob n'a rien estimé : son historique doit être vide
        assert r_b.json() == []

    def test_estimation_anonyme_non_visible_quand_connecte(self, client_auth):
        """Une estimation faite sans token ne remonte pas dans l'historique d'un user."""
        self._estimate(client_auth)  # anonyme
        token = self._register_and_token(client_auth, "newuser@example.com")
        r = client_auth.get(
            "/api/search-history",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert r.json() == []
