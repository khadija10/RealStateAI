"""
Orchestrateur du pipeline : bronze -> silver -> gold.

Usage :
    python -m realstate_data.pipeline ingest      # téléchargement DVF
    python -m realstate_data.pipeline silver      # nettoyage + déduplication
    python -m realstate_data.pipeline gold        # features ML-ready
    python -m realstate_data.pipeline qualite     # contrôles qualité (schéma + seuils)
    python -m realstate_data.pipeline run         # les trois d'affilée
    python -m realstate_data.pipeline rapport     # journal de perte lisible
"""

from __future__ import annotations

import argparse
import json
import sys

from realstate_data.cleaning.silver import construire_silver
from realstate_data.config import charger_settings
from realstate_data.features.gold import construire_gold
from realstate_data.ingestion.dvf_downloader import ingerer
from realstate_data.quality.validators import afficher, valider
from realstate_data.logging_conf import configurer_logging

log = configurer_logging()


def afficher_rapport(settings=None) -> None:
    """
    Affiche le journal de perte en tableau Markdown.

    Ce tableau répond directement à la question de soutenance
    « combien de lignes avez-vous perdues, et pourquoi ? ».
    """
    settings = settings or charger_settings()
    chemin = settings.chemins.interim / "rapport_silver.json"
    if not chemin.exists():
        log.error("Aucun rapport. Lance d'abord : python -m realstate_data.pipeline silver")
        return

    rapport = json.loads(chemin.read_text(encoding="utf-8"))
    print("\n| Étape | Lignes | Mutations | % mutations restantes | Perte à l'étape |")
    print("|---|---:|---:|---:|---:|")
    for e in rapport["etapes"]:
        print(f"| {e['etape']} | {e['lignes']:,} | {e['mutations']:,} | "
              f"{e['part_mutations_restantes']:.1%} | {e['perte_a_cette_etape']:.1%} |"
              .replace(",", " "))
    print(f"\nTaux de conservation global : {rapport['taux_conservation_mutations']:.1%}")


def main(argv: list[str] | None = None) -> int:
    parseur = argparse.ArgumentParser(description="Pipeline data DVF — RealStateAI")
    parseur.add_argument(
        "commande",
        choices=["ingest", "silver", "gold", "qualite", "run", "rapport"],
        help="étape à exécuter",
    )
    args = parseur.parse_args(argv)
    settings = charger_settings()

    log.info("Périmètre : %s | millésimes %s",
             ", ".join(settings.departements),
             ", ".join(map(str, settings.millesimes)))

    if args.commande in ("ingest", "run"):
        ingerer(settings)
    if args.commande in ("silver", "run"):
        construire_silver(settings)
    if args.commande in ("gold", "run"):
        rapport = construire_gold(settings)
        log.info("Dataset gold : %d lignes", rapport["lignes_gold"])
    if args.commande in ("rapport", "run"):
        afficher_rapport(settings)
    if args.commande in ("qualite", "run"):
        rapport = valider(settings)
        afficher(rapport)
        # Code de sortie non nul : la CI échoue si la qualité se dégrade.
        if not rapport.succes:
            return 1

    return 0


if __name__ == "__main__":
    sys.exit(main())
