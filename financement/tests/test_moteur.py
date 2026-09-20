"""
Tests du moteur de financement.

Chaque test vérifie une règle réglementaire ou une formule financière contre
une valeur calculable à la main. C'est ce qui rend le moteur défendable :
n'importe quel membre du jury peut refaire le calcul.
"""

from __future__ import annotations

import pytest

from realstate_financement.frais import emoluments_notaire, taux_droits_mutation
from realstate_financement.hcsf import (
    duree_maximale,
    mensualite_maximale,
    taux_endettement,
)
from realstate_financement.modeles import ProfilEmprunteur, Projet
from realstate_financement.moteur import analyser_projet, budget_maximum, calculer_capacite
from realstate_financement.pret import capital_empruntable, mensualite_credit


# --- Formules de prêt -------------------------------------------------------

def test_mensualite_cas_connu():
    """200 000 € à 3 % sur 20 ans : environ 1 109 € hors assurance."""
    m = mensualite_credit(200_000, 0.03, 20)
    assert 1105 <= m <= 1115


def test_mensualite_taux_nul():
    """Sans intérêts, la mensualité est le simple quotient capital / durée."""
    assert mensualite_credit(120_000, 0.0, 10) == pytest.approx(1000.0)


def test_capacite_est_l_inverse_de_la_mensualite():
    """
    Test de cohérence interne : le capital calculé pour une mensualité donnée
    doit, réinjecté dans la formule, redonner cette mensualité.
    """
    from realstate_financement.pret import mensualite_totale

    capital = capital_empruntable(1500, 0.033, 25, taux_assurance=0.0034)
    assert mensualite_totale(capital, 0.033, 25, 0.0034) == pytest.approx(1500, abs=0.5)


# --- Norme HCSF -------------------------------------------------------------

def test_mensualite_maximale_35_pourcent():
    """4 000 € de revenus, 200 € de crédits : 4000 x 0,35 - 200 = 1 200 €."""
    profil = ProfilEmprunteur(revenus_nets_mensuels=4000, charges_credits_mensuelles=200)
    assert mensualite_maximale(profil) == pytest.approx(1200.0)


def test_revenus_locatifs_ponderes_a_70_pourcent():
    """Usage bancaire constant : les loyers perçus ne comptent qu'à 70 %."""
    profil = ProfilEmprunteur(revenus_nets_mensuels=3000, autres_revenus_mensuels=1000)
    assert profil.revenus_totaux == pytest.approx(3700.0)


def test_taux_endettement_inclut_les_credits_en_cours():
    profil = ProfilEmprunteur(revenus_nets_mensuels=4000, charges_credits_mensuelles=300)
    assert taux_endettement(1100, profil) == pytest.approx(0.35)


def test_duree_derogatoire_si_travaux_importants():
    """Travaux >= 10 % de l'opération : durée portée à 27 ans."""
    duree, _ = duree_maximale(Projet(prix_bien=200_000, montant_travaux=30_000))
    assert duree == 27


def test_duree_standard_si_travaux_faibles():
    duree, _ = duree_maximale(Projet(prix_bien=200_000, montant_travaux=5_000))
    assert duree == 25


def test_duree_derogatoire_en_vefa():
    duree, _ = duree_maximale(Projet(prix_bien=200_000, type_bien="neuf"))
    assert duree == 27


# --- Frais d'acquisition ----------------------------------------------------

def test_dmto_taux_plein_2026():
    """5,00 % départemental + 1,20 % communal + frais d'assiette = 6,32 %."""
    assert taux_droits_mutation("93", neuf=False) == pytest.approx(0.0632, abs=0.0002)


def test_dmto_reduit_pour_primo_accedant():
    """Les primo-accédants échappent à la hausse : 5,81 %."""
    taux = taux_droits_mutation("93", neuf=False, primo_accedant=True)
    assert taux == pytest.approx(0.0581, abs=0.0002)


def test_dmto_neuf_tres_inferieur():
    """En VEFA, la taxe de publicité foncière remplace les DMTO."""
    assert taux_droits_mutation("93", neuf=True) == pytest.approx(0.00715)


def test_emoluments_bareme_degressif():
    """
    Le barème s'applique par tranches, pas en taux unique : les émoluments
    doivent donc croître moins vite que le prix.
    """
    e_100k = emoluments_notaire(100_000)
    e_200k = emoluments_notaire(200_000)
    assert e_200k < 2 * e_100k


def test_frais_acquisition_ancien_dans_la_fourchette_de_marche():
    """Dans l'ancien, le total attendu se situe entre 7 % et 8,5 % du prix."""
    from realstate_financement.frais import frais_acquisition

    frais = frais_acquisition(Projet(prix_bien=300_000, departement="93"))
    assert 0.07 <= frais["part_du_prix"] <= 0.085


def test_le_notaire_percoit_une_faible_part_du_total():
    """Contre-intuitif mais vrai : les émoluments sont minoritaires."""
    from realstate_financement.frais import frais_acquisition

    frais = frais_acquisition(Projet(prix_bien=300_000, departement="93"))
    assert frais["part_revenant_au_notaire"] < 0.20


# --- Orchestration ----------------------------------------------------------

def test_budget_maximum_reste_finançable():
    """
    Le prix maximal proposé doit effectivement tenir dans l'enveloppe :
    prix + frais <= capacité + apport.
    """
    profil = ProfilEmprunteur(revenus_nets_mensuels=4200, apport=35_000)
    resultat = budget_maximum(profil, "93", 25)
    total = (resultat["prix_bien_maximum"]
             + resultat["frais_acquisition"]["total_frais_acquisition"]
             + resultat["frais_credit"]["total_frais_credit"])
    assert total <= resultat["capacite"]["enveloppe_totale"] + 100


def test_projet_trop_cher_declare_non_conforme():
    profil = ProfilEmprunteur(revenus_nets_mensuels=2500, apport=10_000)
    analyse = analyser_projet(profil, Projet(prix_bien=400_000, departement="75"))
    assert not analyse["conformite_hcsf"]["conforme_hcsf"]
    assert analyse["conformite_hcsf"]["alertes"]


def test_dossier_non_conforme_n_est_jamais_presente_comme_solide():
    """Garde-fou : pas de faux signal rassurant sur un dossier hors normes."""
    profil = ProfilEmprunteur(revenus_nets_mensuels=2500, apport=10_000)
    analyse = analyser_projet(profil, Projet(prix_bien=400_000, departement="75"))
    assert analyse["score_dossier"]["appreciation"] not in (
        "excellent", "solide", "acceptable"
    )


def test_capacite_nulle_sans_revenus():
    profil = ProfilEmprunteur(revenus_nets_mensuels=0)
    assert calculer_capacite(profil)["capital_empruntable"] == 0.0
