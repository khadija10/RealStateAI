"""
Géocodage via l'API BAN (Base Adresse Nationale — api-adresse.data.gouv.fr).

Retourne coordonnées + code commune + features de marché DVF pour un bien.
Prévu pour être remplacé par Google Places sans changer l'interface.
"""

from __future__ import annotations

import urllib.error
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


# Réponses BAN déjà obtenues (adresse → résultat) : une adresse réestimée ou
# revue depuis l'historique ne refait pas d'appel réseau.
_CACHE_BAN: dict[str, dict] = {}
_CACHE_MAX = 5000


def _appeler_ban(url: str) -> dict:
    """Appel BAN avec un second essai : un délai dépassé isolé ne fait plus
    basculer l'estimation sur le repli DVF (constaté sur Clichy, rapport v1.5)."""
    derniere: Exception | None = None
    for delai in (5, 10):
        try:
            with urllib.request.urlopen(url, timeout=delai) as resp:
                return json.loads(resp.read())
        except (TimeoutError, urllib.error.URLError, OSError) as exc:
            derniere = exc
    raise derniere  # type: ignore[misc]


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
    params: dict = {"q": query, "limit": 1}
    if code_postal:
        # postcode= restreint géographiquement les résultats (évite les homonymes hors-IDF)
        params["postcode"] = code_postal
    url = f"{BAN_URL}?{urllib.parse.urlencode(params)}"

    data = _CACHE_BAN.get(url)
    if data is None:
        data = _appeler_ban(url)
        if len(_CACHE_BAN) >= _CACHE_MAX:
            _CACHE_BAN.pop(next(iter(_CACHE_BAN)))
        _CACHE_BAN[url] = data

    features = data.get("features", [])
    if not features:
        raise ValueError(f"Adresse introuvable : {adresse!r}")

    feat = features[0]
    props = feat["properties"]
    coords = feat["geometry"]["coordinates"]  # [lon, lat]

    code_commune = props.get("citycode", "")
    code_departement = code_commune[:2] if len(code_commune) >= 2 else ""

    score = props.get("score", 0.0)
    if score < 0.4:
        raise ValueError(f"Adresse introuvable ou trop ambiguë : {adresse!r} (score BAN {score:.2f})")

    return {
        "latitude": coords[1],
        "longitude": coords[0],
        "code_commune": code_commune,
        "code_departement": code_departement,
        "nom_commune": props.get("city", ""),
        "adresse_normalisee": props.get("label", adresse),
        "numero": props.get("housenumber"),
        "code_postal": props.get("postcode"),
        "score": score,
        "score_bas": score < 0.6,
    }


def recuperer_features_marche(
    code_commune: str,
    code_departement: str,
    code_type_local: str,
    latitude: float | None = None,
    longitude: float | None = None,
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
          "prix_m2_median_local_12m": float | None,
          "mois_index": int,
          "mois": int,
          "trimestre": int,
        }
    """
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

    # Feature spatiale locale ~1 km (nécessite lat/lon)
    prix_m2_median_local_12m = None
    if latitude is not None and longitude is not None:
        lat_r = round(latitude, 2)
        lon_r = round(longitude, 2)
        # Valeur du mois le plus récent de la cellule, comme la référence
        # communale ci-dessus. Un MAX() sur toutes les années renvoyait le
        # mois le plus cher depuis 2021 (souvent le pic 2021-2022) et gonflait
        # les estimations jusqu'à +40 % par rapport au modèle hors ligne.
        local_row = con.execute(f"""
            SELECT prix_m2_median_local_12m
            FROM {parquet_query}
            WHERE ROUND(latitude, 2)  = {lat_r}
              AND ROUND(longitude, 2) = {lon_r}
              AND code_type_local = '{code_type_local}'
              AND prix_m2_median_local_12m IS NOT NULL
            ORDER BY mois_index DESC
            LIMIT 1
        """).fetchone()
        if local_row and local_row[0] is not None:
            prix_m2_median_local_12m = float(local_row[0])

    con.close()

    if row is None:
        return {
            "prix_m2_reference_12m": None,
            "nb_ventes_commune_12m": 0.0,
            "prix_m2_median_dept_12m": None,
            "nb_ventes_dept_12m": 0.0,
            "prix_m2_median_local_12m": prix_m2_median_local_12m,
            "mois_index": mois_index,
            "mois": mois,
            "trimestre": trimestre,
        }

    return {
        "prix_m2_reference_12m": row[0],
        "nb_ventes_commune_12m": float(row[1] or 0),
        "prix_m2_median_dept_12m": row[2],
        "nb_ventes_dept_12m": float(row[3] or 0),
        "prix_m2_median_local_12m": prix_m2_median_local_12m,
        "mois_index": mois_index,
        "mois": mois,
        "trimestre": trimestre,
    }
