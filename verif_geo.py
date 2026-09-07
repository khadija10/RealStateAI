"""
Diagnostic des coordonnées géographiques hors de France.

Le contrôle qualité a signalé des latitudes aberrantes. Avant de décider quoi
en faire, il faut savoir D'OÙ elles viennent :

  - erreur de la source Etalab -> on filtre, et on le documente ;
  - décalage de colonnes à la lecture -> le problème dépasse la géolocalisation
    et d'autres champs de ces lignes sont faux aussi ;
  - inversion latitude/longitude -> on peut corriger au lieu de supprimer.

Ce script tranche entre ces hypothèses.

Usage, depuis C:\\realstate :
    .\\.venv\\Scripts\\python.exe verif_geo.py
"""

from __future__ import annotations

import duckdb
import pandas as pd

GOLD = "data/processed/gold_transactions/**/*.parquet"
RAW = "data/raw/dvf_*.csv.gz"

# Bornes de la France métropolitaine.
LAT_MIN, LAT_MAX = 41.0, 51.5
LON_MIN, LON_MAX = -5.5, 9.8

pd.set_option("display.width", 220)
pd.set_option("display.max_columns", 40)

con = duckdb.connect()
con.execute("SET memory_limit='4GB'")
con.execute(f"""
    CREATE VIEW gold AS
    SELECT * FROM read_parquet('{GOLD}', hive_partitioning=true);
""")


def titre(texte: str) -> None:
    print("\n" + "=" * 90)
    print(texte)
    print("=" * 90)


titre("1. VOLUMÉTRIE DES COORDONNÉES ABERRANTES")
print(con.execute(f"""
    SELECT
        count(*)                                                        AS total,
        count(*) FILTER (WHERE latitude  NOT BETWEEN {LAT_MIN} AND {LAT_MAX}) AS lat_hors_france,
        count(*) FILTER (WHERE longitude NOT BETWEEN {LON_MIN} AND {LON_MAX}) AS lon_hors_france
    FROM gold
""").df().to_string(index=False))

titre("2. RÉPARTITION PAR DÉPARTEMENT ET COMMUNE")
print(con.execute(f"""
    SELECT code_departement AS dep, nom_commune, count(*) AS n,
           round(min(latitude), 4) AS lat_min, round(max(latitude), 4) AS lat_max,
           round(min(longitude), 4) AS lon_min, round(max(longitude), 4) AS lon_max
    FROM gold
    WHERE latitude NOT BETWEEN {LAT_MIN} AND {LAT_MAX}
       OR longitude NOT BETWEEN {LON_MIN} AND {LON_MAX}
    GROUP BY 1, 2 ORDER BY n DESC LIMIT 15
""").df().to_string(index=False))

print("\nLecture : si les anomalies sont concentrées sur quelques communes,")
print("c'est un problème de source. Si elles sont éparpillées partout,")
print("c'est plutôt un problème de lecture de fichier.")

titre("3. CES LIGNES SONT-ELLES COHÉRENTES PAR AILLEURS ?")
# Si le reste des champs est plausible, la ligne n'est pas décalée : seule la
# coordonnée est fausse. Si surface et prix sont eux aussi absurdes, c'est un
# décalage de colonnes et le problème est bien plus large.
print(con.execute(f"""
    SELECT nom_commune, code_commune, type_local, surface_bati, nb_pieces,
           valeur_fonciere, round(prix_m2) AS prix_m2,
           round(latitude, 4) AS latitude, round(longitude, 4) AS longitude
    FROM gold
    WHERE latitude NOT BETWEEN {LAT_MIN} AND {LAT_MAX}
       OR longitude NOT BETWEEN {LON_MIN} AND {LON_MAX}
    ORDER BY latitude DESC LIMIT 12
""").df().to_string(index=False))

print("\nLecture : commune, surface et prix plausibles -> seule la coordonnée")
print("est fausse. Tout est absurde -> décalage de colonnes à la lecture.")

titre("4. HYPOTHÈSE D'INVERSION LATITUDE / LONGITUDE")
# Si en échangeant les deux valeurs la coordonnée redevient valide,
# l'inversion est confirmée et la correction est triviale.
print(con.execute(f"""
    SELECT
        count(*) AS aberrantes,
        count(*) FILTER (
            WHERE longitude BETWEEN {LAT_MIN} AND {LAT_MAX}
              AND latitude  BETWEEN {LON_MIN} AND {LON_MAX}
        ) AS valides_si_on_inverse
    FROM gold
    WHERE latitude NOT BETWEEN {LAT_MIN} AND {LAT_MAX}
       OR longitude NOT BETWEEN {LON_MIN} AND {LON_MAX}
""").df().to_string(index=False))

titre("5. REMONTÉE À LA SOURCE BRUTE")
# On vérifie si l'anomalie existe déjà dans le fichier téléchargé : si oui,
# le pipeline n'y est pour rien.
try:
    con.execute(f"""
        CREATE VIEW brut AS
        SELECT * FROM read_csv('{RAW}', all_varchar=true, union_by_name=true);
    """)
    print(con.execute(f"""
        SELECT count(*) AS lignes_brutes_hors_france
        FROM brut
        WHERE TRY_CAST(latitude AS DOUBLE) IS NOT NULL
          AND TRY_CAST(latitude AS DOUBLE) NOT BETWEEN {LAT_MIN} AND {LAT_MAX}
    """).df().to_string(index=False))

    print("\nExemples de lignes brutes concernées :")
    print(con.execute(f"""
        SELECT id_mutation, nom_commune, adresse_nom_voie, id_parcelle,
               latitude, longitude
        FROM brut
        WHERE TRY_CAST(latitude AS DOUBLE) IS NOT NULL
          AND TRY_CAST(latitude AS DOUBLE) NOT BETWEEN {LAT_MIN} AND {LAT_MAX}
        LIMIT 8
    """).df().to_string(index=False))
    print("\nLecture : si ces lignes existent déjà telles quelles dans le brut,")
    print("l'anomalie vient d'Etalab et non du pipeline.")
except Exception as err:
    print(f"Lecture du brut impossible ({err}). Passe cette section.")

titre("FIN DU DIAGNOSTIC")
