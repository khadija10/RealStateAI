"""
Tests du contrôle qualité.

On vérifie deux choses symétriques, et la seconde est la plus importante :
  - un dataset correct passe tous les contrôles ;
  - un dataset corrompu est bien DÉTECTÉ.

Un test de qualité qui ne sait pas échouer ne prouve rien.
"""

from __future__ import annotations

import os

import duckdb
import pandas as pd
import pytest

from fabrique_dvf import generer
from realstate_data.cleaning.silver import construire_silver
from realstate_data.config import charger_settings
from realstate_data.features.gold import construire_gold
from realstate_data.quality.validators import construire_schema, valider


@pytest.fixture(scope="module")
def dataset(tmp_path_factory):
    """Construit un dataset gold complet dans un dossier temporaire isolé."""
    racine = tmp_path_factory.mktemp("qualite")
    os.environ["REALSTATE_DATA_ROOT"] = str(racine)
    charger_settings.cache_clear()

    settings = charger_settings()
    settings.chemins.creer_dossiers()
    for annee in (2022, 2023, 2024):
        for departement in ("75", "92"):
            generer(
                settings.chemins.raw / f"dvf_{annee}_{departement}.csv.gz",
                n_mutations=700,
                graine=annee + int(departement),
            )
    construire_silver(settings)
    construire_gold(settings)
    yield settings
    charger_settings.cache_clear()


def test_schema_conforme(dataset):
    """Le dataset produit doit respecter le schéma du contrat d'interface."""
    rapport = valider(dataset)
    assert not rapport.erreurs_schema, f"Violations : {rapport.erreurs_schema[:5]}"


def test_cle_primaire_unique(dataset):
    controle = next(c for c in valider(dataset).controles
                    if c.nom == "doublons id_mutation")
    assert controle.ok


def test_coherence_prix_m2(dataset):
    """prix_m2 doit rester égal à valeur_fonciere / surface_bati."""
    controle = next(c for c in valider(dataset).controles
                    if c.nom == "cohérence prix_m2")
    assert controle.ok


def test_detecte_un_doublon_injecte(dataset):
    """
    Test négatif : on duplique une ligne et le schéma doit le refuser.
    C'est ce test qui prouve que le contrôle sert à quelque chose.
    """
    dossier = dataset.chemins.processed / "gold_transactions"
    df = duckdb.sql(
        f"SELECT * FROM read_parquet('{dossier}/**/*.parquet', hive_partitioning=true)"
    ).df()
    corrompu = pd.concat([df, df.head(1)], ignore_index=True)

    with pytest.raises(Exception):
        construire_schema(dataset).validate(corrompu, lazy=True)


def test_detecte_une_surface_aberrante(dataset):
    """Test négatif : une surface sous le seuil de décence doit être refusée."""
    dossier = dataset.chemins.processed / "gold_transactions"
    df = duckdb.sql(
        f"SELECT * FROM read_parquet('{dossier}/**/*.parquet', hive_partitioning=true)"
    ).df()
    df.loc[df.index[0], "surface_bati"] = 2.0

    with pytest.raises(Exception):
        construire_schema(dataset).validate(df, lazy=True)


def test_arrondissement_extrait_pour_paris(dataset):
    """
    DVF code Paris par arrondissement (75101 à 75120). La colonne doit être
    exposée en clair, sinon l'information reste noyée dans le code commune.
    """
    import duckdb

    dossier = dataset.chemins.processed / "gold_transactions"
    lignes = duckdb.sql(f"""
        SELECT DISTINCT ville, arrondissement, code_commune
        FROM read_parquet('{dossier}/**/*.parquet', hive_partitioning=true)
        WHERE code_commune BETWEEN '75101' AND '75120'
    """).fetchall()

    assert lignes, "Aucune mutation parisienne dans l'échantillon"
    for ville, arrondissement, code in lignes:
        assert ville == "Paris"
        assert arrondissement == int(code[3:])
        assert 1 <= arrondissement <= 20


def test_arrondissement_nul_hors_paris_lyon_marseille(dataset):
    """Une commune ordinaire n'a pas d'arrondissement."""
    import duckdb

    dossier = dataset.chemins.processed / "gold_transactions"
    nuls = duckdb.sql(f"""
        SELECT count(*) FROM read_parquet('{dossier}/**/*.parquet',
                                          hive_partitioning=true)
        WHERE code_commune NOT BETWEEN '75101' AND '75120'
          AND arrondissement IS NOT NULL
    """).fetchone()[0]
    assert nuls == 0
