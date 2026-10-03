"""
Tests de l'enrichissement IRIS.

Deux niveaux de test, pour deux objectifs différents :

  1. Un test CIBLÉ (`test_rattachement_geometrique_et_jointure_des_statistiques`)
     sur une mini table construite à la main, avec deux polygones sans AUCUNE
     ambiguïté géométrique. Il prouve l'exactitude de la jointure
     point-dans-polygone et de la jointure attributaire, sans bruit.

  2. Des tests D'INTÉGRATION sur le pipeline complet (fixture `environnement`),
     avec les communes réelles de `fabrique_dvf`. Certaines de ces communes
     sont si proches (ex. 75116/92044, 0,04° d'écart) que leurs nuages de
     points jittés se chevauchent : on y vérifie donc la couverture globale
     et la validité des statistiques heritées, PAS la correspondance exacte
     entre une mutation et la commune qui l'a géographiquement générée —
     impossible à garantir quand deux distributions de points se recouvrent.
"""

from __future__ import annotations

import os

import duckdb
import pandas as pd
import pytest

from fabrique_dvf import generer
from fabrique_iris import IRIS_PAR_COMMUNE, generer_contours, generer_filosofi, generer_logement
from realstate_data.cleaning.silver import construire_silver
from realstate_data.config import charger_settings
from realstate_data.enrichment.iris import COLONNES_IRIS_GOLD, enrichir_iris
from realstate_data.features.gold import construire_gold


def _gold(settings):
    dossier = settings.chemins.processed / "gold_transactions"
    return duckdb.sql(
        f"SELECT * FROM read_parquet('{dossier}/**/*.parquet', hive_partitioning=true)"
    ).df()


@pytest.fixture(scope="module")
def environnement(tmp_path_factory):
    """Pipeline complet sur échantillon, avec contours et statistiques IRIS synthétiques."""
    racine = tmp_path_factory.mktemp("iris")
    os.environ["REALSTATE_DATA_ROOT"] = str(racine)
    charger_settings.cache_clear()
    settings = charger_settings()
    settings.chemins.creer_dossiers()

    # Les contours synthétiques sont écrits directement en WGS84 (comme les
    # coordonnées DVF) : on désactive la reprojection Lambert-93 attendue
    # d'un vrai contour IGN, pour isoler la logique de rattachement.
    settings.enrichissement["iris_contours_crs"] = "EPSG:4326"

    for annee in (2022, 2023, 2024):
        for departement in ("75", "92"):
            generer(settings.chemins.raw / f"dvf_{annee}_{departement}.csv.gz",
                    n_mutations=700, graine=annee + int(departement))
    construire_silver(settings)
    construire_gold(settings)                       # sans IRIS
    sans_iris = _gold(settings)

    dossier_iris = settings.chemins.external / "iris"
    generer_contours(dossier_iris / "contours_iris.gpkg")
    generer_filosofi(dossier_iris / "filosofi.csv")
    generer_logement(dossier_iris / "logement.csv")
    construire_gold(settings)                       # avec IRIS
    yield settings, sans_iris
    charger_settings.cache_clear()


# --- Schéma stable -----------------------------------------------------------

def test_colonnes_iris_presentes_meme_sans_telechargement(environnement):
    """L'équipe ML ne doit jamais gérer deux formats de dataset."""
    _, sans_iris = environnement
    for colonne in COLONNES_IRIS_GOLD:
        assert colonne in sans_iris.columns
        assert sans_iris[colonne].isna().all()


# --- Justesse géométrique et jointure des statistiques (test ciblé) ----------

