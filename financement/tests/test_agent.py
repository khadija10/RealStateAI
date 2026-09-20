"""
Tests de l'agent — SANS clé API ni appel réseau.

On injecte un faux client qui rejoue une séquence de réponses prédéfinie.
Cela permet de vérifier toute la mécanique de la boucle de function calling :
enchaînement des appels, format des messages, garde-fou d'itérations.

C'est aussi ce qui rend l'agent testable en intégration continue, où aucune
clé n'est disponible.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Any

from realstate_financement.agent import MAX_ITERATIONS, Agent


# --- Faux client, imitant la structure de réponse de l'API ------------------

@dataclass
class FauxAppel:
    id: str
    function: Any


@dataclass
class FausseFonction:
    name: str
    arguments: str


@dataclass
class FauxMessage:
    content: str | None = None
    tool_calls: list | None = None


@dataclass
class FauxChoix:
    message: FauxMessage


@dataclass
class FausseReponse:
    choices: list


@dataclass
class FauxClient:
    """Rejoue une liste de réponses préparées et enregistre les requêtes."""

    reponses: list = field(default_factory=list)
    requetes: list = field(default_factory=list)

    @property
    def chat(self):
        return self

    @property
    def completions(self):
        return self

    def create(self, **kwargs):
        self.requetes.append(kwargs)
        return self.reponses.pop(0)


def appel_outil(nom: str, arguments: dict, identifiant: str = "call_1") -> FauxAppel:
    return FauxAppel(id=identifiant,
                     function=FausseFonction(name=nom, arguments=json.dumps(arguments)))


# --- Tests ------------------------------------------------------------------

def test_reponse_directe_sans_outil():
    """Une question générale ne doit pas déclencher d'appel d'outil."""
    client = FauxClient(reponses=[
        FausseReponse([FauxChoix(FauxMessage(content="Bonjour, quels sont vos revenus ?"))])
    ])
    agent = Agent(client=client, modele="test")
    assert "revenus" in agent.repondre("Bonjour")
    assert agent.journal_outils == []


def test_boucle_appelle_l_outil_et_renvoie_le_resultat():
    """Séquence complète : le modèle demande un outil, puis conclut."""
    client = FauxClient(reponses=[
        FausseReponse([FauxChoix(FauxMessage(tool_calls=[
            appel_outil("calculer_capacite_emprunt",
                        {"revenus_nets_mensuels": 4000, "duree_annees": 25})
        ]))]),
        FausseReponse([FauxChoix(FauxMessage(content="Vous pouvez emprunter environ 270 000 €."))]),
    ])
    agent = Agent(client=client, modele="test")
    reponse = agent.repondre("Combien puis-je emprunter avec 4000 € par mois ?")

    assert "270 000" in reponse
    assert agent.journal_outils[0]["outil"] == "calculer_capacite_emprunt"
    assert not agent.journal_outils[0]["erreur"]


def test_le_resultat_de_l_outil_est_transmis_au_modele():
    """
    Vérifie le contrat de la boucle : le message assistant portant les
    tool_calls doit précéder le message tool, sinon l'API rejette la requête.
    """
    client = FauxClient(reponses=[
        FausseReponse([FauxChoix(FauxMessage(tool_calls=[
            appel_outil("estimer_frais_acquisition",
                        {"prix_bien": 300000, "departement": "93"})
        ]))]),
        FausseReponse([FauxChoix(FauxMessage(content="Environ 22 000 € de frais."))]),
    ])
    agent = Agent(client=client, modele="test")
    agent.repondre("Combien de frais pour 300 000 € dans le 93 ?")

    roles = [m["role"] for m in agent.historique]
    assert roles.index("assistant") < roles.index("tool")

    message_outil = next(m for m in agent.historique if m["role"] == "tool")
    charge = json.loads(message_outil["content"])
    assert charge["total_frais_acquisition"] > 0


def test_erreur_d_outil_transmise_au_modele_sans_planter():
    """Argument manquant : l'agent poursuit et le modèle peut se rattraper."""
    client = FauxClient(reponses=[
        FausseReponse([FauxChoix(FauxMessage(tool_calls=[
            appel_outil("analyser_projet", {"revenus_nets_mensuels": 4000})
        ]))]),
        FausseReponse([FauxChoix(FauxMessage(content="Quel est le prix du bien ?"))]),
    ])
    agent = Agent(client=client, modele="test")
    reponse = agent.repondre("Ce bien est-il finançable ?")

    assert agent.journal_outils[0]["erreur"] is True
    assert "prix" in reponse.lower()


def test_plusieurs_outils_dans_un_meme_tour():
    """Le modèle peut demander deux outils en parallèle."""
    client = FauxClient(reponses=[
        FausseReponse([FauxChoix(FauxMessage(tool_calls=[
            appel_outil("calculer_capacite_emprunt",
                        {"revenus_nets_mensuels": 4000}, "call_1"),
            appel_outil("estimer_frais_acquisition",
                        {"prix_bien": 250000, "departement": "75"}, "call_2"),
        ]))]),
        FausseReponse([FauxChoix(FauxMessage(content="Voici la synthèse."))]),
    ])
    agent = Agent(client=client, modele="test")
    agent.repondre("Capacité et frais ?")

    assert len(agent.journal_outils) == 2
    assert sum(1 for m in agent.historique if m["role"] == "tool") == 2


def test_garde_fou_contre_la_boucle_infinie():
    """Un modèle qui rappellerait indéfiniment un outil doit être arrêté."""
    boucle = FausseReponse([FauxChoix(FauxMessage(tool_calls=[
        appel_outil("calculer_capacite_emprunt", {"revenus_nets_mensuels": 4000})
    ]))])
    client = FauxClient(reponses=[boucle] * (MAX_ITERATIONS + 2))
    agent = Agent(client=client, modele="test")
    reponse = agent.repondre("Boucle")

    assert "reformuler" in reponse.lower()
    assert len(agent.journal_outils) == MAX_ITERATIONS


def test_les_outils_sont_transmis_a_chaque_requete():
    client = FauxClient(reponses=[
        FausseReponse([FauxChoix(FauxMessage(content="ok"))])
    ])
    agent = Agent(client=client, modele="test")
    agent.repondre("Bonjour")
    # Le nombre d'outils évolue : on vérifie qu'ils sont tous transmis.
    from realstate_financement.outils import OUTILS

    assert len(client.requetes[0]["tools"]) == len(OUTILS)


def test_reinitialisation_vide_l_historique():
    client = FauxClient(reponses=[
        FausseReponse([FauxChoix(FauxMessage(content="ok"))])
    ])
    agent = Agent(client=client, modele="test")
    agent.repondre("Bonjour")
    agent.reinitialiser()
    assert len(agent.historique) == 1
    assert agent.historique[0]["role"] == "system"
