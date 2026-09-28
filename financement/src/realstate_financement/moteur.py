"""
Orchestration du moteur de financement.

Trois points d'entrée, qui deviendront les outils exposés à l'agent :

  - `calculer_capacite` : « combien puis-je emprunter ? »
  - `budget_maximum`    : « quel prix de bien puis-je viser ? »
  - `analyser_projet`   : « ce bien précis, est-ce jouable ? »

Aucun de ces calculs ne fait appel à un modèle de langage. L'agent les
appellera, lira leurs résultats et les expliquera — il ne les refera jamais.
"""

from __future__ import annotations

from realstate_financement.config import parametre
from realstate_financement.frais import frais_acquisition, frais_credit
from realstate_financement.hcsf import (
    duree_maximale,
    evaluer_conformite,
    mensualite_maximale,
    reste_a_vivre,
    taux_endettement,
)
from realstate_financement.modeles import ProfilEmprunteur, Projet
from realstate_financement.pret import (
    capital_empruntable,
    cout_total_credit,
    mensualite_totale,
    taux_indicatif,
)


def calculer_capacite(profil: ProfilEmprunteur, duree_annees: int = 25,
                      taux_annuel: float | None = None) -> dict:
    """Capacité d'emprunt maximale au sens de la norme HCSF."""
    taux = taux_annuel if taux_annuel is not None else taux_indicatif(duree_annees)
    mensualite_max = mensualite_maximale(profil)
    capital = capital_empruntable(mensualite_max, taux, duree_annees)

    return {
        "duree_annees": duree_annees,
        "taux_nominal_retenu": round(taux, 4),
        "mensualite_maximale": round(mensualite_max, 2),
        "capital_empruntable": round(capital, 2),
        "apport_disponible": round(profil.apport, 2),
        "enveloppe_totale": round(capital + profil.apport, 2),
        "revenus_pris_en_compte": round(profil.revenus_totaux, 2),
        "detail_credit": cout_total_credit(capital, taux, duree_annees),
        "avertissement": (
            "Le taux retenu est une hypothèse paramétrable, pas une offre "
            "bancaire. Un taux réel se négocie au cas par cas."
        ),
    }


def budget_maximum(profil: ProfilEmprunteur, departement: str = "75",
                   duree_annees: int = 25, type_bien: str = "ancien",
                   type_garantie: str = "caution") -> dict:
    """
    Prix de bien maximal finançable, frais compris.

    Le calcul est circulaire : les frais dépendent du prix, et le prix
    dépend de ce qu'il reste après les frais. On résout par dichotomie, ce
    qui converge en une trentaine d'itérations et évite toute approximation
    du type « on retire 8 % au jugé ».
    """
    capacite = calculer_capacite(profil, duree_annees)
    enveloppe = capacite["enveloppe_totale"]
    if enveloppe <= 0:
        return {"prix_bien_maximum": 0.0, "capacite": capacite,
                "message": "Capacité d'emprunt nulle avec ces revenus et ces charges."}

    def cout_total_pour(prix: float) -> float:
        """Coût complet de l'opération pour un prix de bien donné."""
        projet = Projet(prix_bien=prix, departement=departement,
                        type_bien=type_bien, type_garantie=type_garantie)
        acquisition = frais_acquisition(projet, profil.primo_accedant)
        emprunt = max(0.0, prix + acquisition["total_frais_acquisition"] - profil.apport)
        credit = frais_credit(emprunt, type_garantie)
        return (prix + acquisition["total_frais_acquisition"]
                + credit["total_frais_credit"])

    bas, haut = 0.0, enveloppe
    for _ in range(60):
        milieu = (bas + haut) / 2
        if cout_total_pour(milieu) <= enveloppe:
            bas = milieu
        else:
            haut = milieu
    prix_max = round(bas, -2)  # arrondi à la centaine, la précision au centime
                               # n'a aucun sens sur une estimation de budget

    projet = Projet(prix_bien=prix_max, departement=departement,
                    type_bien=type_bien, type_garantie=type_garantie)
    acquisition = frais_acquisition(projet, profil.primo_accedant)
    emprunt = max(0.0, prix_max + acquisition["total_frais_acquisition"] - profil.apport)

    return {
        "prix_bien_maximum": prix_max,
        "frais_acquisition": acquisition,
        "frais_credit": frais_credit(emprunt, type_garantie),
        "montant_a_emprunter": round(emprunt, 2),
        "apport_mobilise": round(profil.apport, 2),
        "capacite": capacite,
    }


