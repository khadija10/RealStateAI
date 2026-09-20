"""
Exposition du moteur de financement sous forme d'outils.

Chaque fonction du moteur devient un outil que le modèle peut appeler, décrit
par un schéma JSON. Le modèle choisit QUEL outil appeler et avec QUELS
arguments ; il ne calcule jamais le résultat lui-même.

Ce module ne dépend d'AUCUNE bibliothèque de LLM : il est testable seul, et
il fonctionnerait à l'identique avec un autre fournisseur. C'est volontaire —
la logique métier ne doit jamais dépendre du modèle qui l'appelle.

Format retenu : celui de l'API OpenAI, également supporté par xAI, Groq,
Mistral et OpenRouter.
"""

from __future__ import annotations

import json
import re
from typing import Any, Callable

from realstate_financement.budget import construire_plan_budget
from realstate_financement.config import parametre
from realstate_financement.frais import frais_acquisition
from realstate_financement.hcsf import taux_endettement
from realstate_financement.modeles import ProfilEmprunteur, Projet
from realstate_financement.moteur import analyser_projet, budget_maximum, calculer_capacite

# --- Fragments de schéma réutilisés ----------------------------------------
# Les champs du profil reviennent dans presque tous les outils : on les décrit
# une seule fois pour que le modèle reçoive toujours la même définition.
CHAMPS_PROFIL: dict[str, Any] = {
    "revenus_nets_mensuels": {
        "type": "number",
        "description": "Revenus nets mensuels du foyer, avant impôt, en euros. "
                       "Somme des salaires si le foyer compte deux emprunteurs.",
    },
    "apport": {
        "type": "number",
        "description": "Apport personnel disponible en euros. Ne mets 0 que si "
                       "la personne a CONFIRMÉ ne pas en avoir : sans apport, "
                       "les banques financent rarement. Si tu ne sais pas, "
                       "pose la question au lieu de supposer.",
    },
    "charges_credits_mensuelles": {
        "type": "number",
        "description": "Total des mensualités de crédits en cours (auto, "
                       "consommation, étudiant). Ne mets 0 que si la personne "
                       "a CONFIRMÉ n'en avoir aucun : ce montant se soustrait "
                       "directement à sa capacité d'emprunt. Si tu ne sais "
                       "pas, pose la question au lieu de supposer.",
    },
    "autres_revenus_mensuels": {
        "type": "number",
        "description": "Revenus complémentaires réguliers : loyers perçus, "
                       "pensions. Les loyers ne sont retenus qu'à 70 %.",
    },
    "situation_professionnelle": {
        "type": "string",
        "enum": ["CDI", "fonctionnaire", "CDD", "independant", "interim", "chomage"],
        "description": "Situation du principal emprunteur.",
    },
    "nb_adultes": {"type": "integer", "description": "Nombre d'adultes du foyer."},
    "nb_enfants": {"type": "integer", "description": "Nombre d'enfants à charge."},
    "loyer_actuel": {
        "type": "number",
        "description": "Loyer mensuel actuellement payé, en euros. Sert à mesurer "
                       "le saut de charge. 0 si hébergé ou déjà propriétaire.",
    },
    "primo_accedant": {
        "type": "boolean",
        "description": "Vrai si première acquisition de résidence principale. "
                       "Ouvre droit à un taux de droits de mutation réduit.",
    },
}

CHAMPS_BIEN: dict[str, Any] = {
    "departement": {
        "type": "string",
        "description": "Code département sur 2 caractères, ex. '75', '93'. "
                       "Détermine le taux de droits de mutation applicable.",
    },
    "type_bien": {
        "type": "string",
        "enum": ["ancien", "neuf"],
        "description": "'neuf' pour une VEFA ou un bien de moins de 5 ans : "
                       "les frais d'acquisition sont alors bien plus faibles.",
    },
}


# Un code département valide : 2 chiffres, 2A/2B pour la Corse, 3 chiffres
# pour l'outre-mer.
MOTIF_DEPARTEMENT = re.compile(r"^(\d{2}|2[AB]|\d{3})$")


