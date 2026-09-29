"""Configuration pytest partagée pour tous les tests backend."""

import pytest
from main import app


@pytest.fixture(autouse=True)
def reset_rate_limiter():
    """Remet à zéro le compteur slowapi avant chaque test.

    Sans ce reset, le limiteur (3 req/min sur /api/auth/register) accumule
    les appels sur toute la session pytest — les tests suivants reçoivent 429
    au lieu du code métier attendu.
    """
    try:
        app.state.limiter._storage.reset()
    except Exception:
        pass
    yield
