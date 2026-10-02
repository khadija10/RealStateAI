"""
Enrichissement par la BDNB — Base de Données Nationale des Bâtiments (CSTB).

POURQUOI
DVF ne décrit que le logement vendu (surface, pièces), jamais l'immeuble qui
le contient. Or un appartement dans un immeuble de 2 niveaux en pierre de
taille et le même dans une tour de 15 niveaux ne se vendent pas au même prix.
L'étage du logement reste introuvable en open data ; la BDNB fournit en
revanche la carte d'identité de chaque bâtiment, construite par croisement
d'une cinquantaine de sources publiques.

COLONNES RETENUES (agrégées par parcelle cadastrale)
  - fichiers fonciers (DGFiP)  : nombre de niveaux, année de construction,
    nombre de logements, matériau principal des murs ;
  - BD TOPO (IGN)              : hauteur maximale du bâti ;
  - Mérimée (Culture)          : distance au monument historique le plus proche ;
  - RPLS (logement social)     : part de logements sociaux de la parcelle ;
  - QPV                        : parcelle en quartier prioritaire de la ville.

MÉTHODE DE RATTACHEMENT
Jointure exacte sur l'identifiant de parcelle, au même format dans DVF et
dans la BDNB (ex. 75105000AO0003). Une parcelle porte parfois plusieurs
groupes de bâtiments : on garde le plus haut (niveaux, hauteur), le plus
ancien (année), la somme des logements.

LIMITE ASSUMÉE
La BDNB est un instantané (millésime 2026-02.a) appliqué à des ventes de
2021 à 2025. Les caractéristiques physiques d'un immeuble changent rarement
en cinq ans ; la part de logement social peut évoluer à la marge.
"""

from __future__ import annotations

import zipfile
from pathlib import Path
from typing import Any

import duckdb
import requests

from realstate_data.config import Settings, charger_settings
from realstate_data.logging_conf import configurer_logging

log = configurer_logging()

TABLES = [
    "rel_batiment_groupe_parcelle",
    "batiment_groupe_ffo_bat",
    "batiment_groupe_bdtopo_bat",
    "batiment_groupe_merimee",
    "batiment_groupe_rpls",
    "batiment_groupe_qpv",
]

COLONNES_BDNB_GOLD = {
    "bdnb_nb_niveaux": "INTEGER",
    "bdnb_hauteur_max": "DOUBLE",
    "bdnb_annee_construction": "INTEGER",
    "bdnb_nb_logements": "INTEGER",
    "bdnb_mat_mur": "VARCHAR",
    "bdnb_distance_monument": "DOUBLE",
    "bdnb_part_logement_social": "DOUBLE",
    "bdnb_qpv": "INTEGER",          # 0/1, vide si le bâtiment est inconnu
}


def _dossier(settings: Settings) -> Path:
    return settings.chemins.external / "bdnb"


def telecharger_bdnb(settings: Settings | None = None, departements: list[str] | None = None,
                     forcer: bool = False) -> None:
    """Télécharge l'extraction CSV départementale de la BDNB (≈ 200-500 Mo par département)."""
    settings = settings or charger_settings()
    motif = settings.enrichissement["bdnb_url"]
    dossier = _dossier(settings)
    dossier.mkdir(parents=True, exist_ok=True)
    for dep in departements or settings.departements:
        cible = dossier / f"dep{dep}.zip"
        if cible.exists() and not forcer:
            log.info("BDNB %s déjà téléchargée, ignorée", dep)
            continue
        with requests.get(motif.format(dep=dep), stream=True, timeout=120) as r:
            r.raise_for_status()
            with open(cible.with_suffix(".part"), "wb") as f:
                for bloc in r.iter_content(1 << 20):
                    f.write(bloc)
        cible.with_suffix(".part").rename(cible)
        log.info("BDNB %s téléchargée (%.0f Mo)", dep, cible.stat().st_size / 1e6)


