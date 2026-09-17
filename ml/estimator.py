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
    code_postal: str | None,
    surface_m2: float,
    nb_pieces: float,
    type_bien: str,
    a_terrain: bool = False,
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
    code_type_local = TYPE_BIEN_MAP.get(type_bien, "2")

    geo = geocoder_adresse(adresse, code_postal)
    marche = recuperer_features_marche(
        code_commune=geo["code_commune"],
        code_departement=geo["code_departement"],
        code_type_local=code_type_local,
        gold_path=_GOLD_PATH,
    )

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
    )

    return {
        **result,
        "adresse_normalisee": geo["adresse_normalisee"],
        "commune": geo["nom_commune"],
        "score_geocodage": geo["score"],
    }
