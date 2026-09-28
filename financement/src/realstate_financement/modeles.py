"""
Structures de données du moteur de financement.

Des dataclasses plutôt que des dictionnaires : les champs sont typés, les
erreurs de saisie apparaissent immédiatement, et l'agent conversationnel
sait exactement quelles informations il lui reste à collecter.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal

SituationPro = Literal["CDI", "fonctionnaire", "CDD", "independant", "interim", "chomage"]
TypeBien = Literal["ancien", "neuf"]
TypeGarantie = Literal["caution", "hypotheque"]


@dataclass
class ProfilEmprunteur:
    """Situation financière de l'emprunteur (ou du couple)."""

    revenus_nets_mensuels: float
    apport: float = 0.0
    charges_credits_mensuelles: float = 0.0      # crédits conso, auto, etc.
    autres_revenus_mensuels: float = 0.0         # loyers perçus, pensions
    situation_professionnelle: SituationPro = "CDI"
    nb_adultes: int = 1
    nb_enfants: int = 0
    loyer_actuel: float = 0.0                    # sert au calcul du saut de charge
    primo_accedant: bool = False

    @property
    def revenus_totaux(self) -> float:
        """
        Les revenus locatifs ne sont pris qu'à 70 % par les banques, pour
        couvrir la vacance et les impayés. C'est un usage constant du secteur.
        """
        return self.revenus_nets_mensuels + 0.7 * self.autres_revenus_mensuels

    def champs_manquants(self) -> list[str]:
        """Informations indispensables encore absentes — utile à l'agent."""
        manquants = []
        if self.revenus_nets_mensuels <= 0:
            manquants.append("revenus_nets_mensuels")
        if self.apport < 0:
            manquants.append("apport")
        return manquants


@dataclass
class Projet:
    """Caractéristiques de l'opération immobilière envisagée."""

    prix_bien: float
    departement: str = "75"
    type_bien: TypeBien = "ancien"
    montant_travaux: float = 0.0
    duree_souhaitee_annees: int = 25
    type_garantie: TypeGarantie = "caution"

    @property
    def cout_operation(self) -> float:
        return self.prix_bien + self.montant_travaux

    @property
    def part_travaux(self) -> float:
        return self.montant_travaux / self.cout_operation if self.cout_operation else 0.0


@dataclass
class Resultat:
    """Résultat d'un calcul, avec la trace de ce qui l'a produit."""

    valeurs: dict[str, float] = field(default_factory=dict)
    details: dict[str, float] = field(default_factory=dict)
    messages: list[str] = field(default_factory=list)

    def __getitem__(self, cle: str) -> float:
        return self.valeurs[cle]