def _valider_departement(valeur: Any) -> str | None:
    """
    Renvoie un message d'erreur si le département est invalide, sinon None.

    POURQUOI CE CONTRÔLE : observé en conditions réelles, un modèle confronté
    à un champ obligatoire qu'il ne connaît pas préfère INVENTER une valeur
    ("inconnu", "France", "IDF") plutôt que de poser la question. Le calcul
    aboutit alors sur un taux de droits de mutation arbitraire, sans que
    personne ne s'en aperçoive.
    """
    if not isinstance(valeur, str) or not MOTIF_DEPARTEMENT.match(valeur.strip()):
        return (
            f"Département invalide : {valeur!r}. Un code département français "
            "est attendu, sur 2 caractères ('75', '93', '2A') ou 3 pour "
            "l'outre-mer ('971'). N'invente pas cette valeur : demande à la "
            "personne dans quelle commune ou quel département elle cherche."
        )
    return None


# Valeurs retenues quand le modèle ne fournit pas le champ. Elles sont
# NÉCESSAIRES pour que le calcul aboutisse, mais elles doivent être annoncées :
# sans cela, le modèle invente une situation professionnelle ou suppose un
# apport nul sans le dire, et l'utilisateur prend une hypothèse pour un fait.
DEFAUTS_ANNONCABLES = {
    "apport": 0,
    "charges_credits_mensuelles": 0,
    "autres_revenus_mensuels": 0,
    "situation_professionnelle": "CDI",
    "nb_adultes": 1,
    "nb_enfants": 0,
    "loyer_actuel": 0,
    "primo_accedant": False,
}


def _explication_derogation() -> dict[str, Any]:
    """
    Description auto-portante de la marge de dérogation HCSF.

    POURQUOI CE FORMAT : renvoyer le simple nombre 0.20 conduisait le modèle
    à l'interpréter comme une tolérance de "2 points" sur le taux
    d'endettement, ce qui est faux et trompeur. Un chiffre nu se prête à
    toutes les interprétations ; on livre donc le chiffre AVEC son sens.
    """
    part = float(parametre("hcsf", "marge_flexibilite", defaut=0.20))
    return {
        "part_des_dossiers_pouvant_deroger": part,
        "unite": "part de la production trimestrielle de la banque",
        "signification": (
            f"Une banque peut faire déroger aux normes HCSF au plus "
            f"{part:.0%} des dossiers qu'elle produit sur un trimestre. "
            "C'est un quota de DOSSIERS, pas une tolérance sur le taux "
            "d'endettement : le plafond de 35 % n'est jamais relevé."
        ),
        "a_ne_pas_dire": (
            "Ne présente JAMAIS cette marge comme des points d'endettement "
            "supplémentaires. Un dossier à 37 % n'est pas 'autorisé' : il doit "
            "passer par ce quota, rare et réservé aux profils solides."
        ),
    }


def _hypotheses(args: dict[str, Any], champs: tuple[str, ...]) -> dict[str, Any]:
    """
    Liste les champs que l'outil a dû supposer, avec la valeur retenue.

    Renvoyé dans chaque résultat sous la clé "hypotheses_appliquees". Le
    modèle a pour consigne de les annoncer ou de poser la question.
    """
    return {c: DEFAUTS_ANNONCABLES[c] for c in champs if c not in args}


def _profil(args: dict[str, Any]) -> ProfilEmprunteur:
    """Construit un profil à partir des arguments fournis par le modèle."""
    return ProfilEmprunteur(
        revenus_nets_mensuels=float(args.get("revenus_nets_mensuels", 0)),
        apport=float(args.get("apport", 0)),
        charges_credits_mensuelles=float(args.get("charges_credits_mensuelles", 0)),
        autres_revenus_mensuels=float(args.get("autres_revenus_mensuels", 0)),
        situation_professionnelle=args.get("situation_professionnelle", "CDI"),
        nb_adultes=int(args.get("nb_adultes", 1)),
        nb_enfants=int(args.get("nb_enfants", 0)),
        loyer_actuel=float(args.get("loyer_actuel", 0)),
        primo_accedant=bool(args.get("primo_accedant", False)),
    )


