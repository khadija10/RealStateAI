"""Appels aux API externes : second essai après un délai dépassé, cache des réponses."""
import io
import json
from unittest.mock import patch

import ml.contexte as ctx
import ml.geocoding as geo


class _Reponse(io.BytesIO):
    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False


def _ok(obj):
    return _Reponse(json.dumps(obj).encode())


BAN = {"features": [{"properties": {"citycode": "75111", "score": 0.95, "label": "10 Rue X 75011 Paris",
                                    "city": "Paris", "housenumber": "10", "postcode": "75011"},
                     "geometry": {"coordinates": [2.37, 48.85]}}]}


def test_ban_second_essai_apres_delai_depasse():
    geo._CACHE_BAN.clear()
    with patch("urllib.request.urlopen", side_effect=[TimeoutError(), _ok(BAN)]) as appel:
        r = geo.geocoder_adresse("10 rue X", "75011")
    assert r["code_commune"] == "75111"
    assert appel.call_count == 2


def test_ban_reponse_en_cache():
    geo._CACHE_BAN.clear()
    with patch("urllib.request.urlopen", return_value=_ok(BAN)) as appel:
        geo.geocoder_adresse("10 rue Y", "75011")
        geo.geocoder_adresse("10 rue Y", "75011")
    assert appel.call_count == 1


def test_source_facultative_second_essai_puis_cache():
    ctx._CACHE_HTTP.clear()
    with patch("urllib.request.urlopen", side_effect=[TimeoutError(), _ok({"results": [1]})]) as appel:
        assert ctx._get_json("https://exemple.test/api", {"q": 1}) == {"results": [1]}
        assert ctx._get_json("https://exemple.test/api", {"q": 1}) == {"results": [1]}
    assert appel.call_count == 2


def test_source_facultative_indisponible_renvoie_none():
    ctx._CACHE_HTTP.clear()
    with patch("urllib.request.urlopen", side_effect=TimeoutError()):
        assert ctx._get_json("https://exemple.test/api", {"q": 2}) is None
    assert not ctx._CACHE_HTTP
