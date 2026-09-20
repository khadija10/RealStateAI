"""
Tests du dossier de prêt — le livrable de la fonctionnalité.

Le dossier est destiné à être transmis à un établissement bancaire : il doit
être complet, sérialisable, et strictement reproductible pour un même profil.
"""

from __future__ import annotations

import json

import pytest

from realstate_financement.dossier import generer_dossier, resumer_dossier
from realstate_financement.modeles import ProfilEmprunteur, Projet
from realstate_financement.outils import executer_outil

SECTIONS_ATTENDUES = {
    "meta", "emprunteur", "projet", "plan_financement", "credit",
    "conformite_hcsf", "reste_a_vivre", "score_dossier",
    "budget_previsionnel", "pieces_justificatives", "synthese",
}


@pytest.fixture
def dossier():
    profil = ProfilEmprunteur(
        revenus_nets_mensuels=4200, apport=45_000,
        charges_credits_mensuelles=250, situation_professionnelle="CDI",
        nb_adultes=2, nb_enfants=1, loyer_actuel=1100, primo_accedant=True,
    )
    projet = Projet(prix_bien=250_000, departement="94", duree_souhaitee_annees=25)
    return generer_dossier(profil, projet, charges_logement_previsionnelles=250)


def test_toutes_les_sections_presentes(dossier):
    assert set(dossier) == SECTIONS_ATTENDUES


def test_serialisable_en_json(dossier):
    """Le dossier transite vers un backend : il doit passer en JSON tel quel."""
    recharge = json.loads(json.dumps(dossier, ensure_ascii=False))
    assert recharge["plan_financement"]["montant_emprunte"] > 0


def test_avertissement_legal_present(dossier):
    """Un document de simulation ne doit jamais passer pour un accord de prêt."""
    avertissement = dossier["meta"]["avertissement"].lower()
    assert "ne constitue" in avertissement
    assert "offre de prêt" in avertissement


def test_base_reglementaire_tracee(dossier):
    """Les seuils appliqués voyagent avec le dossier, pour être vérifiables."""
    base = dossier["meta"]["base_reglementaire"]
    assert base["taux_endettement_max"] == 0.35
    assert base["duree_max_annees"] == 25
    assert base["millesime_baremes"]


def test_plan_de_financement_equilibre(dossier):
    """Ressources et besoins doivent se compenser exactement."""
    pf = dossier["plan_financement"]
    besoins = pf["prix_bien"] + pf["frais_acquisition"] + pf["frais_credit"]
    ressources = pf["apport"] + pf["montant_emprunte"]
    assert besoins == pytest.approx(ressources, abs=1)


def test_leviers_sont_chiffres(dossier):
    """
    Un conseil sans chiffre n'aide personne à décider. Chaque levier doit
    indiquer son gain réel, recalculé par le moteur.
    """
    leviers = dossier["synthese"]["leviers"]
    assert leviers
    for levier in leviers:
        assert levier["gain_capacite_emprunt"] > 0
        assert levier["description"]
        assert levier["contrepartie"]


def test_levier_solder_credit_propose_si_credit_en_cours(dossier):
    noms = {l["levier"] for l in dossier["synthese"]["leviers"]}
    assert "solder_les_credits_en_cours" in noms


def test_pas_de_levier_credit_sans_credit():
    profil = ProfilEmprunteur(revenus_nets_mensuels=4200, apport=45_000,
                              charges_credits_mensuelles=0)
    d = generer_dossier(profil, Projet(prix_bien=250_000, departement="94"))
    noms = {l["levier"] for l in d["synthese"]["leviers"]}
    assert "solder_les_credits_en_cours" not in noms


def test_decision_indicative_coherente_avec_la_conformite(dossier):
    conforme = dossier["conformite_hcsf"]["conforme_hcsf"]
    decision = dossier["synthese"]["decision_indicative"]
    assert ("hors normes" in decision) != conforme


def test_pieces_justificatives_incluses(dossier):
    pieces = dossier["pieces_justificatives"]
    assert pieces["nombre_de_pieces"] > 5
    assert any("salaire" in p.lower() for p in pieces["pieces"])


def test_resume_texte_lisible(dossier):
    resume = resumer_dossier(dossier)
    assert "Mensualité" in resume
    assert "Score du dossier" in resume


def test_reproductible_a_l_identique():
    """Deux générations du même profil doivent donner le même dossier."""
    profil = ProfilEmprunteur(revenus_nets_mensuels=3500, apport=30_000,
                              charges_credits_mensuelles=0)
    projet = Projet(prix_bien=220_000, departement="93")
    a = generer_dossier(profil, projet)
    b = generer_dossier(profil, projet)
    a["meta"]["genere_le"] = b["meta"]["genere_le"] = ""
    assert a == b


def test_dossier_appelable_comme_outil():
    resultat = executer_outil(
        "generer_dossier_pret",
        '{"revenus_nets_mensuels": 4200, "apport": 45000, '
        '"charges_credits_mensuelles": 250, "situation_professionnelle": "CDI", '
        '"prix_bien": 250000, "departement": "94"}',
    )
    assert set(resultat) == SECTIONS_ATTENDUES


def test_departement_invalide_refuse_avant_generation():
    resultat = executer_outil(
        "generer_dossier_pret",
        '{"revenus_nets_mensuels": 4200, "apport": 45000, '
        '"charges_credits_mensuelles": 0, "situation_professionnelle": "CDI", '
        '"prix_bien": 250000, "departement": "inconnu"}',
    )
    assert "erreur" in resultat