# --- Implémentations --------------------------------------------------------

CHAMPS_CAPACITE = ("apport", "charges_credits_mensuelles", "autres_revenus_mensuels")


def outil_capacite_emprunt(**args: Any) -> dict:
    """Combien l'utilisateur peut emprunter, pour une durée donnée."""
    profil = _profil(args)
    resultat = calculer_capacite(profil, int(args.get("duree_annees", 25)))

    # Le taux d'endettement est renvoyé PAR L'OUTIL. Observé en conditions
    # réelles : laissé à lui-même, le modèle le recalcule en oubliant les
    # crédits en cours, et sous-estime le taux de plusieurs points.
    mensualite = resultat["detail_credit"]["mensualite_totale"]
    resultat["taux_endettement_resultant"] = round(
        taux_endettement(mensualite, profil), 4)
    resultat["charges_credits_prises_en_compte"] = profil.charges_credits_mensuelles
    resultat["plafond_hcsf"] = float(parametre("hcsf", "taux_endettement_max",
                                               defaut=0.35))
    resultat["derogation_hcsf"] = _explication_derogation()
    resultat["hypotheses_appliquees"] = _hypotheses(args, CHAMPS_CAPACITE)
    return resultat


def outil_budget_maximum(**args: Any) -> dict:
    """Prix de bien maximal atteignable, frais d'acquisition compris."""
    erreur = _valider_departement(args.get("departement"))
    if erreur:
        return {"erreur": erreur}
    resultat = budget_maximum(
        _profil(args),
        departement=args["departement"],
        duree_annees=int(args.get("duree_annees", 25)),
        type_bien=args.get("type_bien", "ancien"),
    )
    resultat["hypotheses_appliquees"] = _hypotheses(
        args, CHAMPS_CAPACITE + ("primo_accedant", "type_bien"))
    return resultat


def outil_analyser_projet(**args: Any) -> dict:
    """Analyse complète d'un bien identifié : plan, conformité, score."""
    erreur = _valider_departement(args.get("departement"))
    if erreur:
        return {"erreur": erreur}
    projet = Projet(
        prix_bien=float(args["prix_bien"]),
        departement=args.get("departement", "75"),
        type_bien=args.get("type_bien", "ancien"),
        montant_travaux=float(args.get("montant_travaux", 0)),
        duree_souhaitee_annees=int(args.get("duree_annees", 25)),
    )
    resultat = analyser_projet(_profil(args), projet)
    resultat["hypotheses_appliquees"] = _hypotheses(
        args, CHAMPS_CAPACITE + ("situation_professionnelle", "nb_adultes",
                                 "nb_enfants", "loyer_actuel", "primo_accedant"))
    resultat["derogation_hcsf"] = _explication_derogation()
    return resultat


def outil_frais_acquisition(**args: Any) -> dict:
    """Frais d'acquisition seuls, sans étude de financement."""
    erreur = _valider_departement(args.get("departement"))
    if erreur:
        return {"erreur": erreur}
    projet = Projet(
        prix_bien=float(args["prix_bien"]),
        departement=args.get("departement", "75"),
        type_bien=args.get("type_bien", "ancien"),
    )
    return frais_acquisition(projet, bool(args.get("primo_accedant", False)))


def outil_comparer_durees(**args: Any) -> dict:
    """
    Compare plusieurs durées d'emprunt.

    Outil déterminant pour la qualité du conseil : allonger la durée augmente
    le budget d'achat mais renchérit fortement le crédit. C'est l'arbitrage
    central, et il doit être chiffré, pas raconté.
    """
    profil = _profil(args)
    durees = args.get("durees") or [15, 20, 25]
    comparaison = []
    for duree in sorted({int(d) for d in durees}):
        c = calculer_capacite(profil, duree)
        comparaison.append({
            "duree_annees": duree,
            "taux_retenu": c["taux_nominal_retenu"],
            "capital_empruntable": c["capital_empruntable"],
            "mensualite": c["detail_credit"]["mensualite_totale"],
            "cout_total_credit": c["detail_credit"]["cout_total_credit"],
        })

    if len(comparaison) >= 2:
        court, long = comparaison[0], comparaison[-1]
        arbitrage = {
            "budget_supplementaire": round(
                long["capital_empruntable"] - court["capital_empruntable"], 2),
            "surcout_credit": round(
                long["cout_total_credit"] - court["cout_total_credit"], 2),
        }
    else:
        arbitrage = {}

    return {"comparaison": comparaison, "arbitrage_court_vs_long": arbitrage}


