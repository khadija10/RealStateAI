"""
Génération du dossier de prêt.

C'est le LIVRABLE de la fonctionnalité : un document structuré, sérialisable
en JSON, rassemblant tout ce qu'une banque attend pour instruire une demande
de financement.

Entièrement déterministe. Aucun appel à un modèle de langage : le dossier est
reproductible à l'identique pour un même profil, ce qui est indispensable
pour un document à vocation contractuelle.

L'agent conversationnel se contente de collecter les informations, puis
d'appeler cette fonction. Il peut ensuite commenter le résultat, jamais le
modifier.

Structure produite :
    meta                 horodatage, version, avertissement légal
    emprunteur           situation du foyer
    projet               caractéristiques de l'opération
    plan_financement     ventilation des besoins et ressources
    credit               mensualité, durée, coût total
    conformite_hcsf      taux d'effort, durée, reste à vivre
    score_dossier        note sur 100 et composantes
    budget_previsionnel  reste à vivre par poste (optionnel)
    pieces_justificatives
    synthese             points forts, vigilance, leviers chiffrés
"""

from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Any

from realstate_financement.budget import construire_plan_budget
from realstate_financement.config import parametre
from realstate_financement.modeles import ProfilEmprunteur, Projet
from realstate_financement.moteur import analyser_projet, calculer_capacite

VERSION_DOSSIER = "1.0"

AVERTISSEMENT = (
    "Ce dossier est une simulation établie à partir des informations "
    "déclarées par l'emprunteur et de la réglementation en vigueur. Il ne "
    "constitue ni un conseil en financement, ni une offre de prêt, ni un "
    "accord de principe. Seul un établissement de crédit peut se prononcer "
    "sur une demande de financement."
)


def _leviers_chiffres(profil: ProfilEmprunteur, projet: Projet,
                      analyse: dict) -> list[dict[str, Any]]:
    """
    Calcule l'effet réel de chaque levier d'amélioration.

    On ne se contente pas de suggérer « allongez la durée » : on relance le
    calcul et on chiffre le gain. Un conseil sans chiffre n'aide personne à
    décider, et c'est précisément ce qu'un moteur déterministe sait faire
    mieux qu'un modèle de langage.
    """
    leviers: list[dict[str, Any]] = []
    duree_actuelle = projet.duree_souhaitee_annees
    reference = calculer_capacite(profil, duree_actuelle)
    capital_actuel = reference["capital_empruntable"]

    # Levier 1 : allonger la durée, dans la limite autorisée.
    duree_max = analyse["credit"]["duree_maximale_autorisee"]
    if duree_actuelle < duree_max:
        allonge = calculer_capacite(profil, duree_max)
        leviers.append({
            "levier": "allonger_la_duree",
            "description": f"Passer de {duree_actuelle} à {duree_max} ans",
            "gain_capacite_emprunt": round(
                allonge["capital_empruntable"] - capital_actuel, 2),
            "surcout_total_credit": round(
                allonge["detail_credit"]["cout_total_credit"]
                - reference["detail_credit"]["cout_total_credit"], 2),
            "contrepartie": "Le coût total du crédit augmente.",
        })

    # Levier 2 : solder les crédits en cours.
    if profil.charges_credits_mensuelles > 0:
        from dataclasses import replace

        sans_credits = replace(profil, charges_credits_mensuelles=0)
        libere = calculer_capacite(sans_credits, duree_actuelle)
        leviers.append({
            "levier": "solder_les_credits_en_cours",
            "description": (
                f"Solder {profil.charges_credits_mensuelles:.0f} € de "
                "mensualités de crédits"),
            "gain_capacite_emprunt": round(
                libere["capital_empruntable"] - capital_actuel, 2),
            "contrepartie": "Mobilise une partie de l'épargne disponible.",
        })

    # Levier 3 : renforcer l'apport, euro pour euro sur le budget.
    frais = analyse["detail_frais_acquisition"]["total_frais_acquisition"]
    if profil.apport < frais:
        leviers.append({
            "levier": "augmenter_l_apport",
            "description": (
                f"Porter l'apport à {frais:,.0f} € pour couvrir les frais "
                "d'acquisition").replace(",", " "),
            "gain_capacite_emprunt": round(frais - profil.apport, 2),
            "contrepartie": (
                "Les banques financent rarement au-delà de 100 % du prix."),
        })

    return leviers


def _points_forts(profil: ProfilEmprunteur, analyse: dict) -> list[str]:
    """Éléments objectivement favorables du dossier."""
    points: list[str] = []
    score = analyse["score_dossier"]["notes_brutes"]

    if profil.situation_professionnelle in ("CDI", "fonctionnaire"):
        points.append(
            f"Situation professionnelle stable ({profil.situation_professionnelle}).")
    if score.get("taux_endettement", 0) >= 0.5:
        points.append(
            f"Taux d'endettement de {analyse['taux_endettement']:.1%}, "
            "confortablement sous le plafond réglementaire.")
    if score.get("apport", 0) >= 0.75:
        points.append("Apport personnel supérieur au niveau généralement attendu.")
    if analyse["reste_a_vivre"]["conforme"]:
        points.append(
            f"Reste à vivre de {analyse['reste_a_vivre']['reste_a_vivre']:,.0f} €, "
            "au-dessus du minimum d'usage.".replace(",", " "))
    if score.get("saut_de_charge", 0) >= 0.8:
        points.append(
            "La future mensualité est proche du loyer actuel : la capacité à "
            "supporter cette charge est déjà démontrée.")
    return points


