"""
Enrichissement par l'IRIS — découpage infra-communal de l'INSEE.

POURQUOI
DVF ne contient aucune variable de quartier : la feature de marché la plus
fine disponible est la commune (ou l'arrondissement pour Paris, Lyon,
Marseille). Deux rues très différentes d'un même arrondissement sont donc
indiscernables pour le modèle. L'IRIS (« Îlot Regroupé pour l'Information
Statistique ») découpe chaque commune de plus de 5 000 habitants en zones
d'environ 2 000 habitants — un grain bien plus fin, auquel l'INSEE rattache
des statistiques de recensement.

SOURCES
  1. Contours géographiques : IGN, produit « Contours IRIS », licence
     ouverte, distribué en GeoPackage (projection Lambert-93, EPSG:2154) via
     data.geopf.fr. Un polygone par IRIS.
  2. Revenu médian : INSEE Filosofi, « Revenus, pauvreté et niveau de vie
     (Iris) ». Variable la plus corrélée au prix immobilier parmi les
     statistiques de quartier disponibles.
  3. Type d'habitat : INSEE recensement de la population, base IRIS
     logement. Part de logements collectifs et part de propriétaires
     occupants — un signal de COMPOSITION DU QUARTIER, distinct du
     `type_local` qui ne décrit que le bien vendu.

On exclut volontairement les catégories socio-professionnelles : signal
diffus, redondant avec le revenu médian.

MÉTHODE DE RATTACHEMENT
Contrairement au DPE (jointure par adresse texte, appariement incertain),
le rattachement à l'IRIS est un calcul GÉOMÉTRIQUE exact : chaque mutation a
des coordonnées (latitude, longitude) DVF déjà validées, et chaque IRIS est
un polygone. Le taux de rattachement attendu est donc proche de 100 %, sauf
pour les communes de moins de 5 000 habitants qui ne sont pas découpées en
IRIS (elles ne forment qu'un seul IRIS communal, qui reste un rattachement
valide).

On utilise l'extension `spatial` de DuckDB plutôt que geopandas/shapely :
le pipeline entier tourne déjà sur DuckDB, cela évite une dépendance aux
binaires GDAL. `ST_Read` charge le GeoPackage, `ST_Transform` reprojette les
coordonnées WGS84 de DVF vers le Lambert-93 des contours IGN, `ST_Within`
fait la jointure point-dans-polygone.

INCERTITUDE ASSUMÉE SUR LE FORMAT DES SOURCES
Comme pour le DPE, les URLs et noms de colonnes INSEE/IGN dérivent d'un
millésime de publication à l'autre. `diagnostic_iris` vérifie le format
avant tout téléchargement en masse, sur le même principe que
`dpe.diagnostic_api` : échouer vite et clairement plutôt que d'ingérer des
colonnes silencieusement vides ou mal nommées.

COUVERTURE PARTIELLE DES STATISTIQUES — ASSUMÉE
Le secret statistique INSEE masque les indicateurs des IRIS trop peu
peuplés. `iris_min_menages_zone` ajoute une marge de sécurité : en dessous
de ce seuil, les statistiques de l'IRIS sont neutralisées plutôt que
publiées peu fiables.
"""

from __future__ import annotations

import time
import zipfile
from pathlib import Path
from typing import Any

import duckdb
import requests

from realstate_data.config import Settings, charger_settings
from realstate_data.logging_conf import configurer_logging

log = configurer_logging()

ENTETES = {"User-Agent": "RealStateAI-pipeline/0.1 (projet academique)",
           "Accept": "*/*"}

COLONNES_IRIS_GOLD = {
    "code_iris": "VARCHAR",
    "revenu_median_iris": "DOUBLE",
    "part_logements_collectifs_iris": "DOUBLE",
    "part_proprietaires_iris": "DOUBLE",
    "iris_nb_menages": "INTEGER",
}


# --- Téléchargement ----------------------------------------------------------

def _conf(settings: Settings) -> dict[str, Any]:
    return settings.enrichissement


