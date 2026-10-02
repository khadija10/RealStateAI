"""
Interface principale du modèle — point d'entrée pour le backend FastAPI.

Usage (Akram) :
    from ml.estimator import estimer_prix

    result = estimer_prix(
        adresse="21 rue de Rivoli",
        code_postal="75004",
        surface_m2=65.0,
        nb_pieces=3.0,
        type_bien="apartment",   # "apartment" | "house"
        a_terrain=False,
    )
    # result = {
    #   "predicted_price": 458250.0,
    #   "price_per_m2": 7050.0,
    #   "confidence_interval": {"lower": ..., "upper": ..., "confidence": "85%"},
    #   "model": "lgbm",
    #   "adresse_normalisee": "21 Rue de Rivoli 75004 Paris",
    #   "commune": "Paris 4e Arrondissement",
    #   "score_geocodage": 0.97,
    # }

Pour migrer vers Google Places : remplacer geocoding.geocoder_adresse()
par un appel Google Maps dans cette fonction uniquement.
"""

from __future__ import annotations

import os
from pathlib import Path

import contexte as ctx
from geocoding import geocoder_adresse, recuperer_features_marche
from predict import charger_modele, predire

# Mapping backend → code_type_local DVF
TYPE_BIEN_MAP = {
    "apartment": "2",
    "house": "1",
    "studio": "2",
}

_MODEL_PATH = str(
    Path(__file__).resolve().parent.parent / "Backend" / "models" / "price_model.pkl"
)
_GOLD_PATH = str(
    Path(__file__).resolve().parent.parent / "data" / "processed" / "gold_transactions"
)


def estimer_prix(
    adresse: str,
    code_postal: str | None = None,
    *,
    surface_m2: float,
    nb_pieces: float,
    type_bien: str,
    a_terrain: bool = False,
    surface_terrain: float | None = None,
    zone_part_dpe_fg: float | None = None,
    dpe_classe: str | None = None,
    annee_construction: int | None = None,
    numero_dpe: str | None = None,
    numero_lot: str | None = None,
) -> dict:
    """
    Estime le prix d'un bien immobilier à partir de son adresse.

    Étapes internes :
      1. Géocodage BAN → lat, lon, code_commune, code_departement
      2. Lookup features de marché DVF → prix_m2_reference_12m, volumes
      3. Prédiction LightGBM → prix_m2 estimé
      4. Retour du résultat formaté

    Lève :
      ValueError  : adresse introuvable par la BAN
      FileNotFoundError : dataset gold ou modèle absent
    """
    _IDF_DEPS = {"75", "77", "78", "91", "92", "93", "94", "95"}

    code_type_local = TYPE_BIEN_MAP.get(type_bien, "2")

    geo = geocoder_adresse(adresse, code_postal)
    if geo["code_departement"] not in _IDF_DEPS:
        raise ValueError(
            f"RealEstateAI couvre uniquement l'Île-de-France (départements 75–95). "
            f"L'adresse géolocalisée correspond au département {geo['code_departement']} "
            f"({geo['nom_commune']})."
        )
    marche = recuperer_features_marche(
        code_commune=geo["code_commune"],
        code_departement=geo["code_departement"],
        code_type_local=code_type_local,
        latitude=geo["latitude"],
        longitude=geo["longitude"],
        gold_path=_GOLD_PATH,
    )

    # Part de passoires du code postal : celle transmise par le backend, sinon
    # celle du code postal retrouvé par le géocodage.
    if zone_part_dpe_fg is None:
        zone_part_dpe_fg = ctx.zone_dpe(geo.get("code_postal"))

    # Contexte du bien : parcelle, immeuble, quartier, bâtiment, DPE
    id_parcelle = ctx.parcelle_de(geo["latitude"], geo["longitude"],
                                  code_commune=geo["code_commune"], numero=geo.get("numero"))
    dpe = ctx.features_dpe(numero_dpe, surface_m2)
    dpe_classe = dpe["dpe_classe"] or dpe_classe
    annee_construction = dpe["annee_construction"] or annee_construction
    immeuble = ctx.features_immeuble(
        id_parcelle, code_type_local, marche["mois_index"],
        marche["prix_m2_reference_12m"], surface_m2, lot=numero_lot)
    contexte = {
        **immeuble,
        **ctx.features_iris(geo["latitude"], geo["longitude"], geo["code_commune"],
                            id_parcelle=id_parcelle),
        **ctx.features_bdnb(id_parcelle),
        "dpe_deperdition_enveloppe_m2": dpe["dpe_deperdition_enveloppe_m2"],
        "dpe_type_chauffage": dpe["dpe_type_chauffage"],
    }

    result = predire(
        surface_m2=surface_m2,
        nb_pieces=nb_pieces,
        code_type_local=code_type_local,
        code_departement=geo["code_departement"],
        latitude=geo["latitude"],
        longitude=geo["longitude"],
        prix_m2_reference_12m=marche["prix_m2_reference_12m"],
        nb_ventes_commune_12m=marche["nb_ventes_commune_12m"],
        prix_m2_median_dept_12m=marche["prix_m2_median_dept_12m"],
        nb_ventes_dept_12m=marche["nb_ventes_dept_12m"],
        mois_index=marche["mois_index"],
        mois=marche["mois"],
        trimestre=marche["trimestre"],
        a_terrain=a_terrain,
        model_path=_MODEL_PATH,
        code_commune=geo["code_commune"],
        surface_terrain=surface_terrain,
        prix_m2_median_local_12m=marche["prix_m2_median_local_12m"],
        zone_part_dpe_fg=zone_part_dpe_fg,
        dpe_classe=dpe_classe,
        annee_construction=annee_construction,
        contexte=contexte,
    )

    return {
        **result,
        "adresse_normalisee": geo["adresse_normalisee"],
        "commune": geo["nom_commune"],
        "code_commune": geo["code_commune"],
        "score_geocodage": geo["score"],
        "geocodage_incertain": geo.get("score_bas", False),
        "id_parcelle": id_parcelle,
        "code_postal": geo.get("code_postal"),
        "zone_part_dpe_fg": zone_part_dpe_fg,
        "comparables_immeuble": immeuble["comparables_immeuble"],
        "dpe_trouve": dpe["dpe_classe"] is not None,
        "dpe_classe": dpe_classe,
        "annee_construction": annee_construction,
    }
