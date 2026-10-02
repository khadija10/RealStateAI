"""Tests de ml/contexte.py — features d'immeuble, BDNB et DPE à l'inférence.

Les définitions doivent rester celles du gold (data-pipeline, étape 5b) :
sinon le modèle reçoit en production des valeurs calculées autrement qu'à
l'entraînement. Aucun appel réseau : les API sont simulées.
"""

from __future__ import annotations

import sys
from pathlib import Path
from unittest.mock import patch

import duckdb
import pandas as pd
import pytest

ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT / "ml"))

import contexte as ctx


@pytest.fixture
def gold(tmp_path: Path) -> Path:
    """Mini gold : un immeuble (P1) avec 3 ventes d'appartements, dont une
    hors fenêtre de 24 mois, et une revente du lot 12."""
    dossier = tmp_path / "gold" / "annee=2025"
    dossier.mkdir(parents=True)
    fin = 311  # mois_index de décembre 2025
    df = pd.DataFrame([
        # parcelle, type, mois_index, prix_m2, référence, lot, surface
        ("P1", "2", fin - 30, 8000.0, 8000.0, "12", 50.0),   # hors fenêtre : ratio 1,00
        ("P1", "2", fin - 10, 9900.0, 9000.0, "7", 40.0),    # ratio 1,10
        ("P1", "2", fin - 2, 10800.0, 9000.0, "12", 51.0),   # ratio 1,20, revente du lot 12
        ("P1", "1", fin - 2, 5000.0, 5000.0, None, 90.0),    # maison : autre type
        ("P2", "2", fin, 7000.0, 7000.0, "1", 30.0),
    ], columns=["id_parcelle", "code_type_local", "mois_index", "prix_m2",
                "prix_m2_reference_12m", "lot1_numero", "surface_bati"])
    df["date_mutation"] = pd.Timestamp("2025-01-01")
    df["code_commune"], df["latitude"], df["longitude"] = "75111", 48.86, 2.37
    df["adresse_numero"] = "12"
    df.loc[df["id_parcelle"] == "P2", ["latitude", "revenu_median_iris"]] = [48.8601, 50_000.0]
    df["code_iris"] = "751114403"
    df["revenu_median_iris"] = df["revenu_median_iris"].fillna(30_000.0) if "revenu_median_iris" in df else 30_000.0
    df["part_logements_collectifs_iris"], df["part_proprietaires_iris"] = 0.98, 0.35
    df["nb_pieces"] = 2.0
    df["valeur_fonciere"] = df["prix_m2"] * df["surface_bati"]
    duckdb.sql("SELECT * FROM df").write_parquet(str(dossier / "part.parquet"))
    return tmp_path / "gold"


class TestImmeuble:
    def test_mediane_indexee_sur_24_mois(self, gold):
        r = ctx.features_immeuble("P1", "2", 320, prix_m2_reference=10_000.0,
                                  surface=50.0, gold_path=gold)
        # Fenêtre : ratios 1,10 et 1,20 (la vente à fin-30 est exclue) → médiane 1,15
        assert r["nb_ventes_immeuble"] == 2
        assert r["prix_m2_immeuble_indexe"] == pytest.approx(11_500.0)

    def test_autre_type_ignore(self, gold):
        r = ctx.features_immeuble("P1", "1", 320, 6_000.0, 90.0, gold_path=gold)
        assert r["nb_ventes_immeuble"] == 1
        assert r["prix_m2_immeuble_indexe"] == pytest.approx(6_000.0)

    def test_revente_du_meme_lot(self, gold):
        r = ctx.features_immeuble("P1", "2", 320, 10_000.0, 50.0, lot="12", gold_path=gold)
        # Vente la plus récente du lot 12 (surface 51 m², à 10 % près) : ratio 1,20
        assert r["prix_m2_precedent_indexe"] == pytest.approx(12_000.0)
        assert r["mois_depuis_vente_precedente"] == 320 - 309

    def test_revente_surface_trop_differente(self, gold):
        r = ctx.features_immeuble("P1", "2", 320, 10_000.0, 80.0, lot="12", gold_path=gold)
        assert r["prix_m2_precedent_indexe"] is None

    def test_sans_lot_pas_de_revente(self, gold):
        r = ctx.features_immeuble("P1", "2", 320, 10_000.0, 50.0, gold_path=gold)
        assert r["prix_m2_precedent_indexe"] is None

    def test_comparables_les_plus_recents_d_abord(self, gold):
        r = ctx.features_immeuble("P1", "2", 320, 10_000.0, 50.0, gold_path=gold)
        assert len(r["comparables_immeuble"]) == 3
        assert {"date", "surface_m2", "prix", "prix_m2", "prix_m2_aujourdhui"} <= set(r["comparables_immeuble"][0])

    def test_parcelle_inconnue(self, gold):
        r = ctx.features_immeuble(None, "2", 320, 10_000.0, 50.0, gold_path=gold)
        assert r["prix_m2_immeuble_indexe"] is None
        assert r["nb_ventes_immeuble"] == 0
        assert r["comparables_immeuble"] == []


