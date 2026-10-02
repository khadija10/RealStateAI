"""
Contexte d'un bien au moment de l'estimation — mêmes features qu'à l'entraînement.

Le gold calcule à l'entraînement des features d'immeuble, de quartier (IRIS),
de bâtiment (BDNB) et de DPE. Ce module les recalcule pour UNE adresse, avec
les mêmes définitions, sinon le modèle recevrait des valeurs vides qu'il n'a
jamais vues dans ces proportions (écart entraînement / production).

Toutes les sources externes sont facultatives : en cas d'échec réseau ou de
donnée absente, la feature reste vide et l'estimation se fait quand même.
"""

from __future__ import annotations

import json
import urllib.parse
import urllib.request
from pathlib import Path

import duckdb
import numpy as np

CADASTRE_URL = "https://apicarto.ign.fr/api/cadastre/parcelle"
ADEME_URL = "https://data.ademe.fr/data-fair/api/v1/datasets/dpe03existant/lines"
RACINE = Path(__file__).resolve().parent.parent
GOLD_PATH = RACINE / "data" / "processed" / "gold_transactions"
BDNB_PATH = RACINE / "data" / "external" / "bdnb" / "bdnb_parcelle.parquet"
# Mêmes valeurs que data-pipeline/src/realstate_data/features/gold.py (étape 5b)
FENETRE_IMMEUBLE_MOIS = 24
TOLERANCE_SURFACE = 0.10


def _get_json(url: str, params: dict, timeout: float = 4.0) -> dict | None:
    try:
        with urllib.request.urlopen(f"{url}?{urllib.parse.urlencode(params)}", timeout=timeout) as r:
            return json.loads(r.read())
    except Exception:  # noqa: BLE001 — source facultative
        return None


# Distance maximale entre le point BAN et une vente DVF au même numéro pour
# considérer qu'il s'agit du même immeuble (~60 m : largeur d'une rue et d'une
# parcelle, sans atteindre l'immeuble d'en face au numéro pair/impair voisin).
DISTANCE_MAX_DEG = 0.0006


def parcelle_de(latitude: float, longitude: float, code_commune: str | None = None,
                numero: str | None = None, gold_path: Path = GOLD_PATH) -> str | None:
    """Parcelle cadastrale de l'adresse.

    1. Une vente DVF au même numéro, dans la commune, à moins de ~60 m : c'est
       la parcelle que le pipeline a utilisée à l'entraînement. Le point BAN
       est posé sur la façade ou dans la rue, et la parcelle qui le contient
       est souvent la voisine — d'où des features d'immeuble et de bâtiment
       vides ou fausses, mesuré jusqu'à 40 % d'écart d'estimation.
    2. Sinon, la parcelle qui contient le point (API Carto IGN)."""
    if code_commune and numero and str(numero).isdigit() and Path(gold_path).exists():
        row = _gold(gold_path).execute("""
            SELECT id_parcelle FROM g
            WHERE code_commune = ? AND TRY_CAST(adresse_numero AS INTEGER) = ? AND id_parcelle IS NOT NULL
              AND abs(latitude - ?) < ? AND abs(longitude - ?) < ?
            ORDER BY (latitude - ?)^2 + (longitude - ?)^2 LIMIT 1
        """, [code_commune, int(numero), latitude, DISTANCE_MAX_DEG, longitude, DISTANCE_MAX_DEG,
              latitude, longitude]).fetchone()
        if row:
            return row[0]
    geom = json.dumps({"type": "Point", "coordinates": [longitude, latitude]})
    data = _get_json(CADASTRE_URL, {"geom": geom})
    if not data or not data.get("features"):
        return None
    return data["features"][0]["properties"].get("idu")


_CACHE: dict[str, duckdb.DuckDBPyConnection] = {}


def _gold(gold_path: Path) -> duckdb.DuckDBPyConnection:
    """Connexion avec la table `g` : colonnes du gold utiles à l'inférence,
    chargées une seule fois par processus (une estimation relirait sinon
    tout le dataset plusieurs fois)."""
    cle = str(gold_path)
    if cle not in _CACHE:
        con = duckdb.connect()
        con.execute(f"""
            CREATE TABLE g AS
            SELECT id_parcelle, code_type_local, code_commune, latitude, longitude, adresse_numero,
                   date_mutation, mois_index, surface_bati, nb_pieces, valeur_fonciere,
                   prix_m2, prix_m2_reference_12m, lot1_numero, code_iris,
                   revenu_median_iris, part_logements_collectifs_iris, part_proprietaires_iris
            FROM read_parquet('{gold_path}/**/*.parquet', hive_partitioning=true, union_by_name=true)
        """)
        _CACHE[cle] = con
    return _CACHE[cle].cursor()


def _comparables(ventes: list, prix_m2_reference: float, n: int = 6) -> list[dict]:
    """Dernières ventes de l'immeuble, avec leur prix ramené au marché du jour."""
    return [{"date": str(v[0])[:10], "surface_m2": v[1], "nb_pieces": v[2],
             "prix": round(v[3]), "prix_m2": round(v[4]),
             "prix_m2_aujourdhui": round(v[5] * prix_m2_reference)}
            for v in ventes[:n]]


