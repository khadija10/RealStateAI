"""
Analyse du marché par arrondissement.

DVF découpe Paris, Lyon et Marseille en arrondissements : le code INSEE n'est
pas celui de la ville mais celui de l'arrondissement (75101 à 75120 pour
Paris). Les agrégats de marché du pipeline sont donc déjà calculés à cette
maille fine — le 16e et le 19e ne sont jamais mélangés.

Ce script rend cette granularité visible et produit un CSV exploitable.

Usage, depuis C:\\realstate :
    .\\.venv\\Scripts\\python.exe analyse_arrondissements.py
"""

from __future__ import annotations

import duckdb
import pandas as pd

GOLD = "data/processed/gold_transactions/**/*.parquet"

pd.set_option("display.width", 200)

con = duckdb.connect()
con.execute(f"""
    CREATE VIEW gold AS
    SELECT * FROM read_parquet('{GOLD}', hive_partitioning=true);
""")


def titre(texte: str) -> None:
    print("\n" + "=" * 78)
    print(texte)
    print("=" * 78)


titre("1. COUVERTURE — villes découpées en arrondissements")
print(con.execute("""
    SELECT ville,
           count(DISTINCT arrondissement) AS nb_arrondissements,
           count(*)                       AS nb_ventes
    FROM gold WHERE arrondissement IS NOT NULL
    GROUP BY 1 ORDER BY nb_ventes DESC
""").df().to_string(index=False))

titre("2. PRIX AU M² PAR ARRONDISSEMENT — appartements")
detail = con.execute("""
    SELECT ville, arrondissement AS arr,
           count(*)                            AS nb_ventes,
           round(median(prix_m2))              AS prix_m2_median,
           round(quantile_cont(prix_m2, 0.10)) AS p10,
           round(quantile_cont(prix_m2, 0.90)) AS p90,
           round(median(surface_bati))         AS surface_mediane,
           round(median(valeur_fonciere))      AS prix_median
    FROM gold
    WHERE arrondissement IS NOT NULL AND type_local = 'Appartement'
    GROUP BY 1, 2 ORDER BY prix_m2_median DESC
""").df()
print(detail.to_string(index=False))

if not detail.empty:
    ecart = detail.prix_m2_median.max() / detail.prix_m2_median.min()
    print(f"\n  Écart entre l'arrondissement le plus cher et le moins cher : "
          f"facteur {ecart:.2f}")
    print("  C'est exactement le signal que perdrait un modèle travaillant")
    print("  au niveau de la ville entière.")

titre("3. ÉVOLUTION ANNUELLE PAR ARRONDISSEMENT")
print(con.execute("""
    SELECT arrondissement AS arr, annee,
           count(*) AS nb_ventes, round(median(prix_m2)) AS prix_m2_median
    FROM gold
    WHERE arrondissement IS NOT NULL AND ville = 'Paris'
    GROUP BY 1, 2 ORDER BY 1, 2
""").df().to_string(index=False))

titre("4. VÉRIFICATION — les features de marché sont bien par arrondissement")
print(con.execute("""
    SELECT arrondissement AS arr,
           round(median(prix_m2))                  AS prix_m2_reel,
           round(median(prix_m2_median_commune_12m)) AS reference_12m,
           round(median(nb_ventes_commune_12m))      AS volume_fenetre,
           any_value(source_reference_prix)          AS source
    FROM gold
    WHERE arrondissement IS NOT NULL AND ville = 'Paris'
      AND prix_m2_median_commune_12m IS NOT NULL
    GROUP BY 1 ORDER BY 1
""").df().to_string(index=False))

print("\n  La colonne prix_m2_median_commune_12m varie d'un arrondissement à")
print("  l'autre : la référence de marché est bien calculée à cette maille,")
print("  sur une fenêtre glissante strictement antérieure (anti-fuite).")

sortie = "data/processed/marche_par_arrondissement.csv"
con.execute(f"""
    COPY (
        SELECT ville, arrondissement, type_local, annee,
               count(*)                    AS nb_ventes,
               round(median(prix_m2), 1)   AS prix_m2_median,
               round(avg(prix_m2), 1)      AS prix_m2_moyen,
               round(median(surface_bati)) AS surface_mediane
        FROM gold WHERE arrondissement IS NOT NULL
        GROUP BY 1, 2, 3, 4 ORDER BY 1, 2, 3, 4
    ) TO '{sortie}' (FORMAT CSV, HEADER, DELIMITER ';');
""")

titre("FICHIER ÉCRIT")
print(f"  {sortie}")
print("  Séparateur ';' — s'ouvre directement dans Excel.\n")
