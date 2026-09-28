"""
Interface conversationnelle en ligne de commande.

Usage :
    python chat.py            # conversation libre
    python chat.py --trace    # affiche les appels d'outils (utile en démo)

Commandes pendant la conversation :
    /outils   récapitule les outils appelés depuis le début
    /reset    repart d'une conversation vierge
    /quitter  termine
"""

from __future__ import annotations

import sys

from realstate_financement.agent import Agent

ACCUEIL = """
========================================================================
  RealStateAI — accompagnement au montage de dossier de prêt
========================================================================
  Décris ta situation en une phrase, par exemple :
    "On gagne 4200 net à deux, 45 000 d'apport, on vise le 93"

  Commandes : /outils   /reset   /quitter
========================================================================
"""


def main() -> int:
    afficher_trace = "--trace" in sys.argv
    print(ACCUEIL)

    agent = Agent(trace=print if afficher_trace else None)

    while True:
        try:
            message = input("\nVous > ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\nÀ bientôt.")
            return 0

        if not message:
            continue
        if message in ("/quitter", "/quit", "/exit"):
            print("À bientôt.")
            return 0
        if message == "/reset":
            agent.reinitialiser()
            print("Conversation réinitialisée.")
            continue
        if message == "/outils":
            if not agent.journal_outils:
                print("Aucun outil appelé pour l'instant.")
            for appel in agent.journal_outils:
                etat = "erreur" if appel["erreur"] else "ok"
                print(f"  {appel['outil']:<32} {etat}")
            continue

        try:
            print("\nConseiller > " + agent.repondre(message))
        except Exception as err:  # noqa: BLE001 - on ne veut pas perdre la session
            print(f"\n[erreur] {type(err).__name__} : {err}")
            print("La conversation continue, reformule ou réessaie.")

    return 0


if __name__ == "__main__":
    sys.exit(main())