# Informations indispensables avant tout calcul, avec la question à poser.
# Le modèle appelle cet outil pour savoir ce qu'il lui reste à demander : la
# check-list est ainsi DANS LE CODE, pas dans le prompt, donc stable.
INFORMATIONS_REQUISES: dict[str, str] = {
    "revenus_nets_mensuels":
        "Quels sont vos revenus nets mensuels, tous emprunteurs confondus ?",
    "situation_professionnelle":
        "Quelle est votre situation professionnelle ? (CDI, fonctionnaire, "
        "CDD, indépendant, intérim, recherche d'emploi)",
    "apport":
        "De quel apport personnel disposez-vous ?",
    "charges_credits_mensuelles":
        "Avez-vous des crédits en cours ? Si oui, quelle mensualité totale "
        "(auto, consommation, prêt étudiant) ?",
    "autres_revenus_mensuels":
        "Percevez-vous d'autres revenus réguliers (loyers, pensions) ?",
    "nb_adultes":
        "Combien d'adultes composent le foyer ?",
    "nb_enfants":
        "Avez-vous des enfants à charge, et de quel âge ?",
    "loyer_actuel":
        "Quel loyer payez-vous actuellement ? (0 si vous êtes hébergé ou "
        "déjà propriétaire)",
    "departement":
        "Dans quel département cherchez-vous ? Un code sur 2 chiffres suffit.",
    "primo_accedant":
        "S'agit-il de votre première acquisition de résidence principale ?",
}


def outil_verifier_dossier(**args: Any) -> dict:
    """
    Fait le point sur les informations collectées et celles qui manquent.

    À appeler AVANT tout calcul. Renvoie la prochaine question à poser, ce
    qui évite au modèle de se lancer dans une simulation en comblant les
    trous par des suppositions silencieuses.
    """
    fournies = {c: args[c] for c in INFORMATIONS_REQUISES if c in args}
    manquantes = [c for c in INFORMATIONS_REQUISES if c not in args]
    return {
        "informations_fournies": fournies,
        "informations_manquantes": manquantes,
        "questions_a_poser": [INFORMATIONS_REQUISES[c] for c in manquantes],
        "prochaine_question": (INFORMATIONS_REQUISES[manquantes[0]]
                               if manquantes else None),
        "dossier_complet": not manquantes,
        "consigne": (
            "Pose UNE seule question à la fois, en commençant par "
            "'prochaine_question'. N'invente aucune de ces valeurs et ne les "
            "remplis pas par défaut : chacune modifie le résultat."
            if manquantes else
            "Toutes les informations sont réunies, tu peux lancer les calculs."
        ),
    }


def outil_generer_dossier(**args: Any) -> dict:
    """
    Produit le dossier de prêt complet, en JSON.

    C'est le livrable final de la fonctionnalité. À n'appeler qu'une fois le
    dossier complet, sinon le document reposerait sur des suppositions.
    """
    erreur = _valider_departement(args.get("departement"))
    if erreur:
        return {"erreur": erreur}
    from realstate_financement.dossier import generer_dossier

    projet = Projet(
        prix_bien=float(args["prix_bien"]),
        departement=args["departement"],
        type_bien=args.get("type_bien", "ancien"),
        montant_travaux=float(args.get("montant_travaux", 0)),
        duree_souhaitee_annees=int(args.get("duree_annees", 25)),
    )
    return generer_dossier(
        _profil(args), projet,
        charges_logement_previsionnelles=float(
            args.get("charges_logement_previsionnelles", 0)),
        nb_enfants_moins_14=args.get("nb_enfants_moins_14"),
    )


