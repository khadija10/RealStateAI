"""
Calculs de prêt amortissable à taux fixe.

Toutes les formules sont explicites et vérifiables à la main. C'est
volontaire : chaque montant présenté à l'utilisateur doit pouvoir être
recalculé par un membre du jury avec une calculatrice.

Convention française : l'assurance emprunteur est calculée sur le CAPITAL
INITIAL et reste donc constante sur toute la durée du prêt. C'est le cas le
plus répandu (contrat groupe bancaire). Certains contrats individuels la
calculent sur le capital restant dû, ce qui la rend dégressive.
"""

from __future__ import annotations

from realstate_financement.config import parametre


def mensualite_credit(capital: float, taux_annuel: float, duree_annees: int) -> float:
    """
    Mensualité hors assurance d'un prêt amortissable.

        M = C x i / (1 - (1 + i)^-n)

    avec i le taux mensuel (taux annuel / 12) et n le nombre de mensualités.

    Le cas taux nul est traité à part : la formule ci-dessus diviserait par
    zéro alors que la réponse est simplement C / n.
    """
    if capital <= 0 or duree_annees <= 0:
        return 0.0
    n = duree_annees * 12
    if taux_annuel == 0:
        return capital / n
    i = taux_annuel / 12
    return capital * i / (1 - (1 + i) ** -n)


def mensualite_assurance(capital: float, taux_assurance: float | None = None) -> float:
    """Cotisation mensuelle d'assurance, assise sur le capital initial."""
    if taux_assurance is None:
        taux_assurance = parametre("hypotheses_marche", "taux_assurance_emprunteur",
                                   defaut=0.0034)
    return capital * taux_assurance / 12


def mensualite_totale(capital: float, taux_annuel: float, duree_annees: int,
                      taux_assurance: float | None = None) -> float:
    """Mensualité assurance comprise — c'est elle que retient la norme HCSF."""
    return (mensualite_credit(capital, taux_annuel, duree_annees)
            + mensualite_assurance(capital, taux_assurance))


def capital_empruntable(mensualite_max: float, taux_annuel: float, duree_annees: int,
                        taux_assurance: float | None = None) -> float:
    """
    Capital maximal finançable pour une mensualité donnée, assurance comprise.

    On inverse la formule de la mensualité. L'assurance étant proportionnelle
    au capital, elle se factorise :

        M_max = C x [ i / (1 - (1+i)^-n) + ta / 12 ]
        C     = M_max / [ i / (1 - (1+i)^-n) + ta / 12 ]

    Pas d'itération ni d'approximation : la solution est exacte.
    """
    if mensualite_max <= 0 or duree_annees <= 0:
        return 0.0
    if taux_assurance is None:
        taux_assurance = parametre("hypotheses_marche", "taux_assurance_emprunteur",
                                   defaut=0.0034)

    n = duree_annees * 12
    facteur_credit = 1 / n if taux_annuel == 0 else (
        (taux_annuel / 12) / (1 - (1 + taux_annuel / 12) ** -n)
    )
    return mensualite_max / (facteur_credit + taux_assurance / 12)


def taux_indicatif(duree_annees: int) -> float:
    """
    Taux nominal indicatif pour une durée donnée.

    ATTENTION : hypothèse paramétrable issue du barème, PAS une offre
    bancaire. Aucune banque ne publie ses grilles ; un taux réel se négocie
    au cas par cas.
    """
    grille = parametre("hypotheses_marche", "taux_nominal_par_duree", defaut={}) or {}
    if not grille:
        return 0.033
    # On retient la durée disponible la plus proche de celle demandée.
    duree_proche = min(grille, key=lambda d: abs(int(d) - duree_annees))
    return float(grille[duree_proche])


def cout_total_credit(capital: float, taux_annuel: float, duree_annees: int,
                      taux_assurance: float | None = None) -> dict[str, float]:
    """Décomposition du coût du crédit sur toute sa durée."""
    n = duree_annees * 12
    m_credit = mensualite_credit(capital, taux_annuel, duree_annees)
    m_assurance = mensualite_assurance(capital, taux_assurance)
    interets = m_credit * n - capital
    if taux_assurance is None:
        taux_assurance = parametre("hypotheses_marche", "taux_assurance_emprunteur",
                                   defaut=0.0034)
    return {
        # Taux explicitement renvoyé : sans lui, le modèle le déduit lui-même
        # en divisant la cotisation par le capital, et publie un taux faux.
        "taux_assurance_applique": round(taux_assurance, 4),
        "mensualite_credit": round(m_credit, 2),
        "mensualite_assurance": round(m_assurance, 2),
        "mensualite_totale": round(m_credit + m_assurance, 2),
        "total_interets": round(interets, 2),
        "total_assurance": round(m_assurance * n, 2),
        # Nom explicite : ce montant N'EST PAS que des intérêts, il inclut
        # l'assurance. L'ambiguïté conduisait le modèle à mal l'intituler.
        "cout_total_credit_interets_et_assurance": round(interets + m_assurance * n, 2),
        "cout_total_credit": round(interets + m_assurance * n, 2),
        "montant_total_rembourse": round((m_credit + m_assurance) * n, 2),
    }