class TestBdnb:
    def test_lecture_par_parcelle(self, tmp_path):
        chemin = tmp_path / "bdnb.parquet"
        df = pd.DataFrame([{"id_parcelle": "P1", "bdnb_nb_niveaux": 6, "bdnb_hauteur_max": 18.0,
                            "bdnb_annee_construction": 1900, "bdnb_nb_logements": 20,
                            "bdnb_mat_mur": "PIERRE", "bdnb_distance_monument": 120.0,
                            "bdnb_part_logement_social": 0.0, "bdnb_qpv": False}])
        duckdb.sql("SELECT * FROM df").write_parquet(str(chemin))
        r = ctx.features_bdnb("P1", chemin)
        assert r["bdnb_nb_niveaux"] == 6
        assert r["bdnb_qpv"] == 0

    def test_parcelle_absente(self, tmp_path):
        assert ctx.features_bdnb("P9", tmp_path / "absent.parquet")["bdnb_nb_niveaux"] is None


class TestDpe:
    def test_deperdition_rapportee_a_la_surface(self):
        reponse = {"results": [{"etiquette_dpe": "E", "deperditions_enveloppe": 400.0,
                                "type_generateur_chauffage_principal": "Chaudière gaz",
                                "annee_construction": 1965}]}
        with patch.object(ctx, "_get_json", return_value=reponse):
            r = ctx.features_dpe("2375E0000000A", surface=50.0)
        assert r["dpe_classe"] == "E"
        assert r["dpe_deperdition_enveloppe_m2"] == pytest.approx(8.0)
        assert r["annee_construction"] == 1965

    def test_dpe_introuvable(self):
        with patch.object(ctx, "_get_json", return_value={"results": []}):
            assert ctx.features_dpe("2375E0000000A", 50.0)["dpe_classe"] is None

    def test_sans_numero_pas_d_appel(self):
        with patch.object(ctx, "_get_json") as appel:
            ctx.features_dpe(None, 50.0)
        appel.assert_not_called()


class TestParcelle:
    def test_parcelle_dvf_au_meme_numero_avant_l_api(self, gold):
        with patch.object(ctx, "_get_json") as api:
            assert ctx.parcelle_de(48.8602, 2.37, code_commune="75111", numero="12", gold_path=gold) == "P2"
        api.assert_not_called()

    def test_numero_absent_de_dvf_repli_sur_l_api(self, gold):
        reponse = {"features": [{"properties": {"idu": "75111000ZZ0001"}}]}
        with patch.object(ctx, "_get_json", return_value=reponse):
            assert ctx.parcelle_de(48.86, 2.37, code_commune="75111", numero="99", gold_path=gold) == "75111000ZZ0001"

    def test_iris_de_la_parcelle_prioritaire(self, gold):
        # Le point est plus proche des ventes de P1, mais la parcelle est P2
        r = ctx.features_iris(48.86, 2.37, "75111", gold_path=gold, id_parcelle="P2")
        assert r["revenu_median_iris"] == 50_000.0

    def test_idu_retourne(self):
        reponse = {"features": [{"properties": {"idu": "75104000AE0003"}}]}
        with patch.object(ctx, "_get_json", return_value=reponse):
            assert ctx.parcelle_de(48.8566, 2.3522) == "75104000AE0003"

    def test_reseau_indisponible(self):
        with patch.object(ctx, "_get_json", return_value=None):
            assert ctx.parcelle_de(48.8566, 2.3522) is None