def features_immeuble(id_parcelle: str | None, code_type_local: str, mois_index: int,
                      prix_m2_reference: float | None, surface: float,
                      lot: str | None = None, gold_path: Path = GOLD_PATH) -> dict:
    """Ventes de l'immeuble (24 mois) et revente du logement, ramenées au marché du jour.

    Renvoie aussi les comparables de l'immeuble, la preuve que l'agent montre."""
    vide = {"prix_m2_immeuble_indexe": None, "nb_ventes_immeuble": 0,
            "prix_m2_precedent_indexe": None, "mois_depuis_vente_precedente": None,
            "comparables_immeuble": []}
    if not id_parcelle or not prix_m2_reference or not Path(gold_path).exists():
        return vide
    con = _gold(gold_path)
    ventes = con.execute("""
        SELECT date_mutation, surface_bati, nb_pieces, valeur_fonciere, prix_m2,
               prix_m2 / prix_m2_reference_12m AS ratio, mois_index, lot1_numero
        FROM g
        WHERE id_parcelle = ? AND code_type_local = ? AND prix_m2_reference_12m > 0
        ORDER BY mois_index DESC, date_mutation DESC
    """, [id_parcelle, code_type_local]).fetchall()
    # La fenêtre part du dernier mois publié dans DVF, pas d'aujourd'hui : le
    # gold s'arrête au dernier millésime, et à l'entraînement la fenêtre
    # couvre les 24 mois précédant la vente.
    fin_donnees = con.execute("SELECT max(mois_index) FROM g").fetchone()[0]
    recentes = [v[5] for v in ventes if v[6] > fin_donnees - FENETRE_IMMEUBLE_MOIS]
    resultat = {**vide, "comparables_immeuble": _comparables(ventes, prix_m2_reference)}
    if recentes:
        resultat["prix_m2_immeuble_indexe"] = float(np.median(recentes)) * prix_m2_reference
        resultat["nb_ventes_immeuble"] = len(recentes)
    if lot:
        meme = [v for v in ventes if v[7] == str(lot) and abs(v[1] - surface) <= TOLERANCE_SURFACE * surface]
        if meme:
            resultat["prix_m2_precedent_indexe"] = meme[0][5] * prix_m2_reference
            resultat["mois_depuis_vente_precedente"] = mois_index - meme[0][6]
    return resultat


def features_iris(latitude: float, longitude: float, code_commune: str,
                  gold_path: Path = GOLD_PATH, id_parcelle: str | None = None) -> dict:
    """Statistiques IRIS de la parcelle si elle a déjà connu une vente, sinon
    de la vente connue la plus proche dans la commune.

    Évite de charger les contours IGN (170 Mo) dans le backend. La parcelle
    d'abord : en limite de deux IRIS, la vente la plus proche du point BAN
    peut être de l'autre côté (mesuré : revenu médian 21 300 € → 34 740 €)."""
    cols = ["revenu_median_iris", "part_logements_collectifs_iris", "part_proprietaires_iris"]
    if not Path(gold_path).exists():
        return dict.fromkeys(cols)
    if id_parcelle:
        row = _gold(gold_path).execute(f"""
            SELECT {", ".join(cols)} FROM g
            WHERE id_parcelle = ? AND code_iris IS NOT NULL LIMIT 1
        """, [id_parcelle]).fetchone()
        if row:
            return dict(zip(cols, row))
    row = _gold(gold_path).execute(f"""
        SELECT {", ".join(cols)} FROM g
        WHERE code_commune = ? AND code_iris IS NOT NULL
        ORDER BY (latitude - ?)^2 + (longitude - ?)^2 LIMIT 1
    """, [code_commune, latitude, longitude]).fetchone()
    return dict(zip(cols, row)) if row else dict.fromkeys(cols)


def features_bdnb(id_parcelle: str | None, bdnb_path: Path = BDNB_PATH) -> dict:
    cols = ["bdnb_nb_niveaux", "bdnb_hauteur_max", "bdnb_annee_construction", "bdnb_nb_logements",
            "bdnb_mat_mur", "bdnb_distance_monument", "bdnb_part_logement_social", "bdnb_qpv"]
    if not id_parcelle or not Path(bdnb_path).exists():
        return dict.fromkeys(cols)
    con = duckdb.connect()
    row = con.execute(f"SELECT {', '.join(cols)} FROM read_parquet('{bdnb_path}') WHERE id_parcelle = ?",
                      [id_parcelle]).fetchone()
    con.close()
    if not row:
        return dict.fromkeys(cols)
    d = dict(zip(cols, row))
    d["bdnb_qpv"] = int(d["bdnb_qpv"]) if d["bdnb_qpv"] is not None else None
    return d


def features_dpe(numero_dpe: str | None, surface: float) -> dict:
    """DPE du bien par son numéro (13 caractères, figure sur le diagnostic,
    obligatoire pour toute vente). Même normalisation qu'à l'entraînement :
    déperditions de l'enveloppe rapportées à la surface vendue."""
    vide = {"dpe_classe": None, "dpe_deperdition_enveloppe_m2": None,
            "dpe_type_chauffage": None, "annee_construction": None}
    if not numero_dpe:
        return vide
    data = _get_json(ADEME_URL, {
        "numero_dpe_eq": numero_dpe.strip().upper(), "size": 1,
        "select": "etiquette_dpe,deperditions_enveloppe,type_generateur_chauffage_principal,annee_construction",
    })
    if not data or not data.get("results"):
        return vide
    r = data["results"][0]
    dep = r.get("deperditions_enveloppe")
    return {
        "dpe_classe": r.get("etiquette_dpe"),
        "dpe_deperdition_enveloppe_m2": round(float(dep) / surface, 3) if dep and surface else None,
        "dpe_type_chauffage": r.get("type_generateur_chauffage_principal"),
        "annee_construction": int(r["annee_construction"]) if r.get("annee_construction") else None,
    }
