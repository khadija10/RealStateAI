"""
Scénarios de simulation — compare les prédictions du nouveau modèle
sur des cas représentatifs pour valider que les nouvelles features
(code_commune, surface_terrain, prix_m2_median_local_12m, arrondissement)
produisent des résultats cohérents avec le marché réel IDF.
"""

import json
import os
from pathlib import Path

import duckdb
import joblib
import numpy as np
import pandas as pd

os.chdir(Path(__file__).resolve().parent.parent)

MODEL_PATH = "Backend/models/price_model.pkl"
GOLD_PATH  = "data/processed/gold_transactions"
CAT_PATH   = "Backend/models/categories.json"

model      = joblib.load(MODEL_PATH)
categories = json.loads(Path(CAT_PATH).read_text())

MOIS_INDEX_REF = 312   # décembre 2025 — dernier mois du gold
MOIS_REF       = 12
TRIMESTRE_REF  = 4


def features_marche(code_commune: str, code_departement: str, code_type_local: str,
                    lat: float, lon: float) -> dict:
    """Récupère les features de marché depuis le gold pour un lieu donné."""
    row = duckdb.sql(f"""
        SELECT
            MAX(prix_m2_reference_12m)    AS ref,
            MAX(nb_ventes_commune_12m)    AS n_commune,
            MAX(prix_m2_median_dept_12m)  AS dept,
            MAX(nb_ventes_dept_12m)       AS n_dept,
            MAX(prix_m2_median_local_12m) AS local_
        FROM read_parquet('{GOLD_PATH}/**/*.parquet', hive_partitioning=true)
        WHERE code_commune = '{code_commune}'
          AND code_type_local = '{code_type_local}'
          AND mois_index = {MOIS_INDEX_REF}
    """).fetchone()

    # Fallback spatial si commune inconnue
    if row[0] is None:
        row2 = duckdb.sql(f"""
            SELECT MAX(prix_m2_median_local_12m)
            FROM read_parquet('{GOLD_PATH}/**/*.parquet', hive_partitioning=true)
            WHERE ROUND(latitude,2)  = ROUND({lat},2)
              AND ROUND(longitude,2) = ROUND({lon},2)
              AND code_type_local = '{code_type_local}'
              AND mois_index = {MOIS_INDEX_REF}
        """).fetchone()
        local_ = row2[0] if row2 else None
    else:
        local_ = row[4]

    dept_row = duckdb.sql(f"""
        SELECT MAX(prix_m2_median_dept_12m), MAX(nb_ventes_dept_12m)
        FROM read_parquet('{GOLD_PATH}/**/*.parquet', hive_partitioning=true)
        WHERE code_departement = '{code_departement}'
          AND code_type_local  = '{code_type_local}'
          AND mois_index = {MOIS_INDEX_REF}
    """).fetchone()

    return {
        "prix_m2_reference_12m":   row[0] or (dept_row[0] or 5000),
        "nb_ventes_commune_12m":   row[1] or 0,
        "prix_m2_median_dept_12m": row[2] or dept_row[0] or 5000,
        "nb_ventes_dept_12m":      row[3] or dept_row[1] or 0,
        "prix_m2_median_local_12m": local_,
    }


def arrondissement_de(code_commune: str):
    if "75101" <= code_commune <= "75120":
        return int(code_commune[3:])
    if "69381" <= code_commune <= "69389":
        return int(code_commune[3:]) - 80
    if "13201" <= code_commune <= "13216":
        return int(code_commune[3:])
    return None


def predire(surface_m2, nb_pieces, code_type_local, code_departement, code_commune,
            lat, lon, surface_terrain=None, a_terrain=False):
    m = features_marche(code_commune, code_departement, code_type_local, lat, lon)
    arr = arrondissement_de(code_commune)

    X = pd.DataFrame([{
        "surface_bati":               surface_m2,
        "nb_pieces":                  nb_pieces,
        "surface_moyenne_piece":      surface_m2 / nb_pieces if nb_pieces else None,
        "prix_m2_reference_12m":      m["prix_m2_reference_12m"],
        "nb_ventes_commune_12m":      m["nb_ventes_commune_12m"],
        "prix_m2_median_dept_12m":    m["prix_m2_median_dept_12m"],
        "nb_ventes_dept_12m":         m["nb_ventes_dept_12m"],
        "prix_m2_median_local_12m":   m["prix_m2_median_local_12m"],
        "latitude":                   lat,
        "longitude":                  lon,
        "mois_index":                 MOIS_INDEX_REF,
        "mois":                       MOIS_REF,
        "trimestre":                  TRIMESTRE_REF,
        "arrondissement":             float(arr) if arr is not None else np.nan,
        "surface_terrain":            float(surface_terrain) if surface_terrain is not None else np.nan,
        "code_type_local":            str(code_type_local),
        "code_departement":           str(code_departement),
        "code_commune":               str(code_commune),
        "a_terrain":                  a_terrain,
    }])
    for col, cats in categories.items():
        if col in X.columns:
            X[col] = pd.Categorical(X[col], categories=cats)

    prix_m2 = float(model.predict(X)[0])
    prix_total = prix_m2 * surface_m2
    return prix_m2, prix_total, m["prix_m2_reference_12m"]