def test_rattachement_geometrique_et_jointure_des_statistiques(tmp_path):
    """
    Test isolé de `enrichir_iris`, sur une mini table `gold` construite à la
    main et deux polygones sans AUCUNE ambiguïté géométrique (loin l'un de
    l'autre). Contrairement au fixture `environnement` (communes réelles
    proches, nuages de points qui se chevauchent), celui-ci prouve que la
    jointure géométrique et la jointure attributaire sont exactes, sans bruit
    stochastique.
    """
    os.environ["REALSTATE_DATA_ROOT"] = str(tmp_path)
    charger_settings.cache_clear()
    settings = charger_settings()
    settings.chemins.creer_dossiers()
    settings.enrichissement["iris_contours_crs"] = "EPSG:4326"

    dossier_iris = settings.chemins.external / "iris"
    dossier_iris.mkdir(parents=True, exist_ok=True)
    con_contours = duckdb.connect()
    con_contours.execute("INSTALL spatial; LOAD spatial;")
    con_contours.execute(f"""
        COPY (
            SELECT 'IRIS_A' AS CODE_IRIS, ST_MakeEnvelope(0.0, 0.0, 1.0, 1.0) AS geom
            UNION ALL
            SELECT 'IRIS_B' AS CODE_IRIS, ST_MakeEnvelope(10.0, 10.0, 11.0, 11.0) AS geom
        ) TO '{dossier_iris / "contours_iris.gpkg"}' WITH (FORMAT GDAL, DRIVER 'GPKG');
    """)
    (dossier_iris / "filosofi.csv").write_text(
        "IRIS;DISP_MED21\nIRIS_A;20000\nIRIS_B;40000\n", encoding="utf-8")
    (dossier_iris / "logement.csv").write_text(
        "IRIS;P21_LOG;P21_APPART;P21_RP;P21_RP_PROP\n"
        "IRIS_A;100;80;90;30\n"
        "IRIS_B;100;20;90;70\n", encoding="utf-8")

    con = duckdb.connect()
    con.execute("""
        CREATE TABLE gold AS SELECT * FROM (VALUES
            (1, 0.5, 0.5),
            (2, 10.5, 10.5),
            (3, 50.0, 50.0)
        ) AS t(id_mutation, latitude, longitude);
    """)
    bilan = enrichir_iris(con, settings)
    resultat = con.execute("SELECT * FROM gold ORDER BY id_mutation").df().set_index("id_mutation")

    # Point 1, strictement dans IRIS_A.
    assert resultat.loc[1, "code_iris"] == "IRIS_A"
    assert resultat.loc[1, "revenu_median_iris"] == pytest.approx(20000)
    assert resultat.loc[1, "part_logements_collectifs_iris"] == pytest.approx(0.8)
    assert resultat.loc[1, "part_proprietaires_iris"] == pytest.approx(30 / 90)
    assert resultat.loc[1, "iris_nb_menages"] == 90

    # Point 2, strictement dans IRIS_B.
    assert resultat.loc[2, "code_iris"] == "IRIS_B"
    assert resultat.loc[2, "revenu_median_iris"] == pytest.approx(40000)
    assert resultat.loc[2, "part_proprietaires_iris"] == pytest.approx(70 / 90)

    # Point 3, hors des deux polygones : aucun rattachement, pas d'erreur.
    assert pd.isna(resultat.loc[3, "code_iris"])
    assert pd.isna(resultat.loc[3, "revenu_median_iris"])

    assert bilan["iris_disponible"] is True
    assert bilan["ventes_rattachees_iris"] == 2
    assert bilan["ventes"] == 3


