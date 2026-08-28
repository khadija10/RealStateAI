"""
Tests de la couche silver — la déduplication est LA règle critique du pipeline.

On travaille sur un échantillon synthétique volontairement pathologique
(cf. fabrique_dvf.py) : doublons stricts, mutations éclatées sur plusieurs
lots, ventes multi-biens, valeurs manquantes.
"""

from __future__ import annotations

import os
from pathlib import Path

import duckdb
import pytest

from fabrique_dvf import generer
from realstate_data.cleaning.silver import construire_silver
from realstate_data.config import charger_settings


@pytest.fixture(scope="module")
def silver(tmp_path_factory) -> tuple[Path, dict]:
    """Exécute le pipeline silver dans un dossier temporaire isolé."""
    racine = tmp_path_factory.mktemp("data")
    os.environ["REALSTATE_DATA_ROOT"] = str(racine)
    charger_settings.cache_clear()          # la config est mise en cache

    settings = charger_settings()
    settings.chemins.creer_dossiers()
    generer(settings.chemins.raw / "dvf_2021_75.csv.gz", n_mutations=800)

    rapport = construire_silver(settings)
    return settings.chemins.interim / "silver_mutations.parquet", rapport


def test_une_ligne_par_mutation(silver):
    """Après agrégation, id_mutation doit être une clé primaire."""
    chemin, _ = silver
    lignes, mutations = duckdb.sql(
        f"SELECT count(*), count(DISTINCT id_mutation) FROM read_parquet('{chemin}')"
    ).fetchone()
    assert lignes == mutations, "Doublons résiduels sur id_mutation"


ENTETE = (
    "id_mutation,date_mutation,nature_mutation,valeur_fonciere,code_postal,"
    "code_commune,nom_commune,code_departement,id_parcelle,code_type_local,"
    "type_local,surface_reelle_bati,nombre_pieces_principales,surface_terrain,"
    "longitude,latitude"
)

# Une seule vente : un appartement de 60 m² à 300 000 €, réparti sur 3 lots.
# La valeur foncière est répétée à l'identique sur les 3 lignes.
# Attendu après agrégation : 1 ligne, 60 m², 300 000 €, soit 5 000 €/m².
CAS_CONTROLE = [
    "2023-000001,2023-05-12,Vente,300000,75011,75056,Paris,75,75056000AB0001,2,Appartement,60,3,,2.37,48.86",
    "2023-000001,2023-05-12,Vente,300000,75011,75056,Paris,75,75056000AB0001,2,Appartement,60,3,,2.37,48.86",
    "2023-000001,2023-05-12,Vente,300000,75011,75056,Paris,75,75056000AB0001,2,Appartement,60,3,,2.37,48.86",
]


def test_valeur_fonciere_non_sommee(tmp_path, monkeypatch):
    """
    Le piège classique : sommer valeur_fonciere sur les lignes d'une mutation
    multiplie le prix par le nombre de lots (ici : 900 000 € au lieu de
    300 000 €). Test sur un cas construit à la main, aux valeurs connues.
    """
    import gzip

    monkeypatch.setenv("REALSTATE_DATA_ROOT", str(tmp_path))
    charger_settings.cache_clear()
    settings = charger_settings()
    settings.chemins.creer_dossiers()

    with gzip.open(settings.chemins.raw / "dvf_2023_75.csv.gz", "wt", encoding="utf-8") as f:
        f.write(ENTETE + "\n" + "\n".join(CAS_CONTROLE) + "\n")

    construire_silver(settings)
    chemin = settings.chemins.interim / "silver_mutations.parquet"
    lignes, valeur, surface = duckdb.sql(
        f"SELECT count(*), max(valeur_fonciere), max(surface_bati) "
        f"FROM read_parquet('{chemin}')"
    ).fetchone()

    charger_settings.cache_clear()
    assert lignes == 1, "Les 3 lignes de la mutation doivent être fusionnées en une seule"
    assert valeur == 300_000, f"Valeur foncière sommée à tort : {valeur}"
    assert surface == 60, f"Surface sommée à tort sur les lots : {surface}"
    assert valeur / surface == 5_000


def test_aucune_dependance_ni_local_commercial(silver):
    """Seuls maisons (1) et appartements (2) doivent subsister."""
    chemin, _ = silver
    types = {
        t[0] for t in duckdb.sql(
            f"SELECT DISTINCT code_type_local FROM read_parquet('{chemin}')"
        ).fetchall()
    }
    assert types <= {"1", "2"}, f"Types de local inattendus : {types}"


def test_journal_de_perte_coherent(silver):
    """Le nombre de mutations ne peut que décroître le long du pipeline."""
    _, rapport = silver
    mutations = [e["mutations"] for e in rapport["etapes"]]
    assert mutations == sorted(mutations, reverse=True)
    # Garde-fou : si on perd plus de 60 % des mutations, un filtre est trop
    # agressif et la représentativité du dataset devient contestable.
    assert rapport["taux_conservation_mutations"] > 0.40


def test_pas_de_surface_nulle(silver):
    chemin, _ = silver
    minimum = duckdb.sql(
        f"SELECT min(surface_bati) FROM read_parquet('{chemin}')"
    ).fetchone()[0]
    assert minimum >= 9
