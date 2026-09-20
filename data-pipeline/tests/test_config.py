"""Tests de l'étape 0 : la configuration se charge et se valide correctement."""

import pytest

from realstate_data.config import DEPARTEMENTS_IDF, Settings, charger_settings


def test_settings_se_charge():
    settings = charger_settings()
    assert settings.projet == "RealStateAI"
    assert len(settings.departements) == 8
    assert set(settings.departements) <= DEPARTEMENTS_IDF


def test_millesimes_non_vides_et_croissants():
    millesimes = charger_settings().millesimes
    assert millesimes
    assert list(millesimes) == sorted(millesimes)


def test_departement_hors_perimetre_rejete():
    """Un code hors Île-de-France doit faire échouer la validation."""
    settings = Settings(
        projet="test",
        departements=("13",),
        millesimes=(2023,),
        chemins=charger_settings().chemins,
    )
    with pytest.raises(ValueError, match="hors périmètre"):
        settings.valider()
