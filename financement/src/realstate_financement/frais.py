"""
Frais d'acquisition — ce qu'on appelle abusivement « frais de notaire ».

Trois composantes, très inégales :
  - les DROITS DE MUTATION (DMTO), qui représentent l'essentiel et vont
    intégralement aux collectivités et à l'État ;
  - les ÉMOLUMENTS du notaire, sa rémunération, fixée par arrêté selon un
    barème dégressif par tranches ;
  - les DÉBOURS et taxes annexes.

Le notaire ne perçoit qu'environ un dixième du total : c'est une précision
utile à donner à l'utilisateur, qui croit souvent l'inverse.

Point d'attention 2026 : la loi de finances 2025 a autorisé les départements
à porter leur taux de 4,50 % à 5,00 % jusqu'en avril 2028. La majorité l'a
voté, portant les DMTO de 5,81 % à 6,32 %. Les primo-accédants échappent à
cette hausse.
"""

from __future__ import annotations

from realstate_financement.config import parametre
from realstate_financement.modeles import Projet


def taux_droits_mutation(departement: str = "75", neuf: bool = False,
                         primo_accedant: bool = False) -> float:
    """
    Taux global de DMTO applicable, en fraction du prix.

    Dans le neuf (VEFA ou achèvement de moins de 5 ans), les DMTO sont
    remplacés par une taxe de publicité foncière réduite, identique partout.
    """
    if neuf:
        return float(parametre("droits_mutation", "neuf", "taxe_publicite_fonciere",
                               defaut=0.00715))

    ancien = parametre("droits_mutation", "ancien", defaut={}) or {}
    reduits = parametre("droits_mutation", "departements_taux_reduit", defaut=[]) or []

    # Taux plein sauf primo-accédant ou département n'ayant pas voté la hausse.
    if primo_accedant or departement in reduits:
        taux_dep = float(ancien.get("taux_departemental_reduit", 0.0450))
    else:
        taux_dep = float(ancien.get("taux_departemental_plein", 0.0500))

    taxe_communale = float(ancien.get("taxe_communale", 0.0120))
    frais_assiette = taux_dep * float(
        ancien.get("frais_assiette_sur_droit_departemental", 0.0237)
    )
    return taux_dep + taxe_communale + frais_assiette


def emoluments_notaire(prix: float) -> float:
    """
    Émoluments TTC, calculés par tranches successives sur le prix de vente.

    Barème dégressif : chaque tranche a son propre taux, appliqué uniquement
    à la fraction du prix qui la traverse — comme l'impôt sur le revenu, et
    non comme un taux unique sur le total.
    """
    if prix <= 0:
        return 0.0
    tranches = parametre("emoluments_notaire", "tranches", defaut=[]) or []
    tva = float(parametre("emoluments_notaire", "tva", defaut=0.20))

    total_ht = 0.0
    plancher = 0.0
    for tranche in tranches:
        plafond = tranche.get("plafond")
        borne = prix if plafond is None else min(prix, float(plafond))
        if borne > plancher:
            total_ht += (borne - plancher) * float(tranche["taux"])
            plancher = borne
        if plafond is not None and prix <= float(plafond):
            break
    return total_ht * (1 + tva)


def frais_acquisition(projet: Projet, primo_accedant: bool = False) -> dict[str, float]:
    """Détail complet des frais d'acquisition, poste par poste."""
    prix = projet.prix_bien
    neuf = projet.type_bien == "neuf"

    taux_dmto = taux_droits_mutation(projet.departement, neuf, primo_accedant)
    droits = prix * taux_dmto
    emoluments = emoluments_notaire(prix)
    csi = prix * float(parametre("autres_frais", "contribution_securite_immobiliere",
                                 defaut=0.0010))
    debours = float(parametre("autres_frais", "debours_forfaitaires", defaut=1200))

    total = droits + emoluments + csi + debours
    return {
        "droits_mutation": round(droits, 2),
        "taux_droits_mutation": round(taux_dmto, 5),
        "emoluments_notaire_ttc": round(emoluments, 2),
        "contribution_securite_immobiliere": round(csi, 2),
        "debours": round(debours, 2),
        "total_frais_acquisition": round(total, 2),
        "part_du_prix": round(total / prix, 4) if prix else 0.0,
        "part_revenant_au_notaire": round(emoluments / total, 4) if total else 0.0,
    }


def frais_credit(capital: float, type_garantie: str = "caution") -> dict[str, float]:
    """
    Frais bancaires : dossier et garantie.

    La caution d'un organisme spécialisé est en général moins chère que
    l'inscription hypothécaire, et une partie en est restituée à la fin du
    prêt. Ces montants se négocient, contrairement aux DMTO.
    """
    conf = parametre("frais_credit", defaut={}) or {}
    dossier = capital * float(conf.get("frais_dossier_taux", 0.010))
    dossier = min(max(dossier, float(conf.get("frais_dossier_plancher", 500))),
                  float(conf.get("frais_dossier_plafond", 1500)))

    cle = ("garantie_hypotheque_taux" if type_garantie == "hypotheque"
           else "garantie_caution_taux")
    garantie = capital * float(conf.get(cle, 0.0120))

    return {
        "frais_dossier": round(dossier, 2),
        "frais_garantie": round(garantie, 2),
        "type_garantie": type_garantie,
        "total_frais_credit": round(dossier + garantie, 2),
    }
