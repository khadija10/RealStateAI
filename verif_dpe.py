"""
Analyse de l'enrichissement DPE sur les données réelles.

Répond à trois questions, dans l'ordre :
  1. Combien de ventes ont trouvé leur DPE, et avec quelle confiance ?
  2. La tolérance de surface est-elle bien calibrée ?
  3. L'hypothèse du backlog tient-elle : les passoires F et G se vendent-elles
     moins cher ?

Pour la question 3, on ne compare pas des prix bruts — un appartement classé
G dans le 19e et un classé A dans le 7e ne disent rien du DPE. On compare
chaque vente au prix de référence de SON marché local
(`prix_m2_reference_12m`), ce qui neutralise l'effet de l'emplacement.

Usage, depuis C:\\realstate :
    .\\.venv\\Scripts\\python.exe verif_dpe.py
"""

from __future__ import annotations

import duckdb
import pandas as pd

GOLD = "data/processed/gold_transactions/**/*.parquet"

pd.set_option("display.width", 200)

con = duckdb.connect()
con.execute(f"CREATE VIEW gold AS SELECT * FROM read_parquet('{GOLD}', hive_partitioning=true);")


def titre(texte: str) -> None:
    print("\n" + "=" * 78)
    print(texte)
    print("=" * 78)


total, avec_dpe = con.execute(
    "SELECT count(*), count(dpe_classe) FROM gold").fetchone()
if not avec_dpe:
    raise SystemExit(
        "\nAucune vente n'a de DPE. Étapes :\n"
        "  python -m realstate_data.pipeline dpe-test\n"
        "  python -m realstate_data.pipeline dpe\n"
        "  python -m realstate_data.pipeline gold\n")

titre("1. COUVERTURE")
print(f"  Ventes au total           : {total:>9,}".replace(",", " "))
print(f"  Ventes avec DPE individuel : {avec_dpe:>9,}  ({avec_dpe / total:.1%})"
      .replace(",", " "))
print("\n  Par niveau de confiance :")
print(con.execute("""
    SELECT dpe_qualite_appariement AS qualite, count(*) AS ventes,
           round(100.0 * count(*) / (SELECT count(*) FROM gold), 1) AS pct_du_total
    FROM gold WHERE dpe_qualite_appariement IS NOT NULL
    GROUP BY 1 ORDER BY 2 DESC
""").df().to_string(index=False))

print("\n  Par année — les DPE au nouveau format datent de juillet 2021 :")
print(con.execute("""
    SELECT annee, count(*) AS ventes, count(dpe_classe) AS avec_dpe,
           round(100.0 * count(dpe_classe) / count(*), 1) AS taux
    FROM gold GROUP BY 1 ORDER BY 1
""").df().to_string(index=False))

print("\n  Par type de bien :")
print(con.execute("""
    SELECT type_local, count(*) AS ventes, count(dpe_classe) AS avec_dpe,
           round(100.0 * count(dpe_classe) / count(*), 1) AS taux
    FROM gold GROUP BY 1
""").df().to_string(index=False))

titre("2. CALIBRAGE DE LA TOLÉRANCE DE SURFACE")
print("  Écart de surface entre la vente et le DPE retenu (appariements exacts) :\n")
print(con.execute("""
    SELECT CASE
             WHEN dpe_ecart_surface < 0.02 THEN '0 à 2 %'
             WHEN dpe_ecart_surface < 0.04 THEN '2 à 4 %'
             WHEN dpe_ecart_surface < 0.06 THEN '4 à 6 %'
             WHEN dpe_ecart_surface < 0.08 THEN '6 à 8 %'
             ELSE '8 à 10 %' END AS ecart,
           count(*) AS ventes,
           round(100.0 * count(*) / sum(count(*)) OVER (), 1) AS pct
    FROM gold WHERE dpe_qualite_appariement = 'exacte'
    GROUP BY 1 ORDER BY 1
""").df().to_string(index=False))
print("\n  Lecture : les vrais appariements se concentrent sur les faibles écarts.")
print("  Si la tranche 8-10 % est anormalement remplie, ce sont probablement")
print("  des voisins de surface proche : resserrer 'dpe_tolerance_surface'.")

titre("3. DÉCOTE DES PASSOIRES THERMIQUES — hypothèse du backlog")
print("  Prix de la vente rapporté au prix de référence de son marché local.")
print("  100 = au prix du marché. En dessous : décote. Au-dessus : prime.\n")
decote = con.execute("""
    SELECT dpe_classe AS classe,
           count(*) AS ventes,
           round(100 * median(prix_m2 / prix_m2_reference_12m), 1) AS indice_prix,
           round(median(prix_m2)) AS prix_m2_median
    FROM gold
    WHERE dpe_classe IS NOT NULL AND prix_m2_reference_12m IS NOT NULL
      AND dpe_qualite_appariement = 'exacte'
    GROUP BY 1 ORDER BY 1
""").df()
print(decote.to_string(index=False))

if {"D", "F", "G"} <= set(decote.classe):
    ref = decote.set_index("classe").indice_prix
    print(f"\n  Écart F par rapport à D : {ref['F'] - ref['D']:+.1f} points")
    print(f"  Écart G par rapport à D : {ref['G'] - ref['D']:+.1f} points")
    print("\n  Une valeur négative confirme la décote des passoires thermiques.")
    print("  C'est la justification chiffrée de l'intérêt de cette feature.")

titre("4. INDICATEUR DE ZONE")
print(con.execute("""
    SELECT count(*) AS ventes,
           count(zone_part_dpe_fg) AS avec_indicateur,
           round(100.0 * count(zone_part_dpe_fg) / count(*), 1) AS couverture,
           round(100 * median(zone_part_dpe_fg), 1) AS part_fg_mediane_pct
    FROM gold
""").df().to_string(index=False))

print("\n  Codes postaux comptant le plus de passoires F et G :")
print(con.execute("""
    SELECT code_postal, any_value(ville) AS ville,
           round(100 * any_value(zone_part_dpe_fg), 1) AS part_fg_pct,
           any_value(zone_nb_dpe) AS nb_dpe
    FROM gold WHERE zone_part_dpe_fg IS NOT NULL
    GROUP BY 1 ORDER BY 3 DESC LIMIT 8
""").df().to_string(index=False))
print()
