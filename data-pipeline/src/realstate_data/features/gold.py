"""
Couche GOLD — dataset ML-ready livré à l'équipe modélisation.

Trois blocs de features :
  1. PRIX      : prix au m², traitement des valeurs aberrantes
  2. TEMPOREL  : année, mois, trimestre, index mensuel continu
  3. GÉO       : dynamique de marché de la commune

LE POINT CRITIQUE — L'ANTI-FUITE TEMPORELLE
Une feature du type "prix médian de la commune" calculée sur TOUT l'historique
contient l'information du prix de la transaction elle-même, et celle de
transactions futures. Le modèle obtient alors un score excellent en validation
et s'effondre en production : c'est une fuite de données (data leakage).

Ici, toute agrégation géographique est calculée sur une fenêtre GLISSANTE et
STRICTEMENT ANTÉRIEURE : les 12 mois précédant le mois de la mutation, mois
courant exclu. Une transaction ne peut donc jamais s'observer elle-même.
"""

from __future__ import annotations

import duckdb

from realstate_data.cleaning.silver import ouvrir_connexion
from realstate_data.config import Settings, charger_settings
from realstate_data.logging_conf import configurer_logging

log = configurer_logging()

# En dessous de ce nombre de ventes dans la fenêtre, la médiane communale
# n'est pas fiable : on bascule sur la médiane départementale.
MIN_VENTES_COMMUNE = 5

# Nombre de mois de la fenêtre glissante des features de marché.
FENETRE_MOIS = 12


