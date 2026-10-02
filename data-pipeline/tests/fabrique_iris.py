"""
Génère des contours IRIS et statistiques INSEE synthétiques, avec vérité
terrain, pour tester l'enrichissement IRIS sans accès à l'IGN ni à l'INSEE.

Un polygone rectangulaire par commune de l'échantillon DVF (`fabrique_dvf`),
assez large pour couvrir toute la dispersion des coordonnées générées pour
cette commune, avec un revenu médian et un type d'habitat distincts par
commune. Les tests vérifient ensuite que chaque mutation est rattachée au bon
IRIS et hérite des bonnes statistiques — et d'aucune autre.

CRS : les polygones sont écrits directement en WGS84 (EPSG:4326), comme les
coordonnées DVF. Un vrai contour IGN est en Lambert-93 ; le test désactive la
reprojection (`iris_contours_crs = "EPSG:4326"`, cf. `environnement` dans
test_iris.py) pour rester focalisé sur la logique de rattachement et de
jointure, pas sur l'exactitude numérique de ST_Transform.
"""

from __future__ import annotations

from pathlib import Path

import duckdb

# Reprend les centres de fabrique_dvf.COMMUNES, avec une marge assez large
# (0.12°) pour couvrir le jitter du générateur DVF (+/- 0.05 lon, +/- 0.04 lat)
# sans faire se chevaucher deux communes voisines.
IRIS_PAR_COMMUNE: dict[str, dict] = {
    "75111": {"code_iris": "751110101", "lon": 2.37, "lat": 48.86,
              "revenu_median": 28000, "part_collectif": 0.98, "part_proprio": 0.55,
              "nb_menages": 3000},
    "75116": {"code_iris": "751160101", "lon": 2.27, "lat": 48.86,
              "revenu_median": 45000, "part_collectif": 0.95, "part_proprio": 0.70,
              "nb_menages": 2500},
    "92044": {"code_iris": "920440101", "lon": 2.27, "lat": 48.82,
              "revenu_median": 32000, "part_collectif": 0.80, "part_proprio": 0.60,
              "nb_menages": 1800},
    "93066": {"code_iris": "930660101", "lon": 2.36, "lat": 48.94,
              "revenu_median": 18000, "part_collectif": 0.85, "part_proprio": 0.40,
              "nb_menages": 2200},
    "77288": {"code_iris": "772880101", "lon": 2.66, "lat": 48.54,
              "revenu_median": 22000, "part_collectif": 0.50, "part_proprio": 0.65,
              "nb_menages": 1200},
}

# Marge = jitter exact de fabrique_dvf.generer() (+/- 0.05 lon, +/- 0.04 lat) :
# certaines communes de l'échantillon sont à peine plus éloignées que ce
# rayon (ex. 75116/92044, distantes de 0.04 en latitude), donc leurs
# rectangles se recoupent légèrement. C'est assumé : les tests d'intégration
# qui utilisent ces contours ne vérifient PAS qu'un point retombe sur l'IRIS
# de sa commune d'origine (impossible à garantir avec des nuages de points
# qui se chevauchent), seulement la couverture globale et la validité des
# statistiques héritées. La correction géométrique exacte du rattachement
# est testée séparément, sur des polygones sans ambiguïté
# (voir test_rattachement_geometrique_et_jointure_des_statistiques).
MARGE_LON = 0.05
MARGE_LAT = 0.04


def generer_contours(destination: Path) -> None:
    """Écrit un GeoPackage d'un polygone rectangulaire par commune."""
    destination.parent.mkdir(parents=True, exist_ok=True)
    con = duckdb.connect()
    con.execute("INSTALL spatial; LOAD spatial;")
    selections = [
        f"SELECT '{info['code_iris']}' AS CODE_IRIS, "
        f"ST_MakeEnvelope({info['lon'] - MARGE_LON}, {info['lat'] - MARGE_LAT}, "
        f"{info['lon'] + MARGE_LON}, {info['lat'] + MARGE_LAT}) AS geom"
        for info in IRIS_PAR_COMMUNE.values()
    ]
    requete = " UNION ALL ".join(selections)
    con.execute(f"COPY ({requete}) TO '{destination}' WITH (FORMAT GDAL, DRIVER 'GPKG');")


def generer_filosofi(destination: Path) -> None:
    """Écrit le CSV de revenu médian par IRIS, au format INSEE Filosofi."""
    destination.parent.mkdir(parents=True, exist_ok=True)
    lignes = ["IRIS;DISP_MED21"]
    for info in IRIS_PAR_COMMUNE.values():
        lignes.append(f"{info['code_iris']};{info['revenu_median']}")
    destination.write_text("\n".join(lignes), encoding="utf-8")


def generer_logement(destination: Path) -> None:
    """Écrit le CSV de type d'habitat par IRIS, au format INSEE logement."""
    destination.parent.mkdir(parents=True, exist_ok=True)
    lignes = ["IRIS;P21_LOG;P21_APPART;P21_RP;P21_RP_PROP"]
    for info in IRIS_PAR_COMMUNE.values():
        nb_rp = info["nb_menages"]
        nb_log = int(nb_rp * 1.08)          # quelques logements vacants/secondaires
        nb_appart = int(nb_log * info["part_collectif"])
        nb_proprio = int(nb_rp * info["part_proprio"])
        lignes.append(f"{info['code_iris']};{nb_log};{nb_appart};{nb_rp};{nb_proprio}")
    destination.write_text("\n".join(lignes), encoding="utf-8")
