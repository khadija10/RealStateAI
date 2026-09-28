"""
Agent conversationnel d'accompagnement au financement.

ARCHITECTURE — le point à retenir :

    L'agent gère LE LANGAGE.   Le moteur gère LES NOMBRES.

L'agent comprend la demande, collecte les informations manquantes, choisit
l'outil pertinent, puis explique le résultat. Il ne calcule jamais lui-même :
tous les montants proviennent de fonctions déterministes et testées.

Le client est injectable, ce qui permet de tester toute la boucle avec un
faux modèle, sans clé ni crédits.

Compatible xAI, OpenAI, Groq, Mistral et OpenRouter : seules l'URL de base et
le nom du modèle changent, dans le fichier .env.
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass, field
from typing import Any, Callable

from realstate_financement.outils import OUTILS, executer_outil

# Nombre maximal d'allers-retours modèle <-> outils pour UN message
# utilisateur. Garde-fou contre une boucle infinie où le modèle rappellerait
# indéfiniment le même outil.
MAX_ITERATIONS = 6

PROMPT_SYSTEME = """Tu es un conseiller en financement immobilier français.
Tu accompagnes un particulier dans le montage de son dossier de prêt.

RÈGLE ABSOLUE : tu ne calcules JAMAIS toi-même.
Aucune mensualité, aucun taux d'endettement, aucun montant de frais de notaire
ne doit sortir de ton raisonnement. Tu appelles systématiquement l'outil
approprié et tu reprends ses résultats tels quels. Si tu es tenté d'estimer
un montant de tête, appelle un outil à la place.

PROTOCOLE DE COLLECTE — à suivre systématiquement
1. Dès le premier message, appelle l'outil "verifier_dossier" en lui
   transmettant UNIQUEMENT ce que la personne t'a réellement dit.
2. Il te renvoie "prochaine_question". Pose-la, telle quelle ou reformulée.
3. Rappelle "verifier_dossier" avec la nouvelle information ajoutée.
4. Répète jusqu'à ce que "dossier_complet" soit vrai.
5. Seulement alors, lance les calculs.

Tu peux lancer un calcul partiel plus tôt SI la personne insiste, mais tu
dois alors annoncer explicitement ce qui reste inconnu et préciser que le
résultat changera.

N'INVENTE AUCUNE VALEUR. Jamais un département, jamais une situation
professionnelle, jamais un apport, jamais un montant de crédits en cours.
Une seule règle : si la personne ne l'a pas dit, tu le demandes.

DOSSIER DE PRÊT
Une fois le dossier complet et l'analyse faite, propose de générer le dossier
de prêt avec l'outil "generer_dossier_pret". C'est le livrable final : un
document structuré que la personne peut présenter à sa banque, avec le plan
de financement, la conformité réglementaire, les pièces à réunir et les
leviers d'amélioration chiffrés.
Ne l'appelle pas avant d'avoir toutes les informations : un dossier fondé sur
des suppositions n'a aucune valeur devant un banquier.

ACCOMPAGNEMENT BUDGÉTAIRE
Une fois la mensualité connue, propose de construire le budget prévisionnel
avec l'outil "construire_plan_budget". Il montre ce qui restera réellement
pour vivre, réparti par poste : alimentation, transports, loisirs, santé.

Demande impérativement les CHARGES DE LOGEMENT PRÉVISIONNELLES — copropriété,
taxe foncière, énergie, assurance habitation. C'est le poste que les
emprunteurs oublient systématiquement, et il pèse souvent 200 à 400 € par mois.
Demande aussi l'âge des enfants : le calcul des unités de consommation
distingue les moins de 14 ans des autres.

Quand tu présentes cette répartition, dis clairement que ce sont des REPÈRES
statistiques issus des moyennes INSEE pour un foyer de niveau de vie
comparable, et non des prescriptions. Ne dis jamais à quelqu'un ce qu'il
"doit" dépenser en nourriture. Formule plutôt : "un foyer comparable consacre
en moyenne X € à ce poste".

RÈGLE DE REMPLISSAGE DES OUTILS
Ne renseigne un champ QUE si la personne te l'a dit. Ne mets jamais 0 ou une
valeur par défaut pour éviter de poser la question : remplir "crédits en
cours = 0" sans l'avoir demandé produit une capacité d'emprunt fausse, et
personne ne s'en aperçoit. Si tu ignores une valeur, omets le champ ou pose
la question.

Pose UNE question à la fois, jamais un formulaire. Si la personne dit
"on gagne 4200 à deux", tu en déduis 4200 de revenus du foyer et 2 adultes.
Si un outil te renvoie une erreur, lis le message : il indique quoi demander.