def outil_plan_budget(**args: Any) -> dict:
    """Budget mensuel prévisionnel du foyer une fois le prêt en cours."""
    return construire_plan_budget(
        revenus_mensuels=float(args["revenus_nets_mensuels"]),
        mensualite_credit=float(args["mensualite_credit"]),
        charges_credits_mensuelles=float(args.get("charges_credits_mensuelles", 0)),
        charges_logement_previsionnelles=float(
            args.get("charges_logement_previsionnelles", 0)),
        nb_adultes=int(args.get("nb_adultes", 1)),
        nb_enfants_moins_14=int(args.get("nb_enfants_moins_14", 0)),
        nb_enfants_14_et_plus=int(args.get("nb_enfants_14_et_plus", 0)),
    )


# Pièces justificatives : liste déterministe, adaptée à la situation.
# Aucune raison de laisser le modèle l'inventer, elle est stable et connue.
PIECES_COMMUNES = [
    "Pièce d'identité en cours de validité",
    "Justificatif de domicile de moins de 3 mois",
    "3 derniers relevés de tous les comptes bancaires",
    "Dernier avis d'imposition",
    "Justificatif de l'apport personnel et de sa provenance",
    "Compromis de vente signé",
]
PIECES_PAR_SITUATION = {
    "CDI": ["3 derniers bulletins de salaire", "Contrat de travail",
            "Attestation employeur de non-période d'essai"],
    "fonctionnaire": ["3 derniers bulletins de salaire", "Arrêté de titularisation"],
    "CDD": ["12 derniers bulletins de salaire", "Contrat de travail en cours",
            "Justificatif d'ancienneté dans la branche"],
    "independant": ["3 derniers bilans et comptes de résultat",
                    "2 derniers avis d'imposition", "Extrait Kbis ou avis SIRENE"],
    "interim": ["12 derniers bulletins de salaire",
                "Attestation de l'agence sur la régularité des missions"],
    "chomage": ["Notification d'ouverture de droits France Travail",
                "Justificatifs des indemnités perçues"],
}


def outil_pieces_justificatives(**args: Any) -> dict:
    """Liste des pièces à réunir, adaptée à la situation de l'emprunteur."""
    situation = args.get("situation_professionnelle", "CDI")
    pieces = list(PIECES_COMMUNES) + PIECES_PAR_SITUATION.get(situation, [])

    if args.get("type_bien") == "neuf":
        pieces.append("Contrat de réservation VEFA et plans")
    else:
        pieces.append("Diagnostics techniques du bien (DPE, amiante, plomb)")
    if float(args.get("charges_credits_mensuelles", 0)) > 0:
        pieces.append("Tableaux d'amortissement des crédits en cours")
    if float(args.get("autres_revenus_mensuels", 0)) > 0:
        pieces.append("Justificatifs des revenus complémentaires (baux, avis)")
    if args.get("primo_accedant"):
        pieces.append("Attestation sur l'honneur de primo-accession")

    return {"situation": situation, "nombre_de_pieces": len(pieces), "pieces": pieces}


# --- Catalogue exposé au modèle --------------------------------------------

def _schema(nom: str, description: str, proprietes: dict, requis: list[str]) -> dict:
    return {
        "type": "function",
        "function": {
            "name": nom,
            "description": description,
            "parameters": {
                "type": "object",
                "properties": proprietes,
                "required": requis,
            },
        },
    }