def _telecharger_fichier(url: str, cible: Path, forcer: bool = False) -> Path:
    """
    Télécharge un fichier brut (archive), sans le décompresser.

    REPRISE SUR ERREUR : insee.fr renvoie occasionnellement des 502/503/504
    (gateway timeout) sur ses gros fichiers, de façon transitoire — observé en
    pratique sur les CSV Filosofi/logement. Quelques tentatives avec attente
    exponentielle suffisent presque toujours, même logique que
    `dpe.telecharger_dpe` face aux erreurs réseau de l'API ADEME.
    """
    if cible.exists() and not forcer:
        log.info("Déjà téléchargé, ignoré : %s", cible.name)
        return cible
    cible.parent.mkdir(parents=True, exist_ok=True)
    tmp = cible.with_suffix(cible.suffix + ".part")

    derniere_erreur: Exception | None = None
    for tentative in range(5):
        try:
            with requests.get(url, headers=ENTETES, stream=True, timeout=300) as reponse:
                reponse.raise_for_status()
                attendu = reponse.headers.get("Content-Length")
                with open(tmp, "wb") as f:
                    f.writelines(reponse.iter_content(chunk_size=1 << 20))
                # Un flux coupé en cours de route ne lève pas toujours
                # d'exception côté requests : seule la taille annoncée par le
                # serveur permet de détecter un téléchargement tronqué (observé
                # en pratique sur insee.fr, qui produit alors un .zip dont
                # l'en-tête est valide mais la fin manquante).
                taille_recue = tmp.stat().st_size
                if attendu is not None and taille_recue != int(attendu):
                    raise requests.RequestException(
                        f"taille reçue {taille_recue} != Content-Length {attendu} "
                        "(flux probablement coupé)"
                    )
            tmp.rename(cible)
            log.info("Téléchargé : %s (%.1f Mo)", cible.name, cible.stat().st_size / 1e6)
            return cible
        except requests.RequestException as err:
            derniere_erreur = err
            attente = min(5 * 2 ** tentative, 60)
            log.warning("Échec du téléchargement de %s (%s) — nouvel essai dans %ds",
                        url, type(err).__name__, attente)
            time.sleep(attente)
    raise RuntimeError(
        f"Téléchargement de {url} abandonné après 5 tentatives : {derniere_erreur}"
    )


def telecharger_contours_iris(settings: Settings | None = None,
                              forcer: bool = False) -> Path:
    """
    Télécharge et extrait les contours IRIS (IGN) vers un GeoPackage unique.

    Le produit IGN est distribué en archive (.7z ou .zip selon la ressource
    configurée) : on extrait le premier fichier .gpkg trouvé à l'intérieur.
    """
    settings = settings or charger_settings()
    conf = _conf(settings)
    url = conf["iris_contours_url"]
    dossier = settings.chemins.external / "iris"
    archive = dossier / Path(url).name
    gpkg_cible = dossier / "contours_iris.gpkg"

    if gpkg_cible.exists() and not forcer:
        log.info("Contours IRIS déjà extraits : %s", gpkg_cible)
        return gpkg_cible

    _telecharger_fichier(url, archive, forcer=forcer)
    dossier_extraction = dossier / "_extraction"
    dossier_extraction.mkdir(parents=True, exist_ok=True)

    if archive.suffix == ".7z":
        import py7zr

        with py7zr.SevenZipFile(archive, mode="r") as z:
            z.extractall(path=dossier_extraction)
    elif archive.suffix == ".zip":
        with zipfile.ZipFile(archive) as z:
            z.extractall(path=dossier_extraction)
    else:
        raise RuntimeError(
            f"Format d'archive non géré : {archive.suffix}. "
            "Adapte 'iris_contours_url' vers une ressource .7z ou .zip, "
            "ou étends telecharger_contours_iris()."
        )

    candidats = list(dossier_extraction.rglob("*.gpkg"))
    if not candidats:
        raise RuntimeError(
            f"Aucun fichier .gpkg trouvé dans {archive.name} une fois extrait. "
            "Le produit IGN a peut-être changé de format : vérifie "
            "'iris_contours_url' dans settings.yaml."
        )
    candidats[0].replace(gpkg_cible)
    log.info("Contours IRIS extraits : %s", gpkg_cible)
    return gpkg_cible


def telecharger_filosofi(settings: Settings | None = None, forcer: bool = False) -> Path:
    """Télécharge et extrait le CSV INSEE Filosofi (revenu médian par IRIS)."""
    return _telecharger_csv_insee(settings, forcer, url_cle="iris_filosofi_url",
                                  nom_cible="filosofi.csv")