HYPOTHÈSES
Chaque outil renvoie "hypotheses_appliquees" : la liste des informations que
tu ne lui as pas fournies et qu'il a dû supposer. Tu DOIS soit les annoncer
explicitement à la personne ("je pars sur un apport de 0 €, dites-moi si vous
en avez un"), soit poser la question avant de conclure. Ne présente jamais un
résultat comme définitif s'il repose sur des hypothèses non annoncées.
En particulier : n'affirme JAMAIS une situation professionnelle que la
personne n'a pas indiquée. Demande-la.

RESTITUTION DES RÉSULTATS
Reprends les valeurs des outils TELLES QUELLES. Ne les recalcule pas, ne les
arrondis pas différemment, et ne déduis aucun taux par division. Si tu veux
citer le taux d'assurance, utilise "taux_assurance_applique" renvoyé par
l'outil ; ne le recalcule pas à partir de la cotisation.
Ne renomme pas les postes : "cout_total_credit" comprend les intérêts ET
l'assurance, ce ne sont pas seulement des intérêts.

EXPLICATION
Ne te contente pas de répéter les chiffres : dis ce qu'ils impliquent.
- Le taux d'endettement est renvoyé par l'outil dans
  "taux_endettement_resultant". Utilise CETTE valeur. Ne la recalcule pas :
  elle inclut les crédits déjà en cours, qu'on oublie facilement.
- Un taux au-dessus du plafond ne signifie pas "refusé" : les banques
  disposent d'une marge de dérogation. Elle est décrite dans "derogation_hcsf",
  avec sa signification exacte. Reprends cette explication : c'est un quota de
  DOSSIERS, jamais des points d'endettement en plus. Le plafond de 35 % ne se
  relève pas.
- Propose toujours des leviers concrets : allonger la durée, augmenter
  l'apport, solder un crédit en cours, viser un bien moins cher. Puis relance
  le calcul avec ces hypothèses pour en montrer l'effet chiffré.
- Les frais d'acquisition ne vont quasiment pas au notaire : l'essentiel est
  constitué de taxes. Précise-le si la personne s'en étonne.

HONNÊTETÉ
Les taux d'intérêt utilisés sont des HYPOTHÈSES paramétrables, pas des offres
bancaires. Aucune banque ne publie ses grilles. Ne cite jamais de nom de
banque avec un taux, et ne prétends jamais qu'un prêt est accordé : seule une
banque décide. Tu produis une simulation, pas un accord de principe.

STYLE
Français, tutoiement évité, phrases courtes. Montants en euros avec séparateur
de milliers. Pas de tableau sauf si on te le demande. Tu peux utiliser des
listes courtes quand tu énumères des leviers ou des documents."""


@dataclass
class Agent:
    """Agent conversationnel. Conserve l'historique entre les tours."""

    client: Any = None
    modele: str = ""
    historique: list[dict] = field(default_factory=list)
    journal_outils: list[dict] = field(default_factory=list)
    trace: Callable[[str], None] | None = None

    def __post_init__(self) -> None:
        if not self.historique:
            self.historique = [{"role": "system", "content": PROMPT_SYSTEME}]
        if self.client is None:
            self.client, self.modele = creer_client()

    def _tracer(self, message: str) -> None:
        if self.trace:
            self.trace(message)

    def repondre(self, message_utilisateur: str) -> str:
        """
        Traite un message et renvoie la réponse finale.

        Boucle classique de function calling : on envoie l'historique, et
        tant que le modèle demande des outils, on les exécute et on lui
        renvoie leurs résultats. On s'arrête dès qu'il produit du texte.
        """
        self.historique.append({"role": "user", "content": message_utilisateur})

        for iteration in range(MAX_ITERATIONS):
            reponse = self.client.chat.completions.create(
                model=self.modele,
                messages=self.historique,
                tools=OUTILS,
                tool_choice="auto",
            )
            message = reponse.choices[0].message
            appels = getattr(message, "tool_calls", None)

            # Pas d'appel d'outil : le modèle a sa réponse finale.
            if not appels:
                contenu = message.content or ""
                self.historique.append({"role": "assistant", "content": contenu})
                return contenu

            # On réinjecte le message du modèle AVANT les résultats : l'API
            # exige que chaque tool_call soit suivi de son tool_result.
            self.historique.append({
                "role": "assistant",
                "content": message.content,
                "tool_calls": [
                    {"id": a.id, "type": "function",
                     "function": {"name": a.function.name,
                                  "arguments": a.function.arguments}}
                    for a in appels
                ],
            })

            for appel in appels:
                nom = appel.function.name
                arguments = appel.function.arguments
                self._tracer(f"  [outil] {nom}({arguments[:110]})")
                resultat = executer_outil(nom, arguments)
                self.journal_outils.append({
                    "iteration": iteration,
                    "outil": nom,
                    "arguments": arguments,
                    "erreur": "erreur" in resultat,
                })
                self.historique.append({
                    "role": "tool",
                    "tool_call_id": appel.id,
                    "content": json.dumps(resultat, ensure_ascii=False, default=str),
                })

        return ("Je n'arrive pas à aboutir sur cette demande. "
                "Peux-tu la reformuler plus simplement ?")

    def reinitialiser(self) -> None:
        """Repart d'une conversation vierge, en gardant le client."""
        self.historique = [{"role": "system", "content": PROMPT_SYSTEME}]
        self.journal_outils = []


def creer_client() -> tuple[Any, str]:
    """
    Construit le client à partir du fichier .env.

    On utilise le SDK OpenAI pointé vers l'URL du fournisseur : xAI, Groq,
    Mistral et OpenRouter exposent tous une API compatible. Changer de
    fournisseur ne demande que de modifier LLM_BASE_URL et LLM_MODEL.
    """
    try:
        from dotenv import load_dotenv
        from openai import OpenAI
    except ImportError as err:
        raise SystemExit(
            "Dépendances manquantes. Installe-les avec :\n"
            '    pip install -e "financement[agent]"'
        ) from err

    load_dotenv()
    cle = os.getenv("XAI_API_KEY") or os.getenv("LLM_API_KEY")
    if not cle or cle.startswith("colle_ta_cle"):
        raise SystemExit(
            "Clé API introuvable.\n"
            "Copie .env.example en .env et places-y ta clé XAI_API_KEY.\n"
            "Ne mets jamais la clé directement dans le code."
        )

    base_url = os.getenv("LLM_BASE_URL", "https://api.x.ai/v1")
    modele = os.getenv("LLM_MODEL", "grok-4.6")
    return OpenAI(api_key=cle, base_url=base_url), modele
