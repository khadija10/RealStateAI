"""
Validation croisée : la qualité de l'appariement explique-t-elle la décote ?

RAISONNEMENT
Si l'étiquette DPE influence réellement le prix, l'effet doit être PLUS NET
sur les appariements les plus fiables. Un appariement dont la surface colle
au mètre près a de fortes chances d'être le bon logement ; un appariement à
9 % d'écart peut être le voisin de palier, donc porter une étiquette qui n'a
rien à voir avec le bien vendu.

Deux issues possibles :
  - la décote se renforce quand l'écart de surface diminue -> l'effet est
    réel, et la méthode d'appariement fonctionne ;
  - la décote est identique quel que soit l'écart -> ce qu'on mesure ne vient
    probablement pas du DPE du bien lui-même.

C'est un test de cohérence interne : il ne demande aucune donnée
supplémentaire et il se retourne contre l'hypothèse s'il le faut.

Usage, depuis C:\\realstate :
    .\\.venv\\Scripts\\python.exe test_decote.py
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


titre("0. NEUF CONTRE ANCIEN — le facteur qui brouille tout")
print("  Un logement neuf (VEFA) est classé A, B ou C par construction ET se")
print("  vend avec une prime de neuf. Mélanger neuf et ancien attribue donc à")
print("  l'étiquette énergie un effet qui vient en réalité de l'ancienneté.\n")
print(con.execute("""
    SELECT CASE WHEN est_vefa THEN 'neuf (VEFA)' ELSE 'ancien' END AS marche,
           dpe_classe AS classe, count(*) AS ventes,
           round(median(100 * prix_m2 / prix_m2_reference_12m), 1) AS indice
    FROM gold
    WHERE dpe_classe IS NOT NULL AND prix_m2_reference_12m IS NOT NULL
    GROUP BY 1, 2 ORDER BY 1, 2
""").df().to_string(index=False))

print("\n  Répartition des étiquettes selon le marché :")
print(con.execute("""
    SELECT CASE WHEN est_vefa THEN 'neuf (VEFA)' ELSE 'ancien' END AS marche,
           round(100.0 * count(*) FILTER (WHERE dpe_classe IN ('A','B','C'))
                 / count(*), 1) AS pct_abc,
           round(100.0 * count(*) FILTER (WHERE dpe_classe IN ('F','G'))
                 / count(*), 1) AS pct_fg,
           count(*) AS ventes
    FROM gold WHERE dpe_classe IS NOT NULL GROUP BY 1
""").df().to_string(index=False))

titre("1. DÉCOTE DANS L'ANCIEN UNIQUEMENT — mesure corrigée")
print("  VEFA exclues. C'est la seule comparaison à périmètre comparable.\n")
print(con.execute("""
    SELECT dpe_classe AS classe, count(*) AS ventes,
           round(median(100 * prix_m2 / prix_m2_reference_12m), 1) AS indice,
           round(median(prix_m2)) AS prix_m2_median
    FROM gold
    WHERE dpe_classe IS NOT NULL AND prix_m2_reference_12m IS NOT NULL
      AND NOT est_vefa AND dpe_qualite_appariement = 'exacte'
    GROUP BY 1 ORDER BY 1
""").df().to_string(index=False))

titre("1 bis. À ÂGE DE BÂTI COMPARABLE — le test décisif")
print("  Le décrochage entre C et D pourrait venir de l'ÂGE du bâti, pas de")
print("  l'isolation : un logement récent est à la fois bien classé et vendu")
print("  avec une prime de modernité. On compare donc les étiquettes À")
print("  L'INTÉRIEUR de chaque période de construction.\n")

couverture = con.execute("""
    SELECT count(*) AS avec_dpe,
           count(periode_construction) AS avec_annee,
           round(100.0 * count(periode_construction) / count(*), 1) AS taux
    FROM gold WHERE dpe_classe IS NOT NULL
""").df()
print("  Couverture de l'année de construction :")
print(couverture.to_string(index=False))

print("\n  Indice de prix par période et par étiquette (ancien, appariement exact) :")
print(con.execute("""
    SELECT periode_construction AS periode,
           count(*) FILTER (WHERE dpe_classe IN ('C','D','E'))            AS n_courant,
           round(median(100 * prix_m2 / prix_m2_reference_12m)
                 FILTER (WHERE dpe_classe IN ('C','D','E')), 1)           AS courant,
           count(*) FILTER (WHERE dpe_classe IN ('F','G'))                AS n_passoire,
           round(median(100 * prix_m2 / prix_m2_reference_12m)
                 FILTER (WHERE dpe_classe IN ('F','G')), 1)               AS passoire,
           round(median(100 * prix_m2 / prix_m2_reference_12m)
                 FILTER (WHERE dpe_classe IN ('F','G'))
                 - median(100 * prix_m2 / prix_m2_reference_12m)
                 FILTER (WHERE dpe_classe IN ('C','D','E')), 1)           AS ecart
    FROM gold
    WHERE dpe_classe IS NOT NULL AND prix_m2_reference_12m IS NOT NULL
      AND periode_construction IS NOT NULL AND NOT est_vefa
      AND dpe_qualite_appariement = 'exacte'
    GROUP BY 1 ORDER BY 1