def telecharger_logement(settings: Settings | None = None, forcer: bool = False) -> Path:
    """Télécharge et extrait le CSV INSEE logement (type d'habitat par IRIS)."""
    return _telecharger_csv_insee(settings, forcer, url_cle="iris_logement_url",
                                  nom_cible="logement.csv")


def _telecharger_csv_insee(settings: Settings | None, forcer: bool,
                           url_cle: str, nom_cible: str) -> Path:
    settings = settings or charger_settings()
    conf = _conf(settings)
    url = conf[url_cle]
    dossier = settings.chemins.external / "iris"
    archive = dossier / Path(url).name
    csv_cible = dossier / nom_cible

    if csv_cible.exists() and not forcer:
        log.info("Déjà extrait : %s", csv_cible)
        return csv_cible

    _telecharger_fichier(url, archive, forcer=forcer)
    with zipfile.ZipFile(archive) as z:
        candidats = [n for n in z.namelist() if n.lower().endswith(".csv")]
        if not candidats:
            raise RuntimeError(
                f"Aucun .csv trouvé dans {archive.name}. L'INSEE distribue "
                f"peut-être ce millésime uniquement en .xlsx : vérifie "
                f"'{url_cle}' dans settings.yaml."
            )
        with z.open(candidats[0]) as source, open(csv_cible, "wb") as dest:
            dest.write(source.read())
    log.info("Extrait : %s", csv_cible)
    return csv_cible


def _colonne_geometrie(con: duckdb.DuckDBPyConnection, chemin: Path) -> str:
    """
    Détecte le nom de la colonne géométrie d'un GeoPackage.

    POURQUOI PAS UN NOM FIXE : le produit IGN "CONTOURS-IRIS" nomme sa colonne
    `geometrie`, pas `geom` — une convention qui n'est pas garantie stable
    d'un producteur ou d'un millésime à l'autre. On repère la colonne par son
    TYPE (toute colonne `GEOMETRY(...)`), pas par son nom.
    """
    colonnes = con.execute(f"DESCRIBE SELECT * FROM ST_Read('{chemin}') LIMIT 0").fetchall()
    geometries = [c[0] for c in colonnes if str(c[1]).upper().startswith("GEOMETRY")]
    if not geometries:
        raise RuntimeError(
            f"Aucune colonne de type GEOMETRY trouvée dans {chemin}. "
            "Le format du GeoPackage a peut-être changé."
        )
    return geometries[0]


# --- Diagnostic préalable -----------------------------------------------------

def diagnostic_iris(settings: Settings | None = None) -> dict[str, Any]:
    """
    Contrôle le format des trois sources AVANT tout traitement en masse.

    Sur le même principe que `dpe.diagnostic_api` : vérifie que les colonnes
    attendues existent réellement, pour échouer tôt et clairement si l'INSEE
    ou l'IGN a changé de format depuis l'écriture de ce module.
    """
    settings = settings or charger_settings()
    conf = _conf(settings)
    resultat: dict[str, Any] = {}

    # Contours : on vérifie juste que l'extension spatiale sait lire le fichier
    # et que la colonne code IRIS existe, sans tout charger en mémoire.
    try:
        chemin = telecharger_contours_iris(settings)
        con = duckdb.connect()
        con.execute("INSTALL spatial; LOAD spatial;")
        colonnes = {c[0] for c in con.execute(
            f"DESCRIBE SELECT * FROM ST_Read('{chemin}') LIMIT 0"
        ).fetchall()}
        code_col = conf.get("iris_code_colonne", "code_iris")
        resultat["contours"] = {
            "fichier": str(chemin),
            "colonnes_presentes": sorted(colonnes),
            "colonne_code_iris_ok": code_col in colonnes,
            "colonne_geometrie_detectee": _colonne_geometrie(con, chemin),
        }
    except Exception as err:  # noqa: BLE001 — diagnostic, on veut capturer tout
        resultat["contours"] = {"erreur": str(err)}

    for nom, telecharger, colonnes_attendues in (
        ("filosofi", telecharger_filosofi, ["IRIS", f"DISP_MED{conf.get('iris_filosofi_millesime', 21)}"]),
        ("logement", telecharger_logement, ["IRIS",
            f"P{conf.get('iris_logement_millesime', 21)}_LOG",
            f"P{conf.get('iris_logement_millesime', 21)}_APPART",
            f"P{conf.get('iris_logement_millesime', 21)}_RP",
            f"P{conf.get('iris_logement_millesime', 21)}_RP_PROP"]),
    ):
        try:
            chemin = telecharger(settings)
            entete = duckdb.sql(
                f"SELECT * FROM read_csv_auto('{chemin}', sep=';') LIMIT 0"
            ).columns
            manquantes = [c for c in colonnes_attendues if c not in entete]
            resultat[nom] = {
                "fichier": str(chemin),
                "colonnes_attendues": colonnes_attendues,
                "colonnes_manquantes": manquantes,
            }
        except Exception as err:  # noqa: BLE001
            resultat[nom] = {"erreur": str(err)}

    return resultat


