"""
Aperçu du dataset gold — pour regarder la donnée propre sans écrire une ligne
de code.

Affiche dans le terminal :
  - le nombre de lignes et de colonnes ;
  - les premières lignes ;
  - les statistiques de prix par département ;
  - le taux de valeurs manquantes par colonne.

Et écrit un extrait CSV ouvrable dans Excel ou LibreOffice.

Usage :
    python -m realstate_data.apercu
    python -m realstate_data.apercu --lignes 5000
"""

from __future__ import annotations

import argparse

import duckdb
import pandas as pd

from realstate_data.config import charger_settings


def apercu(n_lignes_csv: int = 2000) -> None:
    settings = charger_settings()
    dossier = settings.chemins.processed / "gold_transactions"
    motif = f"{dossier}/**/*.parquet"

    if not dossier.exists():
        print(f"Dataset introuvable : {dossier}\n"
              "Lance d'abord : make data")
        return

    con = duckdb.connect()
    # hive_partitioning : DuckDB reconstruit la colonne `annee` à partir du
    # nom des dossiers annee=YYYY.
    con.execute(
        f"CREATE VIEW gold AS "
        f"SELECT * FROM read_parquet('{motif}', hive_partitioning=true);"
    )

    pd.set_option("display.width", 200)
    pd.set_option("display.max_columns", 40)

    n_lignes, n_mutations = con.execute(
        "SELECT count(*), count(DISTINCT id_mutation) FROM gold"
    ).fetchone()
    colonnes = con.execute("DESCRIBE gold").df()

    print("\n" + "=" * 70)
    print(f"DATASET GOLD — {n_lignes:,} lignes, {len(colonnes)} colonnes".replace(",", " "))
    print("=" * 70)

    # Contrôle d'intégrité : la clé primaire doit être unique.
    if n_lignes == n_mutations:
        print(f"Clé primaire id_mutation : unique sur {n_mutations:,} mutations "
              "— déduplication OK".replace(",", " "))
    else:
        print(f"ALERTE : {n_lignes - n_mutations} doublons sur id_mutation")

    print("\n--- Premières lignes " + "-" * 49)
    print(con.execute("""
        SELECT date_mutation, nom_commune, type_local, surface_bati,
               nb_pieces, valeur_fonciere, round(prix_m2) AS prix_m2
        FROM gold ORDER BY date_mutation LIMIT 8
    """).df().to_string(index=False))

    print("\n--- Prix au m² par département et type de bien " + "-" * 23)
    print(con.execute("""
        SELECT code_departement AS dep, type_local,
               count(*)                        AS nb_ventes,
               round(median(prix_m2))          AS prix_m2_median,
               round(quantile_cont(prix_m2, 0.10)) AS p10,
               round(quantile_cont(prix_m2, 0.90)) AS p90,
               round(median(surface_bati))     AS surface_mediane
        FROM gold GROUP BY 1, 2 ORDER BY 1, 2
    """).df().to_string(index=False))

    print("\n--- Évolution annuelle " + "-" * 46)
    print(con.execute("""
        SELECT annee, count(*) AS nb_ventes,
               round(median(prix_m2)) AS prix_m2_median
        FROM gold GROUP BY 1 ORDER BY 1
    """).df().to_string(index=False))

    print("\n--- Valeurs manquantes " + "-" * 46)
    manquants = []
    for nom in colonnes["column_name"]:
        nuls = con.execute(f'SELECT count(*) FROM gold WHERE "{nom}" IS NULL').fetchone()[0]
        if nuls:
            manquants.append({"colonne": nom, "nuls": nuls,
                              "taux": f"{nuls / n_lignes:.1%}"})
    if manquants:
        print(pd.DataFrame(manquants).to_string(index=False))
        print("\nRappel : prix_m2_reference_12m est vide sur les 12 premiers mois "
              "d'historique.\nC'est attendu — aucune donnée antérieure n'existe "
              "pour alimenter la fenêtre glissante.")
    else:
        print("Aucune valeur manquante.")

    # --- Export CSV -------------------------------------------------------
    # Échantillon aléatoire mais reproductible (graine fixe) : représentatif
    # de tout le dataset, contrairement à un simple LIMIT qui ne montrerait
    # que les premières lignes du premier fichier.
    sortie = settings.chemins.processed / "apercu_gold.csv"
    con.execute(f"""
        COPY (SELECT * FROM gold USING SAMPLE {n_lignes_csv} ROWS (reservoir, 42))
        TO '{sortie}' (FORMAT CSV, HEADER, DELIMITER ';');
    """)
    print("\n" + "=" * 70)
    print(f"Extrait CSV écrit : {sortie}")
    print("Séparateur ';' — s'ouvre directement dans Excel en français.")
    print("=" * 70 + "\n")


def main() -> None:
    parseur = argparse.ArgumentParser(description="Aperçu du dataset gold")
    parseur.add_argument("--lignes", type=int, default=2000,
                         help="nombre de lignes de l'extrait CSV")
    args = parseur.parse_args()
    apercu(args.lignes)


if __name__ == "__main__":
    main()
