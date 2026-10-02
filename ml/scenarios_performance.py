"""Scénarios de performance par segment — v1 et v2 sur le test du protocole.

Même découpage que docs/protocole_evaluation.md : entraînement jusqu'à juin
2025, arrêt anticipé sur juillet–septembre, test octobre–décembre 2025. Les
modèles sont ceux, figés, des sections 4 (v1) et 8 (v2) ; ce script ne règle
rien, il DÉCOUPE la mesure officielle par type de bien pour montrer où le
modèle est fiable et où il ne l'est pas.

Usage :
    python ml/scenarios_performance.py --config-v1 <config v1> --sortie docs/scenarios_performance.md
"""

import argparse
import contextlib
import io
from datetime import datetime
from pathlib import Path

import lightgbm as lgb
import numpy as np
import pandas as pd

import evaluer_protocole as e
from features import charger_config

TEST = ("2025-10", "2025-12")
DEPARTEMENTS = {"75": "Paris", "92": "Hauts-de-Seine", "93": "Seine-Saint-Denis",
                "94": "Val-de-Marne", "77": "Seine-et-Marne", "78": "Yvelines",
                "91": "Essonne", "95": "Val-d'Oise"}


def _predire(config: dict) -> tuple[pd.DataFrame, np.ndarray]:
    with contextlib.redirect_stdout(io.StringIO()):
        jeux, poids, _, test_df = e._jeux(config, *TEST)
    (X_train, y_train), (X_val, y_val), (X_test, _) = jeux
    params = dict(config["lightgbm"])
    early_stopping = params.pop("early_stopping_rounds", 50)
    params.pop("verbose", None)
    f, inv = e._transformations(config)
    model = lgb.LGBMRegressor(**params, verbose=-1)
    model.fit(X_train, f(y_train), sample_weight=poids, eval_set=[(X_val, f(y_val))],
              callbacks=[lgb.early_stopping(early_stopping, verbose=False)])
    return test_df.reset_index(drop=True), inv(model.predict(X_test))


ORDRES = {"Surface": ["< 30 m²", "30–60 m²", "60–100 m²", "≥ 100 m²"],
          "Niveau de prix de la commune": ["Marché le moins cher (Q1)", "Q2", "Q3",
                                           "Marché le plus cher (Q4)"]}


def _segments(df: pd.DataFrame) -> dict[str, pd.Series]:
    surface = pd.cut(df["surface_bati"], [0, 30, 60, 100, 1e9],
                     labels=["< 30 m²", "30–60 m²", "60–100 m²", "≥ 100 m²"], right=False)
    zone = df["code_departement"].map(lambda d: "Paris" if d == "75" else
                                      "Petite couronne (92, 93, 94)" if d in ("92", "93", "94")
                                      else "Grande couronne (77, 78, 91, 95)")
    prix = pd.qcut(df["prix_m2_reference_12m"], 4,
                   labels=["Marché le moins cher (Q1)", "Q2", "Q3", "Marché le plus cher (Q4)"])
    return {
        "Ensemble": pd.Series("Toutes les ventes de test", index=df.index),
        "Zone": zone,
        "Département": df["code_departement"].map(DEPARTEMENTS),
        "Type de bien": df["code_type_local"].map({"1": "Maison", "2": "Appartement"}),
        "Surface": surface.astype(str),
        "Niveau de prix de la commune": prix.astype(str),
        "DPE du bien connu": df["dpe_classe"].notna().map({True: "Oui", False: "Non"}),
        "Ventes antérieures dans l'immeuble": (df["nb_ventes_immeuble"].fillna(0) > 0).map(
            {True: "Oui", False: "Non"}),
        "Neuf (VEFA)": df["est_vefa"].fillna(False).astype(bool).map({True: "Oui", False: "Non"}),
    }


def _metriques(ape: np.ndarray) -> dict:
    return {"n": len(ape), "mape": ape.mean(), "p10": (ape <= 10).mean() * 100,
            "p20": (ape <= 20).mean() * 100}


def tableau(df: pd.DataFrame, ape_v1: np.ndarray, ape_v2: np.ndarray) -> list[str]:
    lignes = []
    for titre, seg in _segments(df).items():
        lignes += [f"### {titre}", "",
                   "| Segment | Ventes | MAPE v1 | MAPE v2 | Gain | ±10 % v2 | ±20 % v2 |",
                   "|---|---:|---:|---:|---:|---:|---:|"]
        ordre = ORDRES.get(titre, seg.value_counts().index)
        for val in ordre:
            m = (seg == val).values
            if m.sum() < 30:
                continue
            a, b = _metriques(ape_v1[m]), _metriques(ape_v2[m])
            lignes.append(f"| {val} | {b['n']:,} | {a['mape']:.1f} % | **{b['mape']:.1f} %** | "
                          f"{b['mape'] - a['mape']:+.1f} pt | {b['p10']:.1f} % | {b['p20']:.1f} % |"
                          .replace(",", "\u202f"))
        lignes.append("")
    return lignes


def main() -> None:
    parseur = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parseur.add_argument("--config-v1", required=True)
    parseur.add_argument("--config-v2", default="ml/config.yaml")
    parseur.add_argument("--sortie", default="docs/scenarios_performance.md")
    args = parseur.parse_args()

    print("Modèle v1…", flush=True)
    df, pred_v1 = _predire(charger_config(args.config_v1))
    print("Modèle v2…", flush=True)
    df2, pred_v2 = _predire(charger_config(args.config_v2))
    assert df["id_mutation"].equals(df2["id_mutation"]), "les deux tests doivent porter sur les mêmes ventes"
    y = df["prix_m2"].values
    ape_v1, ape_v2 = e._erreurs(y, pred_v1), e._erreurs(y, pred_v2)

    entete = [
        "# Scénarios de performance par segment — modèles v1 et v2",
        "",
        f"Généré le {datetime.now():%d/%m/%Y à %H:%M} par `ml/scenarios_performance.py`.",
        "",
        "Test du protocole (`docs/protocole_evaluation.md`) : **ventes d'octobre à décembre 2025**, "
        "jamais vues à l'entraînement (jusqu'à juin 2025) ni au réglage (juillet–septembre 2025). "
        "Modèles figés : v1 = section 4, v2 = addendum 8. Ce découpage ne modifie aucun réglage : "
        "il détaille la mesure officielle segment par segment. Segments de moins de 30 ventes omis.",
        "",
        "Erreur d'une vente = |prix réel − prix estimé| / prix réel. "
        "« Gain » négatif = le v2 se trompe moins que le v1.",
        "",
        f"Contrôle : MAPE globale v1 {ape_v1.mean():.2f} %, v2 {ape_v2.mean():.2f} % "
        "(officiel : 16,71 % et 14,91 %).",
        "",
    ]
    sortie = Path(args.sortie)
    sortie.write_text("\n".join(entete + tableau(df, ape_v1, ape_v2)), encoding="utf-8")
    print(sortie.read_text(encoding="utf-8"))


if __name__ == "__main__":
    import os
    os.chdir(Path(__file__).resolve().parent.parent)
    main()
