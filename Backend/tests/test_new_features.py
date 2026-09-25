"""Tests des nouvelles fonctionnalités.

Couvre :
  - POST /api/auth/forgot-password
  - POST /api/auth/reset-password
  - PUT  /api/auth/me/password
  - DELETE /api/history/{item_id}
  - DELETE /api/history             (vider tout)
  - DELETE /api/auth/me             (suppression de compte)
  - GET  /api/financing/rates
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from database import SearchHistoryService
from main import app


# ==========================================================================
#  FIXTURE
# ==========================================================================

@pytest.fixture
def client_auth(tmp_path, monkeypatch):
    db_url = f"sqlite:///{tmp_path / 'test.db'}"
    monkeypatch.setenv("DATABASE_URL", db_url)
    service = SearchHistoryService(database_url=db_url)
    service.init_db()
    with TestClient(app) as c:
        c.app.state.search_history = service
        yield c


@pytest.fixture(autouse=True)
def reset_rate_limiter():
    """Réinitialise le stockage du limiteur de taux entre chaque test."""
    import main
    storage = getattr(main._limiter, '_storage', None)
    if storage is not None and hasattr(storage, 'reset'):
        try:
            storage.reset()
        except Exception:
            pass
    yield


def _register(client, email="user@example.com", password="pass123"):
    r = client.post("/api/auth/register", json={"email": email, "password": password})
    assert r.status_code == 200
    return r.json()["token"]


def _auth_headers(token):
    return {"Authorization": f"Bearer {token}"}


# ==========================================================================
#  FORGOT PASSWORD
# ==========================================================================

class TestForgotPassword:

    def test_email_existant_retourne_dev_token(self, client_auth):
        _register(client_auth)
        r = client_auth.post("/api/auth/forgot-password", json={"email": "user@example.com"})
        assert r.status_code == 200
        body = r.json()
        assert "message" in body
        assert body["dev_token"] is not None
        assert len(body["dev_token"]) == 36  # UUID v4

    def test_email_inexistant_ne_revele_pas_existence(self, client_auth):
        r = client_auth.post("/api/auth/forgot-password", json={"email": "ghost@example.com"})
        assert r.status_code == 200
        body = r.json()
        assert "message" in body
        assert body["dev_token"] is None


# ==========================================================================
#  RESET PASSWORD
# ==========================================================================

class TestResetPassword:

    @pytest.fixture
    def token_reset(self, client_auth):
        _register(client_auth, "reset@example.com", "oldpass1")
        # Create reset token directly via service to avoid rate limiter
        service = client_auth.app.state.search_history
        result = service.create_reset_token("reset@example.com")
        return result["token"]

    def test_token_valide_change_mot_de_passe(self, client_auth, token_reset):
        r = client_auth.post(
            "/api/auth/reset-password",
            json={"token": token_reset, "new_password": "newpass1"},
        )
        assert r.status_code == 200
        assert "réinitialisé" in r.json()["message"].lower()

    def test_connexion_apres_reset(self, client_auth, token_reset):
        client_auth.post(
            "/api/auth/reset-password",
            json={"token": token_reset, "new_password": "newpass1"},
        )
        r = client_auth.post(
            "/api/auth/login",
            json={"email": "reset@example.com", "password": "newpass1"},
        )
        assert r.status_code == 200

    def test_ancien_mot_de_passe_invalide_apres_reset(self, client_auth, token_reset):
        client_auth.post(
            "/api/auth/reset-password",
            json={"token": token_reset, "new_password": "newpass1"},
        )
        r = client_auth.post(
            "/api/auth/login",
            json={"email": "reset@example.com", "password": "oldpass1"},
        )
        assert r.status_code == 401

    def test_token_deja_utilise_retourne_400(self, client_auth, token_reset):
        payload = {"token": token_reset, "new_password": "newpass1"}
        client_auth.post("/api/auth/reset-password", json=payload)
        r = client_auth.post("/api/auth/reset-password", json=payload)
        assert r.status_code == 400
        assert "invalide" in r.json()["detail"].lower() or "expiré" in r.json()["detail"].lower()

    def test_token_inconnu_retourne_400(self, client_auth):
        r = client_auth.post(
            "/api/auth/reset-password",
            json={"token": "00000000-0000-0000-0000-000000000000", "new_password": "newpass1"},
        )
        assert r.status_code == 400


# ==========================================================================
#  CHANGE PASSWORD
# ==========================================================================

class TestChangePassword:

    @pytest.fixture
    def token(self, client_auth):
        return _register(client_auth, "pw@example.com", "oldpass1")

    def test_bon_mot_de_passe_change(self, client_auth, token):
        r = client_auth.put(
            "/api/auth/me/password",
            json={"current_password": "oldpass1", "new_password": "newpass99"},
            headers=_auth_headers(token),
        )
        assert r.status_code == 200
        assert "modifié" in r.json()["message"].lower()

    def test_mauvais_mot_de_passe_actuel_retourne_400(self, client_auth, token):
        r = client_auth.put(
            "/api/auth/me/password",
            json={"current_password": "mauvais", "new_password": "newpass99"},
            headers=_auth_headers(token),
        )
        assert r.status_code == 400

    def test_sans_auth_retourne_401(self, client_auth):
        r = client_auth.put(
            "/api/auth/me/password",
            json={"current_password": "oldpass1", "new_password": "newpass99"},
        )
        assert r.status_code == 401

    def test_nouveau_mdp_trop_court_retourne_422(self, client_auth, token):
        r = client_auth.put(
            "/api/auth/me/password",
            json={"current_password": "oldpass1", "new_password": "abc"},
            headers=_auth_headers(token),
        )
        assert r.status_code == 422


# ==========================================================================
#  DELETE HISTORY ITEM
# ==========================================================================

class TestDeleteHistoryItem:

    @pytest.fixture(autouse=True)
    def _setup_dvf(self, client_auth):
        import numpy as np
        import pandas as pd
        from utils.dvf_search import commune_display_names, prepare_index

        rng = np.random.default_rng(42)
        rows = []
        for _ in range(60):
            surface = float(rng.integers(30, 100))
            ppm2 = float(10_000 * rng.normal(1.0, 0.08))
            rows.append({
                "commune": "PARIS 10", "dep": "75",
                "code_postal": "75010", "type_bien": "apartment",
                "surface_m2": surface,
                "nb_pieces": float(max(1, round(surface / 25))),
                "prix_vente": round(surface * ppm2, 2),
                "prix_au_m2": round(ppm2, 2),
            })
        dvf = prepare_index(pd.DataFrame(rows))
        client_auth.app.state.dvf = dvf
        client_auth.app.state.dvf_error = None
        client_auth.app.state.communes = commune_display_names(dvf)

    def _estimate(self, client, token):
        return client.post(
            "/api/predictions/estimate",
            json={"area_m2": 50, "rooms": 2, "property_type": "apartment", "commune": "PARIS 10"},
            headers=_auth_headers(token),
        )

    def test_supprimer_sa_propre_estimation(self, client_auth):
        token = _register(client_auth, "del@example.com")
        self._estimate(client_auth, token)
        history = client_auth.get("/api/search-history", headers=_auth_headers(token)).json()
        item_id = history[0]["id"]
        r = client_auth.delete(f"/api/history/{item_id}", headers=_auth_headers(token))
        assert r.status_code == 200
        history2 = client_auth.get("/api/search-history", headers=_auth_headers(token)).json()
        assert all(i["id"] != item_id for i in history2)

    def test_supprimer_estimation_autre_user_retourne_404(self, client_auth):
        token_a = _register(client_auth, "a@example.com")
        token_b = _register(client_auth, "b@example.com")
        self._estimate(client_auth, token_a)
        history = client_auth.get("/api/search-history", headers=_auth_headers(token_a)).json()
        item_id = history[0]["id"]
        r = client_auth.delete(f"/api/history/{item_id}", headers=_auth_headers(token_b))
        assert r.status_code == 404

    def test_supprimer_item_inexistant_retourne_404(self, client_auth):
        token = _register(client_auth, "notfound@example.com")
        r = client_auth.delete("/api/history/999999", headers=_auth_headers(token))
        assert r.status_code == 404


# ==========================================================================
#  CLEAR HISTORY (DELETE /api/history)
# ==========================================================================

class TestClearHistory:

    @pytest.fixture(autouse=True)
    def _setup_dvf(self, client_auth):
        import numpy as np
        import pandas as pd
        from utils.dvf_search import commune_display_names, prepare_index

        rng = np.random.default_rng(99)
        rows = []
        for _ in range(60):
            surface = float(rng.integers(30, 100))
            ppm2 = float(10_000 * rng.normal(1.0, 0.08))
            rows.append({
                "commune": "PARIS 11", "dep": "75",
                "code_postal": "75011", "type_bien": "apartment",
                "surface_m2": surface,
                "nb_pieces": float(max(1, round(surface / 25))),
                "prix_vente": round(surface * ppm2, 2),
                "prix_au_m2": round(ppm2, 2),
            })
        dvf = prepare_index(pd.DataFrame(rows))
        client_auth.app.state.dvf = dvf
        client_auth.app.state.dvf_error = None
        client_auth.app.state.communes = commune_display_names(dvf)

    def _estimate(self, client, token):
        return client.post(
            "/api/predictions/estimate",
            json={"area_m2": 50, "rooms": 2, "property_type": "apartment", "commune": "PARIS 11"},
            headers=_auth_headers(token),
        )

    def test_vider_historique_supprime_toutes_les_estimations(self, client_auth):
        token = _register(client_auth, "clear@example.com")
        self._estimate(client_auth, token)
        self._estimate(client_auth, token)
        r = client_auth.delete("/api/history", headers=_auth_headers(token))
        assert r.status_code == 200
        assert r.json()["deleted"] >= 2
        history = client_auth.get("/api/search-history", headers=_auth_headers(token)).json()
        assert history == []

    def test_vider_sans_auth_retourne_401(self, client_auth):
        r = client_auth.delete("/api/history")
        assert r.status_code == 401

    def test_vider_ne_supprime_pas_estimations_autres_users(self, client_auth):
        token_a = _register(client_auth, "ca@example.com")
        token_b = _register(client_auth, "cb@example.com")
        self._estimate(client_auth, token_a)
        self._estimate(client_auth, token_b)
        client_auth.delete("/api/history", headers=_auth_headers(token_a))
        history_b = client_auth.get("/api/search-history", headers=_auth_headers(token_b)).json()
        assert len(history_b) >= 1


# ==========================================================================
#  DELETE ACCOUNT
# ==========================================================================

class TestDeleteAccount:

    def test_supprimer_compte_retourne_200(self, client_auth):
        token = _register(client_auth, "bye@example.com")
        r = client_auth.delete("/api/auth/me", headers=_auth_headers(token))
        assert r.status_code == 200
        assert "supprimé" in r.json()["message"].lower()

    def test_connexion_impossible_apres_suppression(self, client_auth):
        token = _register(client_auth, "bye2@example.com", "pass123")
        client_auth.delete("/api/auth/me", headers=_auth_headers(token))
        r = client_auth.post("/api/auth/login", json={"email": "bye2@example.com", "password": "pass123"})
        assert r.status_code == 401

    def test_sans_auth_retourne_401(self, client_auth):
        r = client_auth.delete("/api/auth/me")
        assert r.status_code == 401


# ==========================================================================
#  FINANCING RATES
# ==========================================================================

class TestFinancingRates:

    def test_rates_retourne_taux_par_duree(self, client_auth):
        r = client_auth.get("/api/financing/rates")
        assert r.status_code == 200
        body = r.json()
        assert "taux_par_duree" in body
        assert isinstance(body["taux_par_duree"], dict)
        assert len(body["taux_par_duree"]) >= 1

    def test_rates_contient_taux_assurance(self, client_auth):
        r = client_auth.get("/api/financing/rates")
        body = r.json()
        assert "taux_assurance" in body
        assert isinstance(body["taux_assurance"], float)

    def test_rates_contient_millesime(self, client_auth):
        r = client_auth.get("/api/financing/rates")
        body = r.json()
        assert "millesime" in body
        assert isinstance(body["millesime"], int)
