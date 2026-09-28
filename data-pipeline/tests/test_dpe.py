"""
Tests de l'enrichissement DPE.

L'appariement DVF / DPE est vérifié contre une VÉRITÉ TERRAIN : le générateur
synthétique place le vrai DPE de chaque vente, plus des leurres — les
appartements voisins du même immeuble, de surfaces différentes. On mesure
ensuite si la méthode retrouve le bon logement.

C'est ce qui permet d'annoncer un taux de précision, et pas seulement un taux
d'appariement : apparier beaucoup n'a aucune valeur si c'est pour attribuer
le DPE du voisin.
"""

from __future__ import annotations

import os

import duckdb
import pytest

from fabrique_dpe import generer_dpe
from fabrique_dvf import generer
from realstate_data.cleaning.silver import construire_silver
from realstate_data.config import charger_settings
from realstate_data.enrichment.dpe import COLONNES_DPE_GOLD, macro_normalisation
from realstate_data.features.gold import construire_gold


def _gold(settings):
    dossier = settings.chemins.processed / "gold_transactions"
    return duckdb.sql(
        f"SELECT * FROM read_parquet('{dossier}/**/*.parquet', hive_partitioning=true)"
    ).df()


@pytest.fixture(scope="module")
def environnement(tmp_path_factory):
    """Pipeline complet sur échantillon, avec DPE synthétiques et vérité terrain."""
    racine = tmp_path_factory.mktemp("dpe")
    os.environ["REALSTATE_DATA_ROOT"] = str(racine)
    charger_settings.cache_clear()
    settings = charger_settings()
    settings.chemins.creer_dossiers()

    for annee in (2022, 2023, 2024):
        for departement in ("75", "92"):
            generer(settings.chemins.raw / f"dvf_{annee}_{departement}.csv.gz",
                    n_mutations=700, graine=annee + int(departement))
    construire_silver(settings)
    construire_gold(settings)                       # sans DPE
    sans_dpe = _gold(settings)

    verite = generer_dpe(settings.chemins.processed / "gold_transactions",
                         settings.chemins.external / "dpe" / "dpe_75.parquet")
    construire_gold(settings)                       # avec DPE
    yield settings, verite, sans_dpe
    charger_settings.cache_clear()


# --- Normalisation des adresses ---------------------------------------------

@pytest.mark.parametrize("dvf, ban", [
    ("AV DE LA CELLE ST CLOUD", "Avenue de la Celle-Saint-Cloud"),
    ("BD ST GERMAIN", "Boulevard Saint-Germain"),
    ("RUE DE LA ROQUETTE", "Rue de la Roquette"),
    ("AV DU GAL LECLERC", "Avenue du Général Leclerc"),
    ("PL LEON BLUM", "Place Léon Blum"),
    ("RUE STE CROIX", "Rue Sainte-Croix"),
])
def test_normalisation_rapproche_dvf_et_ban(dvf, ban):
    """Écriture FANTOIR abrégée et écriture BAN doivent donner la même clé."""
    con = duckdb.connect()
    con.execute(macro_normalisation())
    a, b = con.execute("SELECT normaliser_voie(?), normaliser_voie(?)",
                       [dvf, ban]).fetchone()
    assert a == b, f"{dvf!r} -> {a!r}  /  {ban!r} -> {b!r}"


def test_sainte_n_est_pas_confondu_avec_saint():
    """STE doit être développé avant ST, sinon STE devient SAINTE -> SAINTE."""
    con = duckdb.connect()
    con.execute(macro_normalisation())
    resultat = con.execute("SELECT normaliser_voie('RUE STE CROIX')").fetchone()[0]
    assert "SAINTE" in resultat


# --- Schéma stable -----------------------------------------------------------

def test_colonnes_dpe_presentes_meme_sans_telechargement(environnement):
    """L'équipe ML ne doit jamais gérer deux formats de dataset."""
    _, _, sans_dpe = environnement
    for colonne in COLONNES_DPE_GOLD:
        assert colonne in sans_dpe.columns
        assert sans_dpe[colonne].isna().all()


def test_adresse_exposee_dans_le_gold(environnement):
    settings, _, _ = environnement
    gold = _gold(settings)
    assert {"adresse_numero", "adresse_nom_voie"} <= set(gold.columns)
    assert gold["adresse_nom_voie"].notna().mean() > 0.9


# --- Justesse de l'appariement -----------------------------------------------

def test_precision_des_appariements_exacts(environnement):
    """
    Sur les appariements qualifiés d'exacts, le DPE retrouvé doit être le bon
    dans plus de 90 % des cas. Seuil volontairement exigeant : l'échantillon
    synthétique est plus dense en ventes par adresse que la réalité.
    """
    settings, verite, _ = environnement
    gold = _gold(settings)
    exacts = gold[gold["dpe_qualite_appariement"] == "exacte"]
    assert len(exacts) > 100
    justes = sum(verite.get(r.id_mutation) == r.dpe_classe
                 for r in exacts.itertuples())
    assert justes / len(exacts) > 0.90


def test_rappel_eleve(environnement):
    """La plupart des ventes qui ont un vrai DPE doivent le retrouver."""
    settings, verite, _ = environnement
    gold = _gold(settings)
    trouves = gold[gold["id_mutation"].isin(verite) & gold["dpe_classe"].notna()]
    assert len(trouves) / len(verite) > 0.90


def test_les_leurres_ne_sont_pas_retenus(environnement):
    """
    Les voisins de palier ont une surface très différente : l'écart de
    surface d'un appariement retenu ne doit jamais dépasser la tolérance.
    """
    settings, _, _ = environnement
    gold = _gold(settings)
    tolerance = settings.enrichissement.get("dpe_tolerance_surface", 0.10)
    apparies = gold[gold["dpe_classe"].notna()]
    assert (apparies["dpe_ecart_surface"] <= tolerance + 1e-9).all()


def test_niveaux_de_qualite_connus(environnement):
    settings, _, _ = environnement
    niveaux = set(_gold(settings)["dpe_qualite_appariement"].dropna())
    assert niveaux <= {"exacte", "probable"}


def test_classes_valides(environnement):
    settings, _, _ = environnement
    classes = set(_gold(settings)["dpe_classe"].dropna())
    assert classes <= set("ABCDEFG")


# --- Indicateur de zone ------------------------------------------------------

def test_indicateur_de_zone_est_une_proportion(environnement):
    settings, _, _ = environnement
    part = _gold(settings)["zone_part_dpe_fg"].dropna()
    assert len(part) > 0
    assert ((part >= 0) & (part <= 1)).all()


def test_indicateur_de_zone_couvre_plus_que_le_dpe_individuel(environnement):
    """Son intérêt : un signal pour les ventes sans DPE propre."""
    settings, _, _ = environnement
    gold = _gold(settings)
    assert gold["zone_part_dpe_fg"].notna().sum() >= gold["dpe_classe"].notna().sum()