# --- Appariement ---------------------------------------------------------------

def enrichir_iris(con: duckdb.DuckDBPyConnection, settings: Settings) -> dict[str, Any]:
    """
    Ajoute les colonnes IRIS à la table `gold` de la connexion.

    Colonnes toujours créées : vides si les contours n'ont pas été
    téléchargés, pour que le schéma du dataset ne varie jamais (même
    garantie que `dpe.enrichir_dpe`).
    """
    conf = _conf(settings)
    dossier = settings.chemins.external / "iris"
    chemin_contours = dossier / "contours_iris.gpkg"

    if not chemin_contours.exists():
        log.warning("Aucun fichier de contours IRIS : colonnes IRIS créées "
                    "vides. Lance d'abord : python -m realstate_data.pipeline iris")
        colonnes = ", ".join(f"CAST(NULL AS {t}) AS {c}"
                             for c, t in COLONNES_IRIS_GOLD.items())
        con.execute(f"CREATE OR REPLACE TABLE gold AS SELECT *, {colonnes} FROM gold;")
        return {"iris_disponible": False}

    con.execute("INSTALL spatial; LOAD spatial;")
    code_col = conf.get("iris_code_colonne", "code_iris")
    geom_col = _colonne_geometrie(con, chemin_contours)

    # --- 1. Rattachement géométrique -----------------------------------------
    # Les coordonnées DVF sont en WGS84 (EPSG:4326, cf. data_dictionary.md) ;
    # les contours IGN sont en Lambert-93 (EPSG:2154). On reprojette le POINT
    # plutôt que les polygones : nettement moins de géométries à transformer
    # (une par mutation unique de coordonnées, contre ~48 000 polygones).
    #
    # always_xy := true EST OBLIGATOIRE : l'autorité EPSG définit l'axe de
    # EPSG:4326 comme (latitude, longitude), pas (longitude, latitude). Sans
    # ce paramètre, ST_Transform interprète ST_Point(longitude, latitude)
    # avec les axes inversés et renvoie des coordonnées fausses sans lever
    # d'erreur — observé en pratique : 0 % de rattachement sur les vraies
    # données, silencieux, alors que les tests synthétiques (CRS source =
    # cible, transformation identité) ne passent jamais par ce chemin.
    crs_cible = conf.get("iris_contours_crs", "EPSG:2154")
    con.execute(f"""
        CREATE OR REPLACE TABLE contours_iris AS
        SELECT {code_col} AS code_iris, {geom_col} AS geom
        FROM ST_Read('{chemin_contours}');
    """)
    con.execute(f"""
        CREATE OR REPLACE TABLE points_mutations AS
        SELECT DISTINCT latitude, longitude,
               ST_Transform(ST_Point(longitude, latitude), 'EPSG:4326', '{crs_cible}',
                            always_xy := true) AS geom
        FROM gold
        WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
    """)
    con.execute("""
        CREATE OR REPLACE TABLE rattachement AS
        SELECT p.latitude, p.longitude, c.code_iris
        FROM points_mutations p
        JOIN contours_iris c ON ST_Within(p.geom, c.geom);
    """)

    # --- 2. Statistiques socio-démographiques --------------------------------
    millesime_filo = conf.get("iris_filosofi_millesime", 21)
    millesime_log = conf.get("iris_logement_millesime", 21)
    min_menages = int(conf.get("iris_min_menages_zone", 50))
    chemin_filosofi = dossier / "filosofi.csv"
    chemin_logement = dossier / "logement.csv"

    if chemin_filosofi.exists():
        con.execute(f"""
            CREATE OR REPLACE TABLE stats_filosofi AS
            SELECT CAST(IRIS AS VARCHAR) AS code_iris,
                   TRY_CAST(REPLACE(CAST(DISP_MED{millesime_filo} AS VARCHAR), ',', '.')
                            AS DOUBLE) AS revenu_median_iris
            FROM read_csv_auto('{chemin_filosofi}', sep=';', all_varchar=true);
        """)
    else:
        con.execute("""
            CREATE OR REPLACE TABLE stats_filosofi AS
            SELECT CAST(NULL AS VARCHAR) AS code_iris,
                   CAST(NULL AS DOUBLE) AS revenu_median_iris
            WHERE FALSE;
        """)

    if chemin_logement.exists():
        con.execute(f"""
            CREATE OR REPLACE TABLE stats_logement AS
            SELECT
                CAST(IRIS AS VARCHAR) AS code_iris,
                TRY_CAST(P{millesime_log}_RP AS DOUBLE)      AS nb_residences_principales,
                CASE WHEN TRY_CAST(P{millesime_log}_LOG AS DOUBLE) > 0
                     THEN TRY_CAST(P{millesime_log}_APPART AS DOUBLE)
                          / TRY_CAST(P{millesime_log}_LOG AS DOUBLE) END
                    AS part_logements_collectifs_iris,
                CASE WHEN TRY_CAST(P{millesime_log}_RP AS DOUBLE) > 0
                     THEN TRY_CAST(P{millesime_log}_RP_PROP AS DOUBLE)
                          / TRY_CAST(P{millesime_log}_RP AS DOUBLE) END
                    AS part_proprietaires_iris
            FROM read_csv_auto('{chemin_logement}', sep=';', all_varchar=true);
        """)
    else:
        con.execute("""
            CREATE OR REPLACE TABLE stats_logement AS
            SELECT CAST(NULL AS VARCHAR) AS code_iris,
                   CAST(NULL AS DOUBLE) AS nb_residences_principales,
                   CAST(NULL AS DOUBLE) AS part_logements_collectifs_iris,
                   CAST(NULL AS DOUBLE) AS part_proprietaires_iris
            WHERE FALSE;
        """)

    # --- 3. Assemblage : rattachement + statistiques, seuil de fiabilité ----
    # En dessous de iris_min_menages_zone résidences principales, les
    # statistiques de l'IRIS sont neutralisées (NULL) plutôt que publiées
    # peu fiables — même logique que zone_min_diagnostics côté DPE.
    con.execute(f"""
        CREATE OR REPLACE TABLE gold AS
        SELECT g.*,
               r.code_iris AS code_iris,
               CASE WHEN l.nb_residences_principales >= {min_menages}
                    THEN f.revenu_median_iris END AS revenu_median_iris,
               CASE WHEN l.nb_residences_principales >= {min_menages}
                    THEN l.part_logements_collectifs_iris END
                   AS part_logements_collectifs_iris,
               CASE WHEN l.nb_residences_principales >= {min_menages}
                    THEN l.part_proprietaires_iris END AS part_proprietaires_iris,
               CAST(l.nb_residences_principales AS INTEGER) AS iris_nb_menages
        FROM gold g
        LEFT JOIN rattachement r
               ON r.latitude = g.latitude AND r.longitude = g.longitude
        LEFT JOIN stats_filosofi f ON f.code_iris = r.code_iris
        LEFT JOIN stats_logement l ON l.code_iris = r.code_iris;
    """)

    total, rattaches, avec_revenu = con.execute("""
        SELECT count(*), count(code_iris), count(revenu_median_iris) FROM gold
    """).fetchone()

    bilan = {
        "iris_disponible": True,
        "ventes": total,
        "ventes_rattachees_iris": rattaches,
        "taux_rattachement": round(rattaches / total, 4) if total else 0,
        "ventes_avec_revenu_median": avec_revenu,
    }
    log.info("IRIS : %d ventes rattachées sur %d (%.1f %%), dont %d avec "
             "revenu médian fiable", rattaches, total,
             100 * bilan["taux_rattachement"], avec_revenu)
    return bilan
