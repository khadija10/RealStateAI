"""
Géocodage via l'API BAN (Base Adresse Nationale — api-adresse.data.gouv.fr).

Retourne coordonnées + code commune + features de marché DVF pour un bien.
Prévu pour être remplacé par Google Places sans changer l'interface.
"""

from __future__ import annotations

import urllib.parse
import urllib.request
import json
from pathlib import Path
from datetime import datetime

import duckdb


BAN_URL = "https://api-adresse.data.gouv.fr/search/"
GOLD_PATH = "data/processed/gold_transactions"
MARKET_REF_PATH = "data/samples/market_reference.parquet"

# Mois courant comme index (nb mois depuis jan 2000)
def _mois_index_courant() -> int:
    now = datetime.now()
    return (now.year - 2000) * 12 + now.month


def geocoder_adresse(adresse: str, code_postal: str | None = None) -> dict:
    """
    Géocode une adresse française via l'API BAN.

    Retourne :
        {
          "latitude": float,
          "longitude": float,
          "code_commune": str,   # code INSEE 5 chiffres (ex: "75110" = Paris 10e)
          "code_departement": str,
          "nom_commune": str,
          "adresse_normalisee": str,
          "score": float         # confiance du géocodage 0-1
        }

    Lève ValueError si aucun résultat trouvé.
    """
    query = adresse
    if code_postal:
        query = f"{adresse} {code_postal}"

    params = urllib.parse.urlencode({"q": query, "limit": 1})
    url = f"{BAN_URL}?{params}"

    with urllib.request.urlopen(url, timeout=5) as resp:
        data = json.loads(resp.read())

    features = data.get("features", [])
    if not features:
        raise ValueError(f"Adresse introuvable : {adresse!r}")

    feat = features[0]
    props = feat["properties"]
    coords = feat["geometry"]["coordinates"]  # [lon, lat]

    code_commune = props.get("citycode", "")
    code_departement = code_commune[:2] if len(code_commune) >= 2 else ""

    return {
        "latitude": coords[1],
        "longitude": coords[0],
        "code_commune": code_commune,
        "code_departement": code_departement,
        "nom_commune": props.get("city", ""),
        "adresse_normalisee": props.get("label", adresse),
        "score": props.get("score", 0.0),
    }


def recuperer_features_marche(
    code_commune: str,
    code_departement: str,
    code_type_local: str,
    gold_path: str = GOLD_PATH,
    market_ref_path: str = MARKET_REF_PATH,
) -> dict:
    """
    Récupère les features de marché DVF les plus récentes pour une commune.

    Retourne :
        {
          "prix_m2_reference_12m": float | None,
          "nb_ventes_commune_12m": float,
          "prix_m2_median_dept_12m": float | None,
          "nb_ventes_dept_12m": float,
          "mois_index": int,
          "mois": int,
          "trimestre": int,
        }
    """
    # Utilise gold complet si dispo, sinon table de référence pré-calculée (37 KB)
    path = Path(gold_path)
    if not path.exists():
        path = Path(market_ref_path)
        if not path.exists():
            raise FileNotFoundError("Ni le dataset gold ni la table market_reference.parquet ne sont disponibles.")
        parquet_query = f"read_parquet('{path}')"
    else:
        parquet_query = f"read_parquet('{path}/**/*.parquet', hive_partitioning=true)"

    mois_index = _mois_index_courant()
    mois = datetime.now().month
    trimestre = (mois - 1) // 3 + 1

    con = duckdb.connect()
    row = con.execute(f"""
        SELECT
            prix_m2_reference_12m,
            nb_ventes_commune_12m,
            prix_m2_median_dept_12m,
            nb_ventes_dept_12m
        FROM {parquet_query}
        WHERE code_commune = '{code_commune}'
          AND code_type_local = '{code_type_local}'
          AND prix_m2_reference_12m IS NOT NULL
        ORDER BY mois_index DESC
        LIMIT 1
    """).fetchone()

    if row is None:
        # Repli département si commune inconnue
        row = con.execute(f"""
            SELECT
                NULL,
                0,
                prix_m2_median_dept_12m,
                nb_ventes_dept_12m
            FROM {parquet_query}
            WHERE code_departement = '{code_departement}'
              AND code_type_local = '{code_type_local}'
              AND prix_m2_median_dept_12m IS NOT NULL
            ORDER BY mois_index DESC
            LIMIT 1
        """).fetchone()

    con.close()

    if row is None:
        return {
            "prix_m2_reference_12m": None,
            "nb_ventes_commune_12m": 0.0,
            "prix_m2_median_dept_12m": None,
            "nb_ventes_dept_12m": 0.0,
            "mois_index": mois_index,
            "mois": mois,
            "trimestre": trimestre,
        }

    return {
        "prix_m2_reference_12m": row[0],
        "nb_ventes_commune_12m": float(row[1] or 0),
        "prix_m2_median_dept_12m": row[2],
        "nb_ventes_dept_12m": float(row[3] or 0),
        "mois_index": mois_index,
        "mois": mois,
        "trimestre": trimestre,
    }
