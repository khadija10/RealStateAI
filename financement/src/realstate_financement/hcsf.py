"""
Conformité à la réglementation HCSF.

Le Haut Conseil de stabilité financière impose deux limites aux banques
françaises depuis le 1er janvier 2022, confirmées sans assouplissement en
mars 2026 :

  - taux d'effort plafonné à 35 % des revenus nets, ASSURANCE COMPRISE ;
  - durée de crédit limitée à 25 ans, portée à 27 ans en VEFA ou lorsque les
    travaux représentent au moins 10 % de l'opération.

Les banques disposent d'une marge de dérogation de 20 % de leur production
trimestrielle. Un dossier hors normes n'est donc pas automatiquement refusé :
il doit passer par cette marge, qui est rare et réservée aux profils solides.
C'est une nuance importante à restituer à l'utilisateur — répondre « refusé »
serait faux.

Le reste à vivre, lui, ne relève d'AUCUN texte : c'est un usage bancaire.
Les montants utilisés ici sont des hypothèses documentées dans le barème.
"""

from __future__ import annotations

from realstate_financement.config import parametre
from realstate_financement.modeles import ProfilEmprunteur, Projet


def taux_endettement(mensualite_totale: float, profil: ProfilEmprunteur) -> float:
    """
    Taux d'effort au sens HCSF.

    Numérateur : mensualité du prêt projeté, assurance comprise, PLUS les
    autres charges de crédit en cours. Dénominateur : revenus nets.
    """
    revenus = profil.revenus_totaux
    if revenus <= 0:
        return 1.0
    return (mensualite_totale + profil.charges_credits_mensuelles) / revenus


def mensualite_maximale(profil: ProfilEmprunteur) -> float:
    """
    Mensualité maximale admissible pour le prêt projeté.

    On applique le plafond de 35 % aux revenus, puis on retranche les crédits
    déjà en cours : ils consomment une partie de la capacité disponible.
    """
    plafond = float(parametre("hcsf", "taux_endettement_max", defaut=0.35))
    return max(0.0, profil.revenus_totaux * plafond - profil.charges_credits_mensuelles)


def duree_maximale(projet: Projet) -> tuple[int, str]:
    """
    Durée maximale autorisée, et la raison de cette durée.

    La dérogation à 27 ans s'applique en VEFA, ou dans l'ancien lorsque les
    travaux atteignent 10 % du coût de l'opération.
    """
    standard = int(parametre("hcsf", "duree_max_annees", defaut=25))
    derogatoire = int(parametre("hcsf", "duree_max_annees_derogatoire", defaut=27))
    seuil = float(parametre("hcsf", "seuil_travaux_derogation", defaut=0.10))

    if projet.type_bien == "neuf":
        return derogatoire, "VEFA : différé autorisé, durée portée à 27 ans"
    if projet.part_travaux >= seuil:
        return derogatoire, (
            f"travaux à {projet.part_travaux:.0%} de l'opération, "
            f"au-delà du seuil de {seuil:.0%} : durée portée à 27 ans"
        )
    return standard, "durée standard de 25 ans"


def reste_a_vivre(profil: ProfilEmprunteur, mensualite_totale: float) -> dict[str, float]:
    """
    Reste à vivre mensuel et comparaison au minimum d'usage.

    Deux dossiers au même taux d'endettement ne se valent pas : 35 % sur
    2 000 € de revenus ne laisse pas de quoi vivre, 35 % sur 8 000 € oui.
    C'est ce que le taux d'endettement seul ne capture pas.
    """
    conf = parametre("reste_a_vivre_minimum", defaut={}) or {}
    minimum = (
        float(conf.get("premiere_personne", 900))
        + float(conf.get("personne_supplementaire", 400)) * max(0, profil.nb_adultes - 1)
        + float(conf.get("par_enfant", 300)) * profil.nb_enfants
    )
    disponible = (profil.revenus_totaux - mensualite_totale
                  - profil.charges_credits_mensuelles)
    return {
        "reste_a_vivre": round(disponible, 2),
        "minimum_requis": round(minimum, 2),
        "marge": round(disponible - minimum, 2),
        "conforme": disponible >= minimum,
    }


def saut_de_charge(profil: ProfilEmprunteur, mensualite_totale: float) -> dict[str, float]:
    """
    Écart entre la future mensualité et le loyer actuel.

    Une banque regarde ce saut de près : un emprunteur qui paie déjà 1 200 €
    de loyer et passera à 1 300 € de mensualité a démontré sa capacité à
    supporter la charge. Un saut de 400 € inquiète.
    """
    if profil.loyer_actuel <= 0:
        return {"saut_mensuel": 0.0, "ratio": 0.0, "evaluable": False}
    saut = mensualite_totale - profil.loyer_actuel
    return {
        "saut_mensuel": round(saut, 2),
        "ratio": round(mensualite_totale / profil.loyer_actuel, 3),
        "evaluable": True,
    }


def evaluer_conformite(profil: ProfilEmprunteur, projet: Projet,
                       mensualite: float, duree_annees: int) -> dict:
    """
    Verdict de conformité HCSF, avec le détail de chaque critère.

    Un dossier non conforme n'est pas refusé d'office : il relève de la marge
    de dérogation de 20 %. Le vocabulaire employé ici le reflète.
    """
    endettement = taux_endettement(mensualite, profil)
    plafond = float(parametre("hcsf", "taux_endettement_max", defaut=0.35))
    duree_max, motif_duree = duree_maximale(projet)
    rav = reste_a_vivre(profil, mensualite)

    criteres = {
        "taux_endettement": {
            "valeur": round(endettement, 4),
            "plafond": plafond,
            "conforme": endettement <= plafond,
        },
        "duree": {
            "valeur": duree_annees,
            "plafond": duree_max,
            "conforme": duree_annees <= duree_max,
            "motif": motif_duree,
        },
        "reste_a_vivre": rav,
    }
    conforme = all(c["conforme"] for c in criteres.values())

    alertes: list[str] = []
    if not criteres["taux_endettement"]["conforme"]:
        alertes.append(
            f"Taux d'endettement de {endettement:.1%}, au-delà du plafond de "
            f"{plafond:.0%}. Le dossier ne peut passer que par la marge de "
            "dérogation de 20 % dont dispose chaque banque."
        )
    if not criteres["duree"]["conforme"]:
        alertes.append(
            f"Durée de {duree_annees} ans supérieure au maximum de {duree_max} ans "
            f"({motif_duree})."
        )
    if not rav["conforme"]:
        alertes.append(
            f"Reste à vivre de {rav['reste_a_vivre']:.0f} € pour un minimum d'usage "
            f"estimé à {rav['minimum_requis']:.0f} €."
        )

    return {
        "conforme_hcsf": conforme,
        "criteres": criteres,
        "alertes": alertes,
        "marge_derogation_possible": (not conforme) and endettement <= plafond + 0.05,
    }