def analyser_projet(profil: ProfilEmprunteur, projet: Projet,
                    taux_annuel: float | None = None) -> dict:
    """
    Analyse complète d'un projet identifié : plan de financement, conformité
    réglementaire, score du dossier et points de vigilance.
    """
    from realstate_financement.scoring import scorer_dossier

    duree = projet.duree_souhaitee_annees
    duree_max, motif_duree = duree_maximale(projet)
    taux = taux_annuel if taux_annuel is not None else taux_indicatif(duree)

    acquisition = frais_acquisition(projet, profil.primo_accedant)
    besoin_avant_credit = (projet.cout_operation
                           + acquisition["total_frais_acquisition"])
    emprunt = max(0.0, besoin_avant_credit - profil.apport)
    credit = frais_credit(emprunt, projet.type_garantie)

    # Les frais de dossier et de garantie sont le plus souvent intégrés au
    # financement plutôt que payés comptant.
    emprunt_total = emprunt + credit["total_frais_credit"]
    mensualite = mensualite_totale(emprunt_total, taux, duree)

    conformite = evaluer_conformite(profil, projet, mensualite, duree)
    score = scorer_dossier(profil, mensualite, besoin_avant_credit)

    # Un dossier non conforme à la norme HCSF ne peut pas être présenté comme
    # "solide" ou "acceptable" : la banque n'a légalement pas le droit de le
    # financer hors de sa marge de dérogation. On requalifie l'appréciation
    # pour ne pas donner un faux signal rassurant à l'utilisateur.
    if not conformite["conforme_hcsf"]:
        score["appreciation_initiale"] = score["appreciation"]
        score["appreciation"] = (
            "hors normes — dérogation nécessaire"
            if conformite["marge_derogation_possible"]
            else "non finançable en l'état"
        )
    rav = reste_a_vivre(profil, mensualite)

    apport_recommande = float(parametre("hypotheses_marche", "apport_recommande",
                                        defaut=0.10))
    vigilance: list[str] = []
    if profil.apport < acquisition["total_frais_acquisition"]:
        manque = acquisition["total_frais_acquisition"] - profil.apport
        vigilance.append(
            f"L'apport ne couvre pas les frais d'acquisition : il manque "
            f"{manque:,.0f} €. Un financement à 110 % reste possible mais les "
            f"banques y sont réticentes.".replace(",", " ")
        )
    elif profil.apport < besoin_avant_credit * apport_recommande:
        vigilance.append(
            f"Apport inférieur à {apport_recommande:.0%} du coût de l'opération, "
            "seuil généralement attendu."
        )
    if duree > duree_max:
        vigilance.append(f"Durée demandée supérieure au maximum autorisé ({motif_duree}).")

    return {
        "plan_financement": {
            "prix_bien": projet.prix_bien,
            "montant_travaux": projet.montant_travaux,
            "frais_acquisition": acquisition["total_frais_acquisition"],
            "frais_credit": credit["total_frais_credit"],
            "cout_total_operation": round(besoin_avant_credit
                                          + credit["total_frais_credit"], 2),
            "apport": profil.apport,
            "montant_emprunte": round(emprunt_total, 2),
        },
        "credit": {
            "duree_annees": duree,
            "duree_maximale_autorisee": duree_max,
            "taux_nominal_retenu": round(taux, 4),
            **cout_total_credit(emprunt_total, taux, duree),
        },
        "taux_endettement": round(taux_endettement(mensualite, profil), 4),
        "reste_a_vivre": rav,
        "conformite_hcsf": conformite,
        "score_dossier": score,
        "points_de_vigilance": vigilance,
        "detail_frais_acquisition": acquisition,
        "detail_frais_credit": credit,
    }