def preparer_bdnb(settings: Settings | None = None) -> Path:
    """Extrait les tables utiles et les agrège par parcelle dans un seul Parquet."""
    settings = settings or charger_settings()
    dossier = _dossier(settings)
    extraction = dossier / "_extraction"
    for archive in sorted(dossier.glob("dep*.zip")):
        cible = extraction / archive.stem
        cible.mkdir(parents=True, exist_ok=True)
        with zipfile.ZipFile(archive) as z:
            for t in TABLES:
                if not (cible / f"{t}.csv").exists():
                    with z.open(f"csv/{t}.csv") as src, open(cible / f"{t}.csv", "wb") as dst:
                        dst.write(src.read())

    def lire(t: str) -> str:
        return (f"read_csv('{extraction}/*/{t}.csv', delim=';', header=true, "
                f"all_varchar=true, union_by_name=true)")

    sortie = dossier / "bdnb_parcelle.parquet"
    con = duckdb.connect()
    con.execute(f"""
        COPY (
            WITH rel AS (SELECT DISTINCT batiment_groupe_id, parcelle_id FROM {lire('rel_batiment_groupe_parcelle')}),
            ffo AS (
                SELECT batiment_groupe_id,
                       TRY_CAST(nb_niveau AS INTEGER)          AS nb_niveau,
                       TRY_CAST(annee_construction AS INTEGER) AS annee,
                       TRY_CAST(nb_log AS INTEGER)             AS nb_log,
                       nullif(mat_mur_txt, 'INDETERMINE')      AS mat_mur
                FROM {lire('batiment_groupe_ffo_bat')}
            ),
            topo AS (SELECT batiment_groupe_id, TRY_CAST(max_hauteur AS DOUBLE) AS hauteur
                     FROM {lire('batiment_groupe_bdtopo_bat')}),
            mer AS (SELECT batiment_groupe_id,
                           TRY_CAST(distance_batiment_historique_plus_proche AS DOUBLE) AS distance
                    FROM {lire('batiment_groupe_merimee')}),
            rpls AS (SELECT batiment_groupe_id, TRY_CAST(nb_log AS INTEGER) AS nb_log_social
                     FROM {lire('batiment_groupe_rpls')}),
            qpv AS (SELECT DISTINCT batiment_groupe_id FROM {lire('batiment_groupe_qpv')})
            SELECT r.parcelle_id                                      AS id_parcelle,
                   max(f.nb_niveau)                                   AS bdnb_nb_niveaux,
                   max(t.hauteur)                                     AS bdnb_hauteur_max,
                   min(CASE WHEN f.annee BETWEEN 1500 AND 2026 THEN f.annee END)
                                                                      AS bdnb_annee_construction,
                   sum(f.nb_log)                                      AS bdnb_nb_logements,
                   mode(f.mat_mur)                                    AS bdnb_mat_mur,
                   min(m.distance)                                    AS bdnb_distance_monument,
                   least(coalesce(sum(s.nb_log_social), 0) / nullif(sum(f.nb_log), 0), 1)
                                                                      AS bdnb_part_logement_social,
                   bool_or(q.batiment_groupe_id IS NOT NULL)          AS bdnb_qpv
            FROM rel r
            LEFT JOIN ffo f USING (batiment_groupe_id)
            LEFT JOIN topo t USING (batiment_groupe_id)
            LEFT JOIN mer m USING (batiment_groupe_id)
            LEFT JOIN rpls s USING (batiment_groupe_id)
            LEFT JOIN qpv q USING (batiment_groupe_id)
            GROUP BY r.parcelle_id
        ) TO '{sortie}' (FORMAT PARQUET);
    """)
    n = con.execute(f"SELECT count(*) FROM '{sortie}'").fetchone()[0]
    log.info("BDNB agrégée : %d parcelles -> %s", n, sortie)
    return sortie


def enrichir_bdnb(con: duckdb.DuckDBPyConnection, settings: Settings) -> dict[str, Any]:
    """
    Ajoute les colonnes BDNB à la table `gold`. Colonnes toujours créées,
    vides si la BDNB n'a pas été préparée : le schéma du dataset ne varie pas.
    """
    chemin = _dossier(settings) / "bdnb_parcelle.parquet"
    if not chemin.exists():
        log.warning("BDNB absente : colonnes créées vides. Lance d'abord : "
                    "python -m realstate_data.pipeline bdnb")
        colonnes = ", ".join(f"CAST(NULL AS {t}) AS {c}" for c, t in COLONNES_BDNB_GOLD.items())
        con.execute(f"CREATE OR REPLACE TABLE gold AS SELECT *, {colonnes} FROM gold;")
        return {"bdnb_disponible": False}

    colonnes = ", ".join(f"CAST(b.{c} AS {t}) AS {c}" for c, t in COLONNES_BDNB_GOLD.items())
    con.execute(f"""
        CREATE OR REPLACE TABLE gold AS
        SELECT g.*, {colonnes}
        FROM gold g
        LEFT JOIN read_parquet('{chemin}') b USING (id_parcelle);
    """)
    n, n_ok = con.execute(
        "SELECT count(*), count(bdnb_nb_niveaux) FROM gold").fetchone()
    log.info("BDNB : %d ventes rattachées à un bâtiment sur %d (%.1f %%)",
             n_ok, n, 100 * n_ok / n if n else 0)
    return {"bdnb_disponible": True, "ventes_rattachees": n_ok, "taux": round(n_ok / n, 4) if n else None}
