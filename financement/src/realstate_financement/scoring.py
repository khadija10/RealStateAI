"""
Scoring de la solidité du dossier.

CHOIX MÉTHODOLOGIQUE IMPORTANT : on note LE DOSSIER, pas les banques.

Aucune donnée publique ne permet de scorer un établissement bancaire : les
grilles d'octroi et les taux réels ne sont pas publiés, ils se négocient au
cas par cas. Afficher « Banque X : 3,15 %, score 82/100 » serait une
invention, et donc indéfendable.

On évalue donc ce qui est objectivable : le taux d'effort, l'apport, le reste
à vivre, la stabilité professionnelle et le saut de charge. Ce sont les
critères que toute banque examine, et chacun est calculé à partir de données
fournies par l'utilisateur.

Les pondérations sont des hypothèses assumées, documentées dans le barème.
"""

from __future__ import annotations

from realstate_financement.config import parametre
from realstate_financement.hcsf import reste_a_vivre, saut_de_charge, taux_endettement
from realstate_financement.modeles import ProfilEmprunteur


def _note_endettement(taux: float, plafond: float) -> float:
    """100 à 20 % d'endettement, 0 au-delà du plafond réglementaire."""
    if taux <= 0.20:
        return 1.0
    if taux >= plafond:
        return 0.0
    return (plafond - taux) / (plafond - 0.20)


def _note_apport(apport: float, cout_total: float) -> float:
    """
    L'apport est jugé sur sa capacité à couvrir les frais d'acquisition.
    À 10 % il les couvre, à 20 % il rassure pleinement. Au-delà, plus de gain.
    """
    if cout_total <= 0:
        return 0.0
    part = apport / cout_total
    return min(1.0, part / 0.20)


def _note_reste_a_vivre(disponible: float, minimum: float) -> float:
    """Note maximale quand le reste à vivre atteint le double du minimum."""
    if minimum <= 0:
        return 1.0
    if disponible <= minimum:
        return max(0.0, disponible / minimum * 0.5)
    return min(1.0, 0.5 + 0.5 * (disponible - minimum) / minimum)


def _note_saut_de_charge(profil: ProfilEmprunteur, mensualite: float) -> float:
    """
    Un emprunteur déjà locataire à un niveau proche de la future mensualité a
    démontré sa capacité à supporter la charge. Sans loyer actuel (hébergé,
    propriétaire), on ne peut pas juger : on attribue une note neutre plutôt
    que de pénaliser une situation non renseignée.
    """
    saut = saut_de_charge(profil, mensualite)
    if not saut["evaluable"]:
        return 0.5
    ratio = saut["ratio"]
    if ratio <= 1.0:
        return 1.0
    if ratio >= 2.0:
        return 0.0
    return 1.0 - (ratio - 1.0)


def scorer_dossier(profil: ProfilEmprunteur, mensualite: float,
                   cout_total_operation: float) -> dict:
    """Score sur 100, avec le détail de chaque composante."""
    poids = parametre("scoring", "poids", defaut={}) or {}
    bareme_stab = parametre("scoring", "bareme_stabilite", defaut={}) or {}
    seuils = parametre("scoring", "seuils_appreciation", defaut={}) or {}
    plafond = float(parametre("hcsf", "taux_endettement_max", defaut=0.35))

    rav = reste_a_vivre(profil, mensualite)
    notes = {
        "taux_endettement": _note_endettement(taux_endettement(mensualite, profil), plafond),
        "apport": _note_apport(profil.apport, cout_total_operation),
        "reste_a_vivre": _note_reste_a_vivre(rav["reste_a_vivre"], rav["minimum_requis"]),
        "stabilite_professionnelle": float(
            bareme_stab.get(profil.situation_professionnelle, 0.5)
        ),
        "saut_de_charge": _note_saut_de_charge(profil, mensualite),
    }

    detail = {cle: round(note * float(poids.get(cle, 0)), 1)
              for cle, note in notes.items()}
    score = round(sum(detail.values()), 1)

    if score >= float(seuils.get("excellent", 80)):
        appreciation = "excellent"
    elif score >= float(seuils.get("solide", 65)):
        appreciation = "solide"
    elif score >= float(seuils.get("acceptable", 50)):
        appreciation = "acceptable"
    else:
        appreciation = "fragile"

    # Les deux composantes les plus pénalisantes, en écart au maximum possible.
    faiblesses = sorted(
        notes, key=lambda c: (notes[c] - 1) * float(poids.get(c, 0))
    )[:2]

    return {
        "score_sur_100": score,
        "appreciation": appreciation,
        "detail_points": detail,
        "notes_brutes": {k: round(v, 3) for k, v in notes.items()},
        "points_a_ameliorer": faiblesses,
    }