def afficher(titre, surface, nb_pieces, code_type_local, code_dep, code_commune,
             lat, lon, surface_terrain=None, a_terrain=False, ref_marche=None):
    prix_m2, prix_total, ref = predire(surface, nb_pieces, code_type_local,
                                        code_dep, code_commune, lat, lon,
                                        surface_terrain, a_terrain)
    ecart = f"  (médiane marché: {ref:,.0f} €/m²  |  écart modèle: {((prix_m2/ref)-1)*100:+.1f}%)" if ref else ""
    print(f"  {titre:<45} → {prix_m2:>7,.0f} €/m²   {prix_total:>12,.0f} €{ecart}")


print("\n" + "═"*95)
print("SCÉNARIO 1 — Même appartement (65 m², 3P) dans 3 arrondissements parisiens")
print("             Attendu : 6e > 11e > 20e  (écart réel : ~40-50%)")
print("═"*95)
afficher("Paris 6e  (75006) — Saint-Germain",    65, 3, "2", "75", "75106", 48.851, 2.337)
afficher("Paris 11e (75011) — Bastille",          65, 3, "2", "75", "75111", 48.859, 2.377)
afficher("Paris 20e (75020) — Belleville",        65, 3, "2", "75", "75120", 48.866, 2.403)

print("\n" + "═"*95)
print("SCÉNARIO 2 — Même appartement (80 m², 4P) dans 3 communes IDF")
print("             Attendu : Neuilly > Versailles > Saint-Denis")
print("═"*95)
afficher("Neuilly-sur-Seine (92200)",             80, 4, "2", "92", "92051", 48.884, 2.269)
afficher("Versailles (78000)",                    80, 4, "2", "78", "78646", 48.801, 2.130)
afficher("Saint-Denis (93200)",                   80, 4, "2", "93", "93066", 48.936, 2.357)

print("\n" + "═"*95)
print("SCÉNARIO 3 — Impact de la surface terrain (maison 100 m², 5P, Vincennes 94300)")
print("             Attendu : avec terrain (300 m²) > sans terrain")
print("═"*95)
afficher("Maison sans terrain",                  100, 5, "1", "94", "94080", 48.848, 2.439, surface_terrain=None,  a_terrain=False)
afficher("Maison avec terrain 150 m²",           100, 5, "1", "94", "94080", 48.848, 2.439, surface_terrain=150,   a_terrain=True)
afficher("Maison avec terrain 400 m²",           100, 5, "1", "94", "94080", 48.848, 2.439, surface_terrain=400,   a_terrain=True)

print("\n" + "═"*95)
print("SCÉNARIO 4 — Impact de la surface (même lieu, même type, Paris 15e)")
print("             Attendu : prix/m² légèrement plus bas pour les grandes surfaces")
print("═"*95)
afficher("Studio 25 m², 1P  — Paris 15e",        25, 1, "2", "75", "75115", 48.842, 2.293)
afficher("Appt   65 m², 3P  — Paris 15e",        65, 3, "2", "75", "75115", 48.842, 2.293)
afficher("Appt  120 m², 5P  — Paris 15e",       120, 5, "2", "75", "75115", 48.842, 2.293)

print("\n" + "═"*95)
print("SCÉNARIO 5 — Appartement vs Maison (même commune, Boulogne-Billancourt)")
print("═"*95)
afficher("Appartement 80 m² — Boulogne (92100)",  80, 4, "2", "92", "92012", 48.836, 2.239)
afficher("Maison      100 m² — Boulogne (92100)", 100, 5, "1", "92", "92012", 48.836, 2.239)
print()