OUTILS: list[dict] = [
    _schema(
        "calculer_capacite_emprunt",
        "Calcule le montant maximal empruntable selon la norme HCSF "
        "(35 % d'endettement assurance comprise). À utiliser quand la personne "
        "demande combien elle peut emprunter.",
        {**CHAMPS_PROFIL,
         "duree_annees": {"type": "integer",
                          "description": "Durée du prêt en années, 25 par défaut."}},
        ["revenus_nets_mensuels", "apport", "charges_credits_mensuelles"],
    ),
    _schema(
        "calculer_budget_maximum",
        "Calcule le prix de bien maximal atteignable, frais d'acquisition et de "
        "crédit compris. À utiliser quand la personne demande quel bien elle peut "
        "viser, sans avoir encore de bien précis en tête.",
        {**CHAMPS_PROFIL, **CHAMPS_BIEN,
         "duree_annees": {"type": "integer", "description": "Durée du prêt en années."}},
        ["revenus_nets_mensuels", "apport", "charges_credits_mensuelles", "departement"],
    ),
    _schema(
        "analyser_projet",
        "Analyse complète d'un bien précis : plan de financement, mensualité, "
        "conformité HCSF, reste à vivre et score du dossier. À utiliser dès que "
        "la personne mentionne un prix de bien concret.",
        {**CHAMPS_PROFIL, **CHAMPS_BIEN,
         "prix_bien": {"type": "number", "description": "Prix du bien en euros."},
         "montant_travaux": {"type": "number",
                             "description": "Montant des travaux prévus. Au-delà de "
                                            "10 % de l'opération, la durée maximale "
                                            "passe de 25 à 27 ans."},
         "duree_annees": {"type": "integer", "description": "Durée souhaitée en années."}},
        ["revenus_nets_mensuels", "apport", "charges_credits_mensuelles",
         "prix_bien", "departement"],
    ),
    _schema(
        "estimer_frais_acquisition",
        "Estime les seuls frais d'acquisition (droits de mutation, émoluments du "
        "notaire, débours) pour un prix et un département donnés. À utiliser pour "
        "une question portant uniquement sur les frais de notaire.",
        {**CHAMPS_BIEN,
         "prix_bien": {"type": "number", "description": "Prix du bien en euros."},
         "primo_accedant": CHAMPS_PROFIL["primo_accedant"]},
        ["prix_bien", "departement"],
    ),
    _schema(
        "comparer_durees",
        "Compare plusieurs durées d'emprunt : capacité, mensualité et coût total "
        "du crédit pour chacune. À utiliser quand la personne hésite sur la durée "
        "ou demande l'effet d'un allongement.",
        {**CHAMPS_PROFIL,
         "durees": {"type": "array", "items": {"type": "integer"},
                    "description": "Durées à comparer, ex. [15, 20, 25]."}},
        ["revenus_nets_mensuels"],
    ),
    _schema(
        "verifier_dossier",
        "Fait le point sur les informations déjà collectées et indique celles "
        "qui manquent, avec la question à poser. APPELLE CET OUTIL EN PREMIER, "
        "avant tout calcul, puis à nouveau après chaque réponse, jusqu'à ce "
        "que 'dossier_complet' soit vrai. Ne transmets que les informations "
        "que la personne t'a réellement données.",
        {**CHAMPS_PROFIL, **CHAMPS_BIEN},
        [],
    ),
    _schema(
        "generer_dossier_pret",
        "Produit le DOSSIER DE PRÊT complet en JSON : situation de "
        "l'emprunteur, plan de financement, conformité HCSF, score, budget "
        "prévisionnel, pièces à fournir, points forts, points de vigilance et "
        "leviers d'amélioration chiffrés. C'est le livrable final : ne "
        "l'appelle qu'une fois toutes les informations collectées.",
        {**CHAMPS_PROFIL, **CHAMPS_BIEN,
         "prix_bien": {"type": "number", "description": "Prix du bien en euros."},
         "montant_travaux": {"type": "number",
                             "description": "Montant des travaux prévus."},
         "duree_annees": {"type": "integer", "description": "Durée souhaitée."},
         "charges_logement_previsionnelles": {
             "type": "number",
             "description": "Copropriété, taxe foncière, énergie, assurance "
                            "habitation. Demande-le, ne mets pas 0 par défaut."},
         "nb_enfants_moins_14": {"type": "integer",
                                 "description": "Enfants de moins de 14 ans, "
                                                "pour le calcul des unités de "
                                                "consommation."}},
        ["revenus_nets_mensuels", "apport", "charges_credits_mensuelles",
         "situation_professionnelle", "prix_bien", "departement"],
    ),
    _schema(
        "construire_plan_budget",
        "Construit le budget mensuel prévisionnel du foyer une fois le prêt en "
        "cours : disponible après engagements et répartition indicative par "
        "poste de dépense, fondée sur les coefficients budgétaires de l'INSEE. "
        "À utiliser après avoir calculé une mensualité, quand la personne veut "
        "savoir ce qu'il lui restera pour vivre.",
        {"revenus_nets_mensuels": CHAMPS_PROFIL["revenus_nets_mensuels"],
         "mensualite_credit": {
             "type": "number",
             "description": "Mensualité du prêt immobilier, assurance comprise, "
                            "telle que renvoyée par un autre outil."},
         "charges_credits_mensuelles": CHAMPS_PROFIL["charges_credits_mensuelles"],
         "charges_logement_previsionnelles": {
             "type": "number",
             "description": "Charges de copropriété, taxe foncière mensualisée, "
                            "énergie et assurance habitation. Poste très souvent "
                            "oublié : demande-le plutôt que de mettre 0."},
         "nb_adultes": CHAMPS_PROFIL["nb_adultes"],
         "nb_enfants_moins_14": {"type": "integer",
                                 "description": "Enfants de moins de 14 ans."},
         "nb_enfants_14_et_plus": {"type": "integer",
                                   "description": "Enfants de 14 ans ou plus."}},
        ["revenus_nets_mensuels", "mensualite_credit"],
    ),
    _schema(
        "lister_pieces_justificatives",
        "Liste les documents à réunir pour le dossier de prêt, adaptés à la "
        "situation professionnelle et au type de bien.",
        {"situation_professionnelle": CHAMPS_PROFIL["situation_professionnelle"],
         "type_bien": CHAMPS_BIEN["type_bien"],
         "primo_accedant": CHAMPS_PROFIL["primo_accedant"],
         "charges_credits_mensuelles": CHAMPS_PROFIL["charges_credits_mensuelles"],
         "autres_revenus_mensuels": CHAMPS_PROFIL["autres_revenus_mensuels"]},
        ["situation_professionnelle"],
    ),
]

