"""
Accompagnement budgétaire du foyer.

OBJECTIF : après avoir déterminé la mensualité, aider la personne à voir ce
qu'il lui restera réellement pour vivre, poste par poste.

PRÉCAUTION MÉTHODOLOGIQUE, à afficher clairement à l'utilisateur :
les répartitions produites ici sont des REPÈRES STATISTIQUES issus des
coefficients budgétaires de l'INSEE — la structure de dépenses moyenne des
ménages français. Ce ne sont PAS des prescriptions. Personne ne « doit »
consacrer 13 % de son budget à l'alimentation : c'est ce que fait un ménage
moyen. L'écart à cette moyenne n'est ni bon ni mauvais en soi, il indique
simplement un mode de vie différent.

Deux références officielles structurent le module :

  - l'échelle d'équivalence OCDE modifiée, utilisée par l'INSEE : 1 unité de
    consommation (UC) pour le premier adulte, 0,5 par personne de 14 ans ou
    plus, 0,3 par enfant de moins de 14 ans. Elle traduit le fait qu'un foyer
    de quatre personnes ne dépense pas quatre fois ce que dépense une seule ;

  - les coefficients budgétaires INSEE, qui varient selon le niveau de vie :
    les ménages modestes consacrent une part bien plus élevée de leur budget
    au logement et à l'alimentation.
"""

from __future__ import annotations

from realstate_financement.config import parametre

# Échelle OCDE modifiée (INSEE). Sert à comparer des foyers de tailles
# différentes sur une base équivalente.
UC_PREMIER_ADULTE = 1.0
UC_PERSONNE_14_ET_PLUS = 0.5
UC_ENFANT_MOINS_14 = 0.3


def unites_consommation(nb_adultes: int = 1, nb_enfants_moins_14: int = 0,
                        nb_enfants_14_et_plus: int = 0) -> float:
    """Nombre d'unités de consommation du foyer, échelle OCDE modifiée."""
    if nb_adultes < 1:
        nb_adultes = 1
    return round(
        UC_PREMIER_ADULTE
        + UC_PERSONNE_14_ET_PLUS * (nb_adultes - 1 + nb_enfants_14_et_plus)
        + UC_ENFANT_MOINS_14 * nb_enfants_moins_14,
        2,
    )


def _coefficients(niveau_de_vie: str) -> dict[str, float]:
    """
    Coefficients budgétaires selon le niveau de vie du foyer.

    L'INSEE observe une structure de dépenses nettement différente selon le
    quintile : les ménages modestes consacrent davantage au logement et à
    l'alimentation, les plus aisés davantage aux transports et aux loisirs.
    Appliquer une structure unique à tous serait donc trompeur.

    Ces coefficients portent sur les dépenses HORS remboursement de crédit
    immobilier, puisque celui-ci est déjà déduit en amont.
    """
    grilles = parametre("budget", "coefficients_par_niveau", defaut={}) or {}
    if niveau_de_vie in grilles:
        return {k: float(v) for k, v in grilles[niveau_de_vie].items()}
    return {k: float(v) for k, v in (grilles.get("median") or {}).items()}


def niveau_de_vie(revenus_mensuels: float, uc: float) -> tuple[str, float]:
    """
    Positionne le foyer par rapport aux seuils de niveau de vie.

    Le niveau de vie est le revenu du foyer divisé par ses unités de
    consommation : c'est ce qui permet de comparer un célibataire et une
    famille de quatre personnes.
    """
    par_uc = revenus_mensuels / uc if uc else 0.0
    seuils = parametre("budget", "seuils_niveau_de_vie", defaut={}) or {}
    if par_uc < float(seuils.get("modeste", 1500)):
        return "modeste", round(par_uc, 2)
    if par_uc > float(seuils.get("aise", 2800)):
        return "aise", round(par_uc, 2)
    return "median", round(par_uc, 2)