def test_reprojection_lambert93_respecte_lordre_lon_lat(tmp_path):
    """
    Régression : `ST_Transform` vers EPSG:2154 (la vraie projection des
    contours IGN, configurée par défaut dans settings.yaml) a d'abord renvoyé
    un rattachement de 0 % sur les vraies données, silencieusement — sans
    `always_xy := true`, l'autorité EPSG interprète EPSG:4326 comme
    (latitude, longitude) et pas (longitude, latitude), ce qui inverse les
    axes du point avant la jointure. Le test ciblé ci-dessus ne pouvait pas
    l'attraper : il utilise EPSG:4326 -> EPSG:4326 (transformation identité),
    qui ne passe jamais par la logique d'axes. Celui-ci utilise un vrai
    polygone en Lambert-93 (coordonnées IGN réelles, secteur de Paris) pour
    forcer une reprojection non triviale.
    """
    os.environ["REALSTATE_DATA_ROOT"] = str(tmp_path)
    charger_settings.cache_clear()
    settings = charger_settings()
    settings.chemins.creer_dossiers()
    settings.enrichissement["iris_contours_crs"] = "EPSG:2154"

    dossier_iris = settings.chemins.external / "iris"
    dossier_iris.mkdir(parents=True, exist_ok=True)
    con_contours = duckdb.connect()
    con_contours.execute("INSTALL spatial; LOAD spatial;")
    # Rectangle Lambert-93 de 5 km de côté autour de Paris 1er (lon=2.35,
    # lat=48.85 <-> X=652 301, Y=6 861 303 en EPSG:2154).
    con_contours.execute(f"""
        COPY (
            SELECT 'IRIS_PARIS' AS CODE_IRIS,
                   ST_MakeEnvelope(650000.0, 6860000.0, 655000.0, 6865000.0) AS geom
        ) TO '{dossier_iris / "contours_iris.gpkg"}' WITH (FORMAT GDAL, DRIVER 'GPKG');
    """)
    (dossier_iris / "filosofi.csv").write_text(
        "IRIS;DISP_MED21\nIRIS_PARIS;30000\n", encoding="utf-8")
    (dossier_iris / "logement.csv").write_text(
        "IRIS;P21_LOG;P21_APPART;P21_RP;P21_RP_PROP\nIRIS_PARIS;100;90;90;40\n",
        encoding="utf-8")

    con = duckdb.connect()
    con.execute("""
        CREATE TABLE gold AS
        SELECT 1 AS id_mutation, 48.85 AS latitude, 2.35 AS longitude;
    """)
    bilan = enrichir_iris(con, settings)
    resultat = con.execute("SELECT code_iris FROM gold").df()

    assert bilan["ventes_rattachees_iris"] == 1, (
        "0 rattachement = régression de l'ordre des axes ST_Transform "
        "(always_xy manquant)"
    )
    assert resultat.loc[0, "code_iris"] == "IRIS_PARIS"


def test_taux_rattachement_proche_de_cent_pour_cent(environnement):
    """
    Contrairement au DPE (couverture partielle par nature), le rattachement
    IRIS est géométrique : toute mutation géocodée doit trouver son IRIS.
    """
    settings, _ = environnement
    gold = _gold(settings)
    taux = gold["code_iris"].notna().mean()
    assert taux > 0.95


# --- Statistiques héritées : validité générale sur le pipeline complet -------
# (la correspondance exacte revenu <-> commune d'origine est testée plus haut,
# sur des polygones sans ambiguïté géométrique.)

def test_parts_sont_des_proportions(environnement):
    settings, _ = environnement
    gold = _gold(settings)
    for colonne in ("part_logements_collectifs_iris", "part_proprietaires_iris"):
        valeurs = gold[colonne].dropna()
        assert len(valeurs) > 0
        assert ((valeurs >= 0) & (valeurs <= 1)).all()


def test_nb_menages_est_un_des_effectifs_connus(environnement):
    settings, _ = environnement
    gold = _gold(settings)
    effectifs_connus = {info["nb_menages"] for info in IRIS_PAR_COMMUNE.values()}
    avec_menages = gold["iris_nb_menages"].dropna()
    assert len(avec_menages) > 100
    assert set(avec_menages.unique()) <= effectifs_connus


# --- Seuil de fiabilité --------------------------------------------------------

def test_seuil_min_menages_neutralise_les_stats_fragiles(environnement):
    """
    Sous le seuil `iris_min_menages_zone`, les statistiques doivent être
    neutralisées (NULL) même si le rattachement géométrique, lui, réussit
    toujours : seul le signal statistique est jugé trop fragile, pas la
    localisation.
    """
    settings, _ = environnement
    seuil_original = settings.enrichissement.get("iris_min_menages_zone", 50)
    try:
        # Toutes les communes synthétiques ont au moins 1200 ménages : un
        # seuil au-delà neutralise tout, ce qui isole la logique du seuil de
        # la donnée réelle d'une commune en particulier.
        settings.enrichissement["iris_min_menages_zone"] = 10_000
        construire_gold(settings)
        gold = _gold(settings)
        assert gold["code_iris"].notna().sum() > 0
        assert gold["revenu_median_iris"].notna().sum() == 0
        assert gold["part_proprietaires_iris"].notna().sum() == 0
    finally:
        settings.enrichissement["iris_min_menages_zone"] = seuil_original
        construire_gold(settings)