def construire_gold(settings: Settings | None = None) -> dict:
    """Construit le dataset gold à partir du parquet silver."""
    settings = settings or charger_settings()
    silver = settings.chemins.interim / "silver_mutations.parquet"
    if not silver.exists():
        raise FileNotFoundError(f"Silver introuvable : {silver}. Lance d'abord l'étape silver.")

    conf = settings.nettoyage["outliers"]
    con = ouvrir_connexion(settings)
    con.execute(f"CREATE OR REPLACE TABLE silver AS SELECT * FROM read_parquet('{silver}');")

    # --- 1. Prix au m² et calendrier ---------------------------------------
    # mois_index : nombre de mois écoulés depuis janvier 2000. Permet de faire
    # de l'arithmétique de fenêtre sans manipuler des dates.
    con.execute("""
        CREATE OR REPLACE TABLE base AS
        SELECT
            *,
            valeur_fonciere / surface_bati                       AS prix_m2,
            year(date_mutation)                                  AS annee,
            month(date_mutation)                                 AS mois,
            quarter(date_mutation)                               AS trimestre,
            (year(date_mutation) - 2000) * 12 + month(date_mutation) AS mois_index
        FROM silver;
    """)
    n_depart = con.execute("SELECT count(*) FROM base").fetchone()[0]

    # --- 2. Garde-fous métier absolus --------------------------------------
    # Bornes larges et volontairement grossières : elles n'écartent que
    # l'impossible (erreur de saisie, vente à l'euro symbolique entre proches),
    # pas le marché haut de gamme parisien.
    con.execute(f"""
        CREATE OR REPLACE TABLE base_bornee AS
        SELECT * FROM base
        WHERE prix_m2 BETWEEN {conf['prix_m2_plancher']} AND {conf['prix_m2_plafond']};
    """)
    n_bornes = con.execute("SELECT count(*) FROM base_bornee").fetchone()[0]

    # --- 3. Outliers : règle relative à la médiane de la zone ---------------
    # POURQUOI PAS UN SEUIL ABSOLU : la médiane va de ~3 000 €/m² en Essonne
    # à ~10 300 €/m² à Paris. Un plancher unique assez haut pour Paris
    # amputerait la grande couronne ; assez bas pour la grande couronne, il
    # laisse passer des ventes parisiennes à 800 €/m², impossibles.
    #
    # POURQUOI PAS DES QUANTILES : ils retirent mécaniquement un pourcentage
    # fixe de chaque côté, que la queue de distribution soit anormale ou non.
    # Mesuré sur l'Île-de-France, le 1er percentile parisien restait à
    # 1 516 €/m² après quantiles — toujours invraisemblable.
    #
    # LA RÈGLE RETENUE : le prix au m² doit rester entre 0,25 et 4 fois la
    # médiane de sa propre commune, pour le même type de bien. Elle s'adapte
    # seule au territoire, coûte moins cher (1,6 % contre 3,0 %) et capture
    # notamment les ventes en nue-propriété ou en viager occupé, dont le prix
    # enregistré ne représente qu'une fraction de la valeur du bien et que
    # DVF ne permet pas d'identifier autrement.
    ratio_min = conf.get("ratio_min", 0.25)
    ratio_max = conf.get("ratio_max", 4.0)

    # La médiane de référence est calculée sur la base déjà bornée : sinon
    # les ventes à 1 € la tireraient vers le bas et fausseraient le ratio.
    con.execute("""
        CREATE OR REPLACE TABLE medianes_zone AS
        SELECT code_commune, code_type_local,
               median(prix_m2) AS mediane_zone,
               count(*)        AS n_zone
        FROM base_bornee GROUP BY 1, 2;
    """)
    # Repli départemental pour les communes trop peu actives : en dessous de
    # 20 ventes, une médiane communale n'est pas un repère fiable.
    con.execute("""
        CREATE OR REPLACE TABLE medianes_departement AS
        SELECT code_departement, code_type_local, median(prix_m2) AS mediane_dept
        FROM base_bornee GROUP BY 1, 2;
    """)
    con.execute(f"""
        CREATE OR REPLACE TABLE base_propre AS
        WITH avec_reference AS (
            SELECT b.* EXCLUDE (nb_lignes_source),
                   CASE WHEN mz.n_zone >= 20 THEN mz.mediane_zone
                        ELSE md.mediane_dept END AS mediane_reference
            FROM base_bornee b
            LEFT JOIN medianes_zone mz
                   ON mz.code_commune = b.code_commune
                  AND mz.code_type_local = b.code_type_local
            LEFT JOIN medianes_departement md
                   ON md.code_departement = b.code_departement
                  AND md.code_type_local = b.code_type_local
        )
        SELECT * EXCLUDE (mediane_reference)
        FROM avec_reference
        WHERE mediane_reference IS NULL
           OR prix_m2 / mediane_reference BETWEEN {ratio_min} AND {ratio_max};
    """)
    n_outliers = con.execute("SELECT count(*) FROM base_propre").fetchone()[0]
    log.info("Outliers : %d retirés par les bornes absolues, %d par la règle "
             "relative (%.2f%% au total)",
             n_depart - n_bornes, n_bornes - n_outliers,
             100 * (1 - n_outliers / n_depart) if n_depart else 0)

    # --- 4. Features de marché SANS FUITE TEMPORELLE -----------------------
    # Agrégat mensuel, puis fenêtre glissante [m-12, m-1] : le mois de la
    # mutation est EXCLU, donc la transaction ne contribue jamais à sa propre
    # feature, et aucune information future n'est utilisée.
    con.execute("""
        CREATE OR REPLACE TABLE mensuel_commune AS
        SELECT code_commune, code_type_local, mois_index,
               median(prix_m2) AS med, count(*) AS n
        FROM base_propre GROUP BY 1, 2, 3;
    """)
    con.execute(f"""
        CREATE OR REPLACE TABLE marche_commune AS
        SELECT g.code_commune, g.code_type_local, g.mois_index,
               median(h.med) AS prix_m2_median_commune_12m,
               coalesce(sum(h.n), 0) AS nb_ventes_commune_12m
        FROM (SELECT DISTINCT code_commune, code_type_local, mois_index FROM base_propre) g
        LEFT JOIN mensuel_commune h
               ON h.code_commune = g.code_commune
              AND h.code_type_local = g.code_type_local
              AND h.mois_index BETWEEN g.mois_index - {FENETRE_MOIS} AND g.mois_index - 1
        GROUP BY 1, 2, 3;
    """)

    con.execute("""
        CREATE OR REPLACE TABLE mensuel_departement AS
        SELECT code_departement, code_type_local, mois_index,
               median(prix_m2) AS med, count(*) AS n
        FROM base_propre GROUP BY 1, 2, 3;
    """)
    con.execute(f"""
        CREATE OR REPLACE TABLE marche_departement AS
        SELECT g.code_departement, g.code_type_local, g.mois_index,
               median(h.med) AS prix_m2_median_dept_12m,
               coalesce(sum(h.n), 0) AS nb_ventes_dept_12m
        FROM (SELECT DISTINCT code_departement, code_type_local, mois_index FROM base_propre) g
        LEFT JOIN mensuel_departement h
               ON h.code_departement = g.code_departement
              AND h.code_type_local = g.code_type_local
              AND h.mois_index BETWEEN g.mois_index - {FENETRE_MOIS} AND g.mois_index - 1
        GROUP BY 1, 2, 3;
    """)

    # --- 5. Assemblage du dataset final ------------------------------------
    # prix_m2_reference_12m : médiane communale si elle repose sur assez de
    # ventes, sinon médiane départementale. `source_reference_prix` trace le
    # choix effectué, pour que l'équipe ML puisse l'utiliser comme variable
    # ou filtrer dessus.
    con.execute(f"""
        CREATE OR REPLACE TABLE gold AS
        SELECT
            b.id_mutation,
            b.date_mutation,
            b.annee, b.mois, b.trimestre, b.mois_index,
            b.code_departement, b.code_commune, b.nom_commune, b.code_postal,
            b.latitude, b.longitude,
            b.type_local, b.code_type_local,
            b.surface_bati, b.nb_pieces, b.surface_terrain, b.nb_parcelles,
            b.valeur_fonciere, b.prix_m2,
            mc.prix_m2_median_commune_12m,
            mc.nb_ventes_commune_12m,
            md.prix_m2_median_dept_12m,
            md.nb_ventes_dept_12m,
            CASE WHEN mc.nb_ventes_commune_12m >= {MIN_VENTES_COMMUNE}
                 THEN mc.prix_m2_median_commune_12m
                 ELSE md.prix_m2_median_dept_12m END AS prix_m2_reference_12m,
            CASE WHEN mc.nb_ventes_commune_12m >= {MIN_VENTES_COMMUNE}
                 THEN 'commune' ELSE 'departement' END AS source_reference_prix,
            b.surface_bati / nullif(b.nb_pieces, 0) AS surface_moyenne_piece,
            (b.surface_terrain IS NOT NULL AND b.surface_terrain > 0) AS a_terrain
        FROM base_propre b
        LEFT JOIN marche_commune mc
               ON mc.code_commune = b.code_commune
              AND mc.code_type_local = b.code_type_local
              AND mc.mois_index = b.mois_index
        LEFT JOIN marche_departement md
               ON md.code_departement = b.code_departement
              AND md.code_type_local = b.code_type_local
              AND md.mois_index = b.mois_index;
    """)

    # Partitionné par année : l'équipe ML peut charger un seul millésime, et
    # découper train/test chronologiquement sans lire tout le dataset.
    sortie = settings.chemins.processed / "gold_transactions"
    con.execute(f"""
        COPY gold TO '{sortie}'
        (FORMAT PARQUET, COMPRESSION ZSTD, PARTITION_BY (annee), OVERWRITE_OR_IGNORE 1);
    """)

    n_final = con.execute("SELECT count(*) FROM gold").fetchone()[0]
    sans_ref = con.execute(
        "SELECT count(*) FROM gold WHERE prix_m2_reference_12m IS NULL"
    ).fetchone()[0]

    rapport = {
        "mutations_entree_silver": n_depart,
        "apres_bornes_absolues": n_bornes,
        "apres_outliers_par_zone": n_outliers,
        "lignes_gold": n_final,
        "sans_reference_marche": sans_ref,
        "part_sans_reference": round(sans_ref / n_final, 4) if n_final else None,
        "chemin": str(sortie),
    }
    log.info("Gold écrit : %s (%d lignes, %d sans référence de marché)",
             sortie, n_final, sans_ref)
    con.close()
    return rapport
