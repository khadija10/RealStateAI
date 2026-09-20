"""
Diagnostic exploratoire du pipeline DVF.

Objectif : pouvoir justifier CHAQUE règle de nettoyage avec des chiffres issus
de TA donnée, et non de valeurs par défaut choisies a priori.

Répond aux 5 questions que le jury posera :
  A. Qu'est-ce qui a été écarté par le filtre type_local (la perte de 22 %) ?
  B. À quoi ressemble vraiment la distribution des prix au m² ?
  C. Que retirent les garde-fous absolus (300 / 30 000 €/m²) ?
  D. Que retirent les quantiles par zone ?
  E. Les données restantes sont-elles cohérentes entre elles ?

Usage, depuis C:\\realstate :
    .\\.venv\\Scripts\\python.exe diagnostic.py
"""

from __future__ import annotations

import duckdb
import pandas as pd

RAW = "data/raw/dvf_*.csv.gz"
SILVER = "data/interim/silver_mutations.parquet"

# Seuils actuellement appliqués, à confirmer ou ajuster à la lumière du rapport.
PLANCHER = 300
PLAFOND = 30_000
Q_BAS, Q_HAUT = 0.01, 0.99

pd.set_option("display.width", 200)
pd.set_option("display.max_columns", 30)


def titre(texte: str) -> None:
    print("\n" + "=" * 78)
    print(texte)
    print("=" * 78)


con = duckdb.connect()
con.execute("SET memory_limit='4GB'")

# ---------------------------------------------------------------------------
titre("A. COMPOSITION DE LA PERTE DE 22 % (filtre type_local)")
# ---------------------------------------------------------------------------
# On relit le brut en forçant tout en texte : aucune inférence de type, donc
# aucun risque d'erreur de conversion sur une colonne qu'on n'utilise pas.
con.execute(f"""
    CREATE VIEW brut AS
    SELECT * FROM read_csv('{RAW}', all_varchar=true, union_by_name=true);
""")

print("\nRépartition des BIENS par type de local (mutations de vente valides) :")
print(con.execute("""
    SELECT coalesce(type_local, '(aucun local — terrain seul)') AS type_de_bien,
           count(DISTINCT id_mutation) AS nb_mutations,
           round(100.0 * count(DISTINCT id_mutation)
                 / (SELECT count(DISTINCT id_mutation) FROM brut
                    WHERE nature_mutation LIKE 'Vente%'), 1) AS pct
    FROM brut
    WHERE nature_mutation LIKE 'Vente%'
    GROUP BY 1 ORDER BY nb_mutations DESC
""").df().to_string(index=False))

print("\nLecture : les mutations sans maison ni appartement sont écartées.")
print("Vérifie qu'il s'agit bien de dépendances, locaux commerciaux et terrains.")

# ---------------------------------------------------------------------------
titre("B. DISTRIBUTION RÉELLE DU PRIX AU M² (avant tout filtrage d'outliers)")
# ---------------------------------------------------------------------------
con.execute(f"""
    CREATE VIEW silver AS
    SELECT *, valeur_fonciere / surface_bati AS prix_m2
    FROM read_parquet('{SILVER}');
""")

print("\nPercentiles par département (appartements et maisons confondus) :")
print(con.execute("""
    SELECT code_departement AS dep, count(*) AS n,
           round(min(prix_m2))                     AS minimum,
           round(quantile_cont(prix_m2, 0.001))    AS p0_1,
           round(quantile_cont(prix_m2, 0.01))     AS p1,
           round(quantile_cont(prix_m2, 0.50))     AS mediane,
           round(quantile_cont(prix_m2, 0.99))     AS p99,
           round(quantile_cont(prix_m2, 0.999))    AS p99_9,
           round(max(prix_m2))                     AS maximum
    FROM silver GROUP BY 1 ORDER BY 1
""").df().to_string(index=False))

print("\nLecture : compare le minimum au p1 et le maximum au p99.")
print("Un écart énorme signale des valeurs extrêmes qu'il faut bien écarter.")

# ---------------------------------------------------------------------------
titre("C. CE QUE RETIRENT LES GARDE-FOUS ABSOLUS")
# ---------------------------------------------------------------------------
resume = con.execute(f"""
    SELECT
        count(*) FILTER (WHERE prix_m2 < {PLANCHER})  AS sous_plancher,
        count(*) FILTER (WHERE prix_m2 > {PLAFOND})   AS sur_plafond,
        count(*)                                      AS total
    FROM silver
""").df()
n_bas, n_haut, total = int(resume.sous_plancher[0]), int(resume.sur_plafond[0]), int(resume.total[0])
print(f"\nSous {PLANCHER} €/m² : {n_bas:,} mutations ({n_bas/total:.2%})".replace(",", " "))
print(f"Au-dessus de {PLAFOND} €/m² : {n_haut:,} mutations ({n_haut/total:.2%})".replace(",", " "))

