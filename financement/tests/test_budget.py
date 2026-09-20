"""
Tests de l'accompagnement budgétaire et du protocole de collecte.
"""

from __future__ import annotations

import pytest

from realstate_financement.budget import construire_plan_budget, unites_consommation
from realstate_financement.outils import INFORMATIONS_REQUISES, executer_outil


# --- Unités de consommation, échelle OCDE modifiée -------------------------

def test_uc_personne_seule():
    assert unites_consommation(1, 0, 0) == 1.0


def test_uc_couple_avec_jeune_enfant():
    """1 + 0,5 + 0,3 = 1,8 selon l'échelle OCDE modifiée utilisée par l'INSEE."""
    assert unites_consommation(2, 1, 0) == 1.8


def test_uc_adolescent_compte_plus_qu_un_jeune_enfant():
    assert unites_consommation(2, 0, 1) > unites_consommation(2, 1, 0)


# --- Plan de budget --------------------------------------------------------

def test_disponible_deduit_tous_les_engagements():
    plan = construire_plan_budget(3200, 1120, charges_credits_mensuelles=250,
                                  charges_logement_previsionnelles=300)
    assert plan["disponible_apres_engagements"] == pytest.approx(1530)


def test_repartition_couvre_le_disponible():
    """La somme des postes doit correspondre au disponible, aux arrondis près."""
    plan = construire_plan_budget(4000, 1200, nb_adultes=2, nb_enfants_moins_14=2)
    total = sum(p["montant_indicatif"] for p in plan["repartition_indicative"])
    assert total == pytest.approx(plan["disponible_apres_engagements"], abs=1)


def test_structure_differe_selon_le_niveau_de_vie():
    """
    L'INSEE observe que les ménages modestes consacrent une part plus élevée
    à l'alimentation. Appliquer une structure unique serait trompeur.
    """
    def part_alimentation(revenus, adultes, enfants):
        plan = construire_plan_budget(revenus, revenus * 0.3, nb_adultes=adultes,
                                      nb_enfants_moins_14=enfants)
        poste = next(p for p in plan["repartition_indicative"]
                     if p["poste"] == "alimentation")
        return poste["part_du_disponible"]

    assert part_alimentation(2200, 2, 2) > part_alimentation(9000, 1, 0)


def test_alerte_si_charges_logement_non_renseignees():
    plan = construire_plan_budget(3200, 1120)
    assert any("charge" in a.lower() for a in plan["alertes"])


def test_alerte_si_disponible_trop_faible():
    plan = construire_plan_budget(2000, 1300, nb_adultes=2, nb_enfants_moins_14=2,
                                  charges_logement_previsionnelles=250)
    assert any("tendu" in a.lower() for a in plan["alertes"])


def test_avertissement_methodologique_present():
    """La nature statistique des repères doit toujours accompagner les montants."""
    plan = construire_plan_budget(3200, 1120)
    avertissement = plan["avertissement_methodologique"].lower()
    assert "repère" in avertissement
    assert "prescription" in avertissement


# --- Protocole de collecte -------------------------------------------------

def test_dossier_vide_liste_toutes_les_questions():
    resultat = executer_outil("verifier_dossier", "{}")
    assert not resultat["dossier_complet"]
    assert len(resultat["informations_manquantes"]) == len(INFORMATIONS_REQUISES)
    assert resultat["prochaine_question"]


def test_dossier_partiel_signale_ce_qui_reste():
    resultat = executer_outil(
        "verifier_dossier",
        '{"revenus_nets_mensuels": 3200, "apport": 10000}',
    )
    assert "revenus_nets_mensuels" in resultat["informations_fournies"]
    assert "charges_credits_mensuelles" in resultat["informations_manquantes"]
    assert not resultat["dossier_complet"]


def test_dossier_complet_autorise_les_calculs():
    args = {champ: 0 for champ in INFORMATIONS_REQUISES}
    import json

    resultat = executer_outil("verifier_dossier", json.dumps(args))
    assert resultat["dossier_complet"]
    assert resultat["prochaine_question"] is None
    assert "calculs" in resultat["consigne"]


def test_plan_budget_appelable_comme_outil():
    resultat = executer_outil(
        "construire_plan_budget",
        '{"revenus_nets_mensuels": 3200, "mensualite_credit": 1120, '
        '"charges_logement_previsionnelles": 280, "nb_adultes": 2, '
        '"nb_enfants_moins_14": 1}',
    )
    assert resultat["unites_consommation"] == 1.8
    assert resultat["disponible_apres_engagements"] > 0