def generer_dossier(
    profil: ProfilEmprunteur,
    projet: Projet,
    charges_logement_previsionnelles: float = 0.0,
    nb_enfants_moins_14: int | None = None,
    reference_dossier: str | None = None,
) -> dict[str, Any]:
    """Produit le dossier de prêt complet, sérialisable en JSON."""
    analyse = analyser_projet(profil, projet)
    acquisition = analyse["detail_frais_acquisition"]
    credit = analyse["credit"]

    if nb_enfants_moins_14 is None:
        nb_enfants_moins_14 = profil.nb_enfants
    nb_enfants_14_et_plus = max(0, profil.nb_enfants - nb_enfants_moins_14)

    budget = construire_plan_budget(
        revenus_mensuels=profil.revenus_totaux,
        mensualite_credit=credit["mensualite_totale"],
        charges_credits_mensuelles=profil.charges_credits_mensuelles,
        charges_logement_previsionnelles=charges_logement_previsionnelles,
        nb_adultes=profil.nb_adultes,
        nb_enfants_moins_14=nb_enfants_moins_14,
        nb_enfants_14_et_plus=nb_enfants_14_et_plus,
    )

    from realstate_financement.outils import outil_pieces_justificatives

    pieces = outil_pieces_justificatives(
        situation_professionnelle=profil.situation_professionnelle,
        type_bien=projet.type_bien,
        primo_accedant=profil.primo_accedant,
        charges_credits_mensuelles=profil.charges_credits_mensuelles,
        autres_revenus_mensuels=profil.autres_revenus_mensuels,
    )

    return {
        "meta": {
            "version_dossier": VERSION_DOSSIER,
            "reference": reference_dossier or f"RSAI-{date.today():%Y%m%d}",
            "genere_le": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "avertissement": AVERTISSEMENT,
            "base_reglementaire": {
                "taux_endettement_max": parametre("hcsf", "taux_endettement_max"),
                "duree_max_annees": parametre("hcsf", "duree_max_annees"),
                "millesime_baremes": parametre("millesime"),
            },
        },
        "emprunteur": {
            "revenus_nets_mensuels": profil.revenus_nets_mensuels,
            "autres_revenus_mensuels": profil.autres_revenus_mensuels,
            "revenus_retenus_par_la_banque": round(profil.revenus_totaux, 2),
            "charges_credits_mensuelles": profil.charges_credits_mensuelles,
            "apport_personnel": profil.apport,
            "situation_professionnelle": profil.situation_professionnelle,
            "composition_foyer": {
                "adultes": profil.nb_adultes,
                "enfants": profil.nb_enfants,
                "unites_consommation": budget["unites_consommation"],
            },
            "loyer_actuel": profil.loyer_actuel,
            "primo_accedant": profil.primo_accedant,
        },
        "projet": {
            "prix_bien": projet.prix_bien,
            "montant_travaux": projet.montant_travaux,
            "cout_operation": projet.cout_operation,
            "departement": projet.departement,
            "type_bien": projet.type_bien,
            "type_garantie": projet.type_garantie,
        },
        "plan_financement": {
            **analyse["plan_financement"],
            "detail_frais_acquisition": acquisition,
            "detail_frais_credit": analyse["detail_frais_credit"],
        },
        "credit": credit,
        "conformite_hcsf": analyse["conformite_hcsf"],
        "reste_a_vivre": analyse["reste_a_vivre"],
        "score_dossier": analyse["score_dossier"],
        "budget_previsionnel": budget,
        "pieces_justificatives": pieces,
        "synthese": {
            "decision_indicative": (
                "conforme aux normes HCSF"
                if analyse["conformite_hcsf"]["conforme_hcsf"]
                else "hors normes HCSF — dérogation nécessaire"),
            "points_forts": _points_forts(profil, analyse),
            "points_de_vigilance": (analyse["points_de_vigilance"]
                                    + analyse["conformite_hcsf"]["alertes"]
                                    + budget["alertes"]),
            "leviers": _leviers_chiffres(profil, projet, analyse),
        },
    }


def resumer_dossier(dossier: dict[str, Any]) -> str:
    """
    Version texte courte du dossier, pour un affichage rapide ou un e-mail.

    Le JSON reste la source de vérité ; ce résumé n'en est qu'une projection.
    """
    pf = dossier["plan_financement"]
    cr = dossier["credit"]
    sy = dossier["synthese"]

    def euro(montant: float) -> str:
        return f"{montant:,.0f} €".replace(",", " ")

    lignes = [
        f"Dossier {dossier['meta']['reference']} — {sy['decision_indicative']}",
        "",
        f"Bien : {euro(pf['prix_bien'])} en {dossier['projet']['type_bien']}, "
        f"département {dossier['projet']['departement']}",
        f"Frais d'acquisition : {euro(pf['frais_acquisition'])}",
        f"Apport : {euro(pf['apport'])}",
        f"Montant emprunté : {euro(pf['montant_emprunte'])} "
        f"sur {cr['duree_annees']} ans",
        f"Mensualité : {euro(cr['mensualite_totale'])} assurance comprise",
        f"Taux d'endettement : {dossier['conformite_hcsf']['criteres']['taux_endettement']['valeur']:.1%}",
        f"Score du dossier : {dossier['score_dossier']['score_sur_100']}/100 "
        f"({dossier['score_dossier']['appreciation']})",
    ]
    if sy["points_de_vigilance"]:
        lignes += ["", "Points de vigilance :"]
        lignes += [f"  - {p}" for p in sy["points_de_vigilance"]]
    return "\n".join(lignes)
