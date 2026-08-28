"""
Calibrage des règles de traitement des valeurs aberrantes.

On ne choisit pas un seuil parce qu'il "semble raisonnable" : on compare
plusieurs stratégies sur la MÊME donnée et on regarde deux choses :
  - combien chacune retire (coût en représentativité) ;
  - à quel point le résultat colle aux prix de marché publiés par les
    Notaires du Grand Paris (gain en justesse).

Référence externe : environ 10 130 €/m² pour les appartements parisiens
à fin juillet 2023 (Notaires du Grand Paris).

Usage, depuis C:\\realstate :
    .\\.venv\\Scripts\\python.exe calibrage.py
"""

from __future__ import annotations

import duckdb
import pandas as pd

SILVER = "data/interim/silver_mutations.parquet"
REFERENCE_PARIS_2023 = 10_130  # €/m², Notaires du Grand Paris

pd.set_option("display.width", 200)

con = duckdb.connect()
con.execute("SET memory_limit='4GB'")

# Base commune à toutes les stratégies : prix au m² et médiane de la zone.
# La médiane commune x type sert de référence locale : elle s'adapte
# automatiquement à un arrondissement parisien comme à un village de l'Essonne.
con.execute(f"""
    CREATE TABLE base AS
    WITH b AS (
        SELECT *, valeur_fonciere / surface_bati AS prix_m2
        FROM read_parquet('{SILVER}')
    ),
    medianes AS (
        SELECT code_commune, code_type_local,
               median(prix_m2) AS mediane_zone,
               count(*)        AS n_zone
        FROM b
        -- La médiane de référence est calculée sur une plage déjà
        -- débarrassée de l'impossible, sinon les ventes à 1 € la tirent
        -- vers le bas et faussent le ratio.
        WHERE prix_m2 BETWEEN 300 AND 30000
        GROUP BY 1, 2
    )
    SELECT b.*, m.mediane_zone, m.n_zone,
           b.prix_m2 / nullif(m.mediane_zone, 0) AS ratio_zone
    FROM b LEFT JOIN medianes m
      ON m.code_commune = b.code_commune
     AND m.code_type_local = b.code_type_local;
""")

TOTAL = con.execute("SELECT count(*) FROM base").fetchone()[0]

# Chaque stratégie est une clause WHERE. On les compare à conditions égales.
STRATEGIES = {
    "0. aucun filtre":
        "TRUE",
    "1. actuelle (300-30000 + quantiles 1/99)":
        "prix_m2 BETWEEN 300 AND 30000",
    "2. relative large (0.25x - 4x médiane zone)":
        "prix_m2 BETWEEN 300 AND 30000 AND ratio_zone BETWEEN 0.25 AND 4.0",
    "3. relative stricte (0.35x - 3x médiane zone)":
        "prix_m2 BETWEEN 300 AND 30000 AND ratio_zone BETWEEN 0.35 AND 3.0",
    "4. plancher relevé à 1000 + relative large":
        "prix_m2 BETWEEN 1000 AND 30000 AND ratio_zone BETWEEN 0.25 AND 4.0",
}

lignes = []
for nom, clause in STRATEGIES.items():
    r = con.execute(f"""
        SELECT
            count(*)                                                    AS n,
            median(prix_m2) FILTER (WHERE code_departement = '75'
                                      AND code_type_local = '2'
                                      AND year(date_mutation) = 2023)   AS paris_appt_2023,
            quantile_cont(prix_m2, 0.01) FILTER (WHERE code_departement = '75') AS paris_p1,
            min(prix_m2)  FILTER (WHERE code_departement = '75')        AS paris_min,
            max(prix_m2)  FILTER (WHERE code_departement = '75')        AS paris_max
        FROM base WHERE {clause}
    """).df()

    n = int(r.n[0])
    paris_med = r.paris_appt_2023[0]
    lignes.append({
        "strategie": nom,
        "lignes": n,
        "perte": f"{1 - n / TOTAL:.2%}",
        "paris_appt_2023": round(paris_med) if pd.notna(paris_med) else None,
        "ecart_notaires": (f"{(paris_med - REFERENCE_PARIS_2023) / REFERENCE_PARIS_2023:+.1%}"
                           if pd.notna(paris_med) else None),
        "paris_p1": round(r.paris_p1[0]) if pd.notna(r.paris_p1[0]) else None,
        "paris_min": round(r.paris_min[0]) if pd.notna(r.paris_min[0]) else None,
        "paris_max": round(r.paris_max[0]) if pd.notna(r.paris_max[0]) else None,
    })

print("\n" + "=" * 100)
print("COMPARAISON DES STRATÉGIES DE TRAITEMENT DES OUTLIERS")
print(f"Référence externe : {REFERENCE_PARIS_2023} €/m² (Notaires du Grand Paris, "
      "appartements Paris 2023)")
print("=" * 100)
print(pd.DataFrame(lignes).to_string(index=False))

print("\nComment lire ce tableau :")
print("  - 'perte' = coût en représentativité. Au-delà de ~8 %, c'est cher payé.")
print("  - 'ecart_notaires' = justesse. Plus il est proche de 0 %, mieux c'est.")
print("  - 'paris_p1' et 'paris_min' = les valeurs basses qui subsistent.")
print("    Un p1 parisien sous 3 000 €/m² reste invraisemblable.")

# --- Ce que la stratégie retenue écarterait, concrètement ------------------
print("\n" + "=" * 100)
print("ÉCHANTILLON DES LIGNES QUE LA STRATÉGIE 2 ÉCARTERAIT EN PLUS DE L'ACTUELLE")
print("=" * 100)
print(con.execute("""
    SELECT nom_commune, type_local, surface_bati, valeur_fonciere,
           round(prix_m2)      AS prix_m2,
           round(mediane_zone) AS mediane_zone,
           round(ratio_zone, 2) AS ratio
    FROM base
    WHERE prix_m2 BETWEEN 300 AND 30000
      AND (ratio_zone < 0.25 OR ratio_zone > 4.0)
    ORDER BY ratio_zone
    LIMIT 10
""").df().to_string(index=False))

print("\nRegarde la colonne 'ratio' : elle dit à quel point le bien s'écarte")
print("du prix médian de SA commune. Décide si ces ventes sont crédibles.\n")