""").df().to_string(index=False))

print("\n  Si l'écart reste négatif DANS CHAQUE période, l'effet énergie est")
print("  réel. S'il disparaît, ce qu'on mesurait était l'âge du bâti.")

titre("2. DÉCOTE F/G SELON LA PRÉCISION DE L'APPARIEMENT")
print("  Indice 100 = au prix de référence du marché local.")
print("  On compare les passoires (F, G) aux classes courantes (C, D, E).\n")

print(con.execute("""
    WITH base AS (
        SELECT CASE
                 WHEN dpe_ecart_surface < 0.02 THEN 'a. 0 à 2 %'
                 WHEN dpe_ecart_surface < 0.04 THEN 'b. 2 à 4 %'
                 WHEN dpe_ecart_surface < 0.06 THEN 'c. 4 à 6 %'
                 WHEN dpe_ecart_surface < 0.08 THEN 'd. 6 à 8 %'
                 ELSE 'e. 8 à 10 %' END AS precision_appariement,
               CASE WHEN dpe_classe IN ('F', 'G') THEN 'passoire'
                    WHEN dpe_classe IN ('C', 'D', 'E') THEN 'courant' END AS groupe,
               100 * prix_m2 / prix_m2_reference_12m AS indice
        FROM gold
        WHERE dpe_classe IS NOT NULL AND prix_m2_reference_12m IS NOT NULL
          AND dpe_qualite_appariement = 'exacte' AND NOT est_vefa
    )
    SELECT precision_appariement,
           count(*) FILTER (WHERE groupe = 'courant')            AS n_courant,
           round(median(indice) FILTER (WHERE groupe = 'courant'), 1) AS indice_courant,
           count(*) FILTER (WHERE groupe = 'passoire')           AS n_passoire,
           round(median(indice) FILTER (WHERE groupe = 'passoire'), 1) AS indice_passoire,
           round(median(indice) FILTER (WHERE groupe = 'passoire')
                 - median(indice) FILTER (WHERE groupe = 'courant'), 1) AS ecart
    FROM base WHERE groupe IS NOT NULL
    GROUP BY 1 ORDER BY 1
""").df().to_string(index=False))

print("\n  Lecture : si la colonne 'ecart' devient plus négative vers le haut")
print("  du tableau, l'effet DPE est confirmé et l'appariement serré est")
print("  bien plus fiable. Si elle est constante, l'effet mesuré est douteux.")

titre("3. COMPARAISON DES DEUX NIVEAUX DE CONFIANCE")
print(con.execute("""
    SELECT dpe_qualite_appariement AS qualite,
           CASE WHEN dpe_classe IN ('F', 'G') THEN 'passoire'
                WHEN dpe_classe IN ('C', 'D', 'E') THEN 'courant' END AS groupe,
           count(*) AS ventes,
           round(median(100 * prix_m2 / prix_m2_reference_12m), 1) AS indice
    FROM gold
    WHERE dpe_classe IS NOT NULL AND prix_m2_reference_12m IS NOT NULL
      AND dpe_classe IN ('C', 'D', 'E', 'F', 'G') AND NOT est_vefa
    GROUP BY 1, 2 ORDER BY 1, 2
""").df().to_string(index=False))

titre("4. COMBIEN DE DPE PAR ADRESSE ?")
print("  Explique pourquoi les appariements 'probable' dominent à Paris :")
print("  un immeuble abrite des dizaines de logements diagnostiqués.\n")
print(con.execute("""
    SELECT CASE
             WHEN dpe_nb_candidats = 1 THEN '1 seul DPE compatible'
             WHEN dpe_nb_candidats <= 3 THEN '2 à 3'
             WHEN dpe_nb_candidats <= 6 THEN '4 à 6'
             ELSE '7 et plus' END AS candidats,
           count(*) AS ventes,
           round(100.0 * count(*) / sum(count(*)) OVER (), 1) AS pct
    FROM gold WHERE dpe_classe IS NOT NULL
    GROUP BY 1 ORDER BY 1
""").df().to_string(index=False))

titre("5. L'INDICATEUR DE ZONE EST-IL UN PIÈGE ?")
print("  Corrélation entre part de passoires du quartier et niveau de prix.\n")
print(con.execute("""
    SELECT round(corr(zone_part_dpe_fg, prix_m2), 3) AS correlation,
           count(*) AS ventes
    FROM gold WHERE zone_part_dpe_fg IS NOT NULL
""").df().to_string(index=False))
print("\n  Une corrélation POSITIVE signifie que les quartiers riches en")
print("  passoires sont aussi les plus chers — bâti ancien haussmannien.")
print("  À signaler à l'équipe ML : cette colonne ne mesure pas la qualité")
print("  d'un quartier, mais l'ancienneté de son bâti.\n")