print("\n--- Échantillon des prix les PLUS BAS écartés ---")
print(con.execute(f"""
    SELECT nom_commune, type_local, surface_bati, valeur_fonciere,
           round(prix_m2, 1) AS prix_m2
    FROM silver WHERE prix_m2 < {PLANCHER}
    ORDER BY prix_m2 LIMIT 8
""").df().to_string(index=False))

print("\n--- Échantillon des prix les PLUS HAUTS écartés ---")
print(con.execute(f"""
    SELECT nom_commune, type_local, surface_bati, valeur_fonciere,
           round(prix_m2) AS prix_m2
    FROM silver WHERE prix_m2 > {PLAFOND}
    ORDER BY prix_m2 DESC LIMIT 8
""").df().to_string(index=False))

print("\nQuestion à te poser : ces lignes sont-elles des ERREURS (vente à l'euro")
print("symbolique, donation déguisée, surface fausse) ou du MARCHÉ RÉEL ?")

# ---------------------------------------------------------------------------
titre("D. CE QUE RETIRENT LES QUANTILES PAR ZONE")
# ---------------------------------------------------------------------------
con.execute(f"""
    CREATE VIEW borne AS
    SELECT * FROM silver WHERE prix_m2 BETWEEN {PLANCHER} AND {PLAFOND};
""")
con.execute(f"""
    CREATE VIEW seuils AS
    SELECT code_commune, code_type_local,
           quantile_cont(prix_m2, {Q_BAS})  AS q_bas,
           quantile_cont(prix_m2, {Q_HAUT}) AS q_haut,
           count(*) AS n
    FROM borne GROUP BY 1, 2;
""")

print("\nCouverture du calcul communal (seuil actuel : 100 ventes minimum) :")
print(con.execute("""
    SELECT
        CASE WHEN n >= 100 THEN 'commune (n >= 100)'
             ELSE 'repli département (n < 100)' END AS methode,
        count(*) AS nb_groupes_commune_type,
        sum(n)   AS nb_mutations
    FROM seuils GROUP BY 1
""").df().to_string(index=False))

print("\nSeuils communaux calculés — 8 zones les plus chères :")
print(con.execute("""
    SELECT s.code_commune, b.nom_commune, s.code_type_local AS type,
           s.n AS nb_ventes, round(s.q_bas) AS seuil_bas, round(s.q_haut) AS seuil_haut
    FROM seuils s
    JOIN (SELECT DISTINCT code_commune, nom_commune FROM silver) b USING (code_commune)
    WHERE s.n >= 100 ORDER BY s.q_haut DESC LIMIT 8
""").df().to_string(index=False))

print("\nLecture : des seuils hauts très différents entre communes justifient")
print("le calcul par zone plutôt qu'un seuil unique sur toute l'Île-de-France.")

# ---------------------------------------------------------------------------
titre("E. COHÉRENCE INTERNE DES DONNÉES CONSERVÉES")
# ---------------------------------------------------------------------------
print("\nSurface médiane par nombre de pièces (doit croître régulièrement) :")
print(con.execute("""
    SELECT nb_pieces, count(*) AS n,
           round(median(surface_bati)) AS surface_mediane,
           round(min(surface_bati))    AS surface_min,
           round(max(surface_bati))    AS surface_max
    FROM silver WHERE nb_pieces BETWEEN 1 AND 8
    GROUP BY 1 ORDER BY 1
""").df().to_string(index=False))

print("\nAnomalies de cohérence détectées :")
anomalies = con.execute("""
    SELECT
        count(*) FILTER (WHERE nb_pieces >= 4 AND surface_bati < 30)
            AS petites_surfaces_nombreuses_pieces,
        count(*) FILTER (WHERE nb_pieces IS NULL OR nb_pieces = 0)
            AS sans_nombre_de_pieces,
        count(*) FILTER (WHERE surface_bati > 400)
            AS surfaces_superieures_400m2,
        count(*) FILTER (WHERE type_local = 'Appartement' AND surface_terrain > 0)
            AS appartements_avec_terrain
    FROM silver
""").df()
for colonne in anomalies.columns:
    valeur = int(anomalies[colonne][0])
    print(f"  {colonne:.<45} {valeur:>8,}".replace(",", " "))

print("\nLecture : quelques centaines d'anomalies sur 700 000 lignes sont")
print("acceptables. Des dizaines de milliers signaleraient un problème de règle.")

titre("FIN DU DIAGNOSTIC")
print("Reprends chaque section et note ta justification : c'est le contenu")
print("du document docs/cleaning_rules.md à remettre au jury.\n")
