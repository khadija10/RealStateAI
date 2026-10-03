"""Cohérence application / modèle — l'inférence calcule-t-elle les mêmes features ?

Pour de vraies ventes du gold, compare :
  - l'estimation de l'APPLICATION (POST /api/predictions/estimate, à partir de
    l'adresse seule : géocodage BAN, parcelle IGN, immeuble, IRIS, BDNB) ;
  - la prédiction HORS LIGNE du même modèle de production sur la ligne du gold
    (features calculées par le pipeline), DPE individuel retiré pour être à
    information égale avec une saisie sans numéro de DPE.

Un écart important signale un écart entraînement / production (une feature
calculée autrement à l'inférence). Ce n'est PAS une mesure de précision : le
modèle de production a appris sur ces ventes. La précision se lit dans
docs/resultats_protocole_v2_*.md.

Usage (backend lancé sur le port 8000) :
    python ml/scenarios_coherence_app.py --n-par-dep 5
"""

import argparse
import json
import urllib.request
from pathlib import Path

import duckdb
import joblib
import numpy as np
import pandas as pd

from features import charger_config, construire_features_ingenierie, preparer_features

API = "http://127.0.0.1:8000/api/predictions/estimate"
DPE_INDIVIDUEL = ["dpe_classe", "dpe_score", "dpe_deperdition_enveloppe_m2", "dpe_type_chauffage",
                  "annee_construction"]


def _api(vente: pd.Series) -> float | None:
    corps = {"address": f"{int(vente.adresse_numero)} {vente.adresse_nom_voie}",
             "postal_code": str(vente.code_postal), "area_m2": float(vente.surface_bati),
             "rooms": int(vente.nb_pieces) if pd.notna(vente.nb_pieces) and vente.nb_pieces > 0 else 1,
             "property_type": "house" if vente.code_type_local == "1" else "apartment"}
    req = urllib.request.Request(API, data=json.dumps(corps).encode(), method="POST",
                                 headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            d = json.loads(r.read())
        return d["price_per_m2"] if d.get("model") == "ml" else None
    except Exception:  # noqa: BLE001 — adresse non géocodée : vente écartée
        return None


def main() -> None:
    parseur = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parseur.add_argument("--n-par-dep", type=int, default=5)
    parseur.add_argument("--sortie", default="docs/scenarios_coherence_app.md")
    parseur.add_argument("--avec-dpe", action="store_true",
                         help="garder le DPE des deux côtés : celui du gold hors ligne, celui retrouvé à "
                              "l'adresse par l'application (depuis que l'application le retrouve seule)")
    args = parseur.parse_args()

    config = charger_config("ml/config.yaml")
    gold = Path(config["data"]["gold_path"])
    ventes = duckdb.sql(f"""
        SELECT * FROM read_parquet('{gold}/**/*.parquet', hive_partitioning=true)
        WHERE date_mutation >= '2025-10-01' AND adresse_numero IS NOT NULL
          AND adresse_nom_voie IS NOT NULL AND prix_m2_reference_12m IS NOT NULL
        QUALIFY row_number() OVER (PARTITION BY code_departement ORDER BY hash(id_mutation)) <= {args.n_par_dep}
    """).df()
    ventes = construire_features_ingenierie(ventes)

    modele = joblib.load("Backend/models/price_model.pkl")
    categories = json.loads(Path("Backend/models/categories.json").read_text())
    dtypes = {c: pd.CategoricalDtype(v) for c, v in categories.items()}
    X, _ = preparer_features(ventes, config, dtypes)
    if not args.avec_dpe:
        X[[c for c in DPE_INDIVIDUEL if c in X.columns]] = np.nan
        for c in DPE_INDIVIDUEL:
            if c in dtypes:
                X[c] = X[c].astype(dtypes[c])
    hors_ligne = np.exp(modele.predict(X[modele.feature_name_])) \
        if config.get("target_transform") == "log" else modele.predict(X[modele.feature_name_])

    lignes, ecarts = [], []
    for (_, v), off in zip(ventes.iterrows(), hors_ligne):
        app = _api(v)
        if app is None:
            lignes.append(f"| {v.code_departement} | {v.nom_commune} | {v.surface_bati:.0f} m² | {off:,.0f} | — | adresse non géocodée |")
            continue
        ecart = (app - off) / off * 100
        ecarts.append(abs(ecart))
        lignes.append(f"| {v.code_departement} | {v.nom_commune} | {v.surface_bati:.0f} m² | {off:,.0f} | {app:,.0f} | {ecart:+.1f} % |")

    e = np.array(ecarts)
    texte = [
        "# Scénarios de cohérence application / modèle",
        "",
        "Généré par `ml/scenarios_coherence_app.py`. Ventes réelles d'octobre à décembre 2025, "
        f"{args.n_par_dep} par département, estimées à partir de l'adresse seule par l'application, "
        "comparées à la prédiction hors ligne du même modèle "
        + ("(DPE du gold hors ligne, DPE retrouvé à l'adresse par l'application)." if args.avec_dpe
           else "(DPE individuel retiré hors ligne ; l'application ne recevait alors aucun DPE)."),
        "",
        "**Ce n'est pas une mesure de précision** : le modèle de production a appris sur ces ventes. "
        "On vérifie que l'inférence recalcule les mêmes features qu'à l'entraînement.",
        "",
        f"**Résultat : {len(e)} ventes estimées par le modèle ML, écart médian {np.median(e):.1f} %, "
        f"{(e <= 5).mean() * 100:.0f} % à moins de 5 %, écart maximal {e.max():.1f} %.**" if len(e) else "Aucune vente estimée.",
        "",
        "Écarts attendus, sans défaut : (1) l'application estime au marché du jour (dernière "
        "référence connue), la ligne du gold au marché du mois de la vente ; (2) dans "
        "l'application, la vente testée fait partie de l'historique de son immeuble, alors que "
        "le gold n'utilise que les ventes antérieures.",
        "",
        "| Dép. | Commune | Surface | Hors ligne (€/m²) | Application (€/m²) | Écart |",
        "|---|---|---:|---:|---:|---:|",
        *[l.replace(",", " ") for l in lignes],
    ]
    Path(args.sortie).write_text("\n".join(texte) + "\n", encoding="utf-8")
    print("\n".join(texte))


if __name__ == "__main__":
    import os
    os.chdir(Path(__file__).resolve().parent.parent)
    main()