IMPLEMENTATIONS: dict[str, Callable[..., dict]] = {
    "verifier_dossier": outil_verifier_dossier,
    "construire_plan_budget": outil_plan_budget,
    "generer_dossier_pret": outil_generer_dossier,
    "calculer_capacite_emprunt": outil_capacite_emprunt,
    "calculer_budget_maximum": outil_budget_maximum,
    "analyser_projet": outil_analyser_projet,
    "estimer_frais_acquisition": outil_frais_acquisition,
    "comparer_durees": outil_comparer_durees,
    "lister_pieces_justificatives": outil_pieces_justificatives,
}


def executer_outil(nom: str, arguments: str | dict) -> dict:
    """
    Exécute un outil demandé par le modèle et renvoie son résultat.

    Les erreurs ne sont JAMAIS levées : elles sont renvoyées au modèle sous
    forme de dictionnaire. Il peut alors reformuler son appel ou demander
    l'information manquante à l'utilisateur, au lieu de faire planter la
    conversation.
    """
    if isinstance(arguments, str):
        try:
            arguments = json.loads(arguments or "{}")
        except json.JSONDecodeError as err:
            return {"erreur": f"Arguments JSON invalides : {err}"}

    fonction = IMPLEMENTATIONS.get(nom)
    if fonction is None:
        return {"erreur": f"Outil inconnu : {nom}",
                "outils_disponibles": list(IMPLEMENTATIONS)}
    try:
        return fonction(**arguments)
    except (KeyError, TypeError) as err:
        return {"erreur": f"Argument manquant ou invalide : {err}",
                "conseil": "Demande l'information manquante à l'utilisateur."}
    except (ValueError, ZeroDivisionError) as err:
        return {"erreur": f"Calcul impossible : {err}"}
