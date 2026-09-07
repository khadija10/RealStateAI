"""
Inspection des biens au nombre de pièces anormalement élevé.

Question à trancher : ces lignes sont-elles des biens réels très grands
(château, foyer, hôtel particulier) ou des erreurs de saisie ?

Le critère décisif est la surface par pièce. En dessous d'environ 8 m² par
pièce, le nombre de pièces déclaré est incohérent avec la surface.
"""

from __future__ import annotations

import duckdb
import pandas as pd

GOLD = "data/processed/gold_transactions/**/*.parquet"

pd.set_option("display.width", 200)

con = duckdb.connect()
con.execute(f"CREATE VIEW gold AS SELECT * FROM read_parquet('{GOLD}', hive_partitioning=true);")

print("\n=== Les biens de plus de 20 pièces ===")
print(con.execute("""
    SELECT nom_commune, code_departement AS dep, type_local,
           nb_pieces, surface_bati,
           round(surface_bati / nb_pieces, 1) AS m2_par_piece,
           valeur_fonciere, round(prix_m2) AS prix_m2, date_mutation
    FROM gold WHERE nb_pieces > 20
    ORDER BY nb_pieces DESC
""").df().to_string(index=False))

print("\n=== Combien de lignes sous 8 m² par pièce (toutes tailles) ? ===")
print(con.execute("""
    SELECT count(*) AS incoherentes,
           round(100.0 * count(*) / (SELECT count(*) FROM gold), 4) AS pct
    FROM gold
    WHERE nb_pieces > 0 AND surface_bati / nb_pieces < 8
""").df().to_string(index=False))

print("\n=== Exemples de ces lignes incohérentes ===")
print(con.execute("""
    SELECT nom_commune, type_local, nb_pieces, surface_bati,
           round(surface_bati / nb_pieces, 1) AS m2_par_piece, valeur_fonciere
    FROM gold
    WHERE nb_pieces > 0 AND surface_bati / nb_pieces < 8
    ORDER BY surface_bati / nb_pieces LIMIT 12
""").df().to_string(index=False))

print("\nLecture :")
print("  m2_par_piece plausible (>= 8) -> biens réels, il suffit d'élargir")
print("  la borne du schéma.")
print("  m2_par_piece absurde (< 8)    -> erreur de saisie, on ajoute une")
print("  règle de cohérence surface / nombre de pièces.\n")
