"""
Orchestrateur du pipeline : bronze -> silver -> gold.

Usage :
    python -m realstate_data.pipeline ingest      # téléchargement DVF
    python -m realstate_data.pipeline silver      # nettoyage + déduplication
    python -m realstate_data.pipeline gold        # features ML-ready
    python -m realstate_data.pipeline qualite     # contrôles qualité (schéma + seuils)
    python -m realstate_data.pipeline dpe-test    # vérifie l'API ADEME (quelques lignes)
    python -m realstate_data.pipeline dpe         # télécharge les DPE du périmètre
    python -m realstate_data.pipeline iris-diagnostic  # vérifie le format des sources IRIS/INSEE
    python -m realstate_data.pipeline iris        # télécharge contours + statistiques IRIS
    python -m realstate_data.pipeline bdnb        # télécharge et agrège la BDNB par parcelle
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
        "--departements", nargs="+", metavar="DEP",
        help="restreint la commande à ces départements, ex. --departements 75 92. "
             "Utile pour le téléchargement DPE, long sur tout un périmètre.")
    parseur.add_argument(
        "commande",
        choices=["ingest", "silver", "gold", "qualite", "run", "rapport",
                 "dpe", "dpe-test", "dpe-diagnostic",
                 "iris", "iris-diagnostic", "bdnb"],
        help="étape à exécuter",
    )
    args = parseur.parse_args(argv)
    settings = charger_settings()

    log.info("Périmètre : %s | millésimes %s",
             ", ".join(settings.departements),
             ", ".join(map(str, settings.millesimes)))

    if args.commande in ("ingest", "run"):
        ingerer(settings)
    if args.commande == "dpe-diagnostic":
        from realstate_data.enrichment.dpe import diagnostic_api

        print("\nFormes de requête acceptées par l'API ADEME :\n")
        print(f"{'Variante':<26} {'Statut':>7} {'Total':>12}  Surface  Message")
        print("-" * 86)
        for r in diagnostic_api(settings):
            total = f"{r['total']:,}".replace(",", " ") if r["total"] else "-"
            surface = "oui" if r["surface_presente"] else "-"
            print(f"{r['variante']:<26} {str(r['statut']):>7} {total:>12}"
                  f"  {surface:>7}  {r['message']}")
        print("\nOn retiendra la forme la plus filtrante parmi celles en 200.\n")
        return 0
    if args.commande == "dpe-test":
        from realstate_data.enrichment.dpe import tester_api

        resultat = tester_api(settings)
        print(f"\nDPE disponibles en France : {resultat['total_dpe_france']:,}"
              .replace(",", " "))
        print(f"Dont département {resultat['departement_teste']} : "
              f"{resultat['dpe_dans_le_departement']:,}".replace(",", " "))
        print(f"Filtre effectivement appliqué : "
              f"{'oui' if resultat['filtre_effectif'] else 'NON — ne pas télécharger'}")
        print(f"\nChamps présents au schéma : "
              f"{', '.join(resultat['champs_attendus_presents'])}")
        if resultat["champs_attendus_absents"]:
            print(f"CHAMPS ABSENTS  : {', '.join(resultat['champs_attendus_absents'])}")
            print("-> Ils seront ignorés. Bloquant uniquement pour la surface.")
        else:
            print("Tous les champs attendus figurent au schéma.")
        print(f"Surface renseignée sur l'exemple : "
              f"{'oui' if resultat['surface_renseignee'] else 'NON — à investiguer'}")
        print("\nExemple de diagnostic (appartement du périmètre) :")
        for cle, valeur in resultat["exemple"].items():
            print(f"  {cle:<28} {valeur}")
        return 0
    if args.commande == "dpe":
        from realstate_data.enrichment.dpe import telecharger_dpe

        bilan = telecharger_dpe(settings, departements=args.departements)
        for departement, nombre in bilan.items():
            log.info("Département %s : %d diagnostics", departement, nombre)
        return 0
    if args.commande == "iris-diagnostic":
        from realstate_data.enrichment.iris import diagnostic_iris

        resultat = diagnostic_iris(settings)
        print("\nDiagnostic des sources IRIS/INSEE :\n")
        for source, infos in resultat.items():
            print(f"--- {source} ---")
            if "erreur" in infos:
                print(f"  ERREUR : {infos['erreur']}")
                continue
            for cle, valeur in infos.items():
                print(f"  {cle:<22} {valeur}")
        print("\nSi des colonnes manquent, adapte les URLs et noms de "
              "colonnes dans config/settings.yaml (section enrichissement.iris_*) "
              "avant de lancer 'pipeline iris'.\n")
        return 0
    if args.commande == "iris":
        from realstate_data.enrichment.iris import (
            telecharger_contours_iris,
            telecharger_filosofi,
            telecharger_logement,
        )

        telecharger_contours_iris(settings)
        telecharger_filosofi(settings)
        telecharger_logement(settings)
        log.info("Sources IRIS téléchargées. Relance 'pipeline gold' pour "
                 "les intégrer au dataset.")
        return 0
    if args.commande == "bdnb":
        from realstate_data.enrichment.bdnb import preparer_bdnb, telecharger_bdnb

        telecharger_bdnb(settings, departements=args.departements)
        preparer_bdnb(settings)
        log.info("BDNB prête. Relance 'pipeline gold' pour l'intégrer au dataset.")
        return 0
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