def construire_plan_budget(
    revenus_mensuels: float,
    mensualite_credit: float,
    charges_credits_mensuelles: float = 0.0,
    charges_logement_previsionnelles: float = 0.0,
    nb_adultes: int = 1,
    nb_enfants_moins_14: int = 0,
    nb_enfants_14_et_plus: int = 0,
) -> dict:
    """
    Construit le budget mensuel prévisionnel une fois le prêt en cours.

    `charges_logement_previsionnelles` couvre ce que le crédit ne comprend
    pas : charges de copropriété, taxe foncière mensualisée, énergie,
    assurance habitation. C'est le poste que les emprunteurs oublient le plus
    souvent, et il peut représenter 200 à 400 € par mois.
    """
    uc = unites_consommation(nb_adultes, nb_enfants_moins_14, nb_enfants_14_et_plus)
    niveau, revenu_par_uc = niveau_de_vie(revenus_mensuels, uc)

    engagements = mensualite_credit + charges_credits_mensuelles
    disponible = revenus_mensuels - engagements - charges_logement_previsionnelles

    coefficients = _coefficients(niveau)
    # Le logement est déjà financé par la mensualité et les charges : on
    # redistribue son coefficient sur les autres postes pour que la
    # répartition du disponible reste cohérente.
    hors_logement = {k: v for k, v in coefficients.items() if k != "logement_energie"}
    total = sum(hors_logement.values()) or 1.0

    repartition = [
        {
            "poste": poste,
            "part_du_disponible": round(coef / total, 4),
            "montant_indicatif": round(max(0.0, disponible) * coef / total, 2),
            "montant_par_uc": round(max(0.0, disponible) * coef / total / uc, 2) if uc else 0,
        }
        for poste, coef in sorted(hors_logement.items(),
                                  key=lambda item: -item[1])
    ]

    seuil_alerte = float(parametre("budget", "reste_a_vivre_alerte_par_uc",
                                   defaut=700)) * uc
    epargne_precaution = float(parametre("budget", "epargne_precaution_mois",
                                         defaut=3)) * (engagements
                                                       + charges_logement_previsionnelles)

    alertes: list[str] = []
    if disponible < seuil_alerte:
        alertes.append(
            f"Le disponible mensuel ({disponible:,.0f} €) est inférieur au repère "
            f"de {seuil_alerte:,.0f} € pour un foyer de {uc} unités de "
            "consommation. Le budget serait très tendu.".replace(",", " ")
        )
    if charges_logement_previsionnelles == 0:
        alertes.append(
            "Aucune charge de logement n'a été renseignée. Copropriété, taxe "
            "foncière, énergie et assurance habitation représentent souvent "
            "200 à 400 € par mois et sont systématiquement sous-estimées."
        )

    return {
        "unites_consommation": uc,
        "niveau_de_vie": niveau,
        "revenu_mensuel_par_uc": revenu_par_uc,
        "revenus_mensuels": round(revenus_mensuels, 2),
        "mensualite_credit": round(mensualite_credit, 2),
        "charges_credits_mensuelles": round(charges_credits_mensuelles, 2),
        "charges_logement_previsionnelles": round(charges_logement_previsionnelles, 2),
        "disponible_apres_engagements": round(disponible, 2),
        "repartition_indicative": repartition,
        "epargne_precaution_recommandee": round(epargne_precaution, 2),
        "alertes": alertes,
        "avertissement_methodologique": (
            "Ces montants sont des REPÈRES issus des coefficients budgétaires "
            "de l'INSEE, c'est-à-dire la structure de dépenses moyenne des "
            "ménages français de niveau de vie comparable. Ce ne sont pas des "
            "prescriptions : dépenser plus ou moins sur un poste n'est ni bon "
            "ni mauvais, cela traduit un mode de vie. Les unités de "
            "consommation suivent l'échelle OCDE modifiée utilisée par l'INSEE."
        ),
    }
