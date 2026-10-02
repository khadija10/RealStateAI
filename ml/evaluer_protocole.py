"""Évaluation du modèle selon docs/protocole_evaluation.md.

Découpage strictement temporel : entraînement < validation (3 mois) < test.
La validation sert uniquement à l'arrêt anticipé ; le test est mesuré une
seule fois. Les seuils viennent du protocole, pas de ce script : ils sont
recopiés ici pour être appliqués, jamais pour être ajustés.

Usage :
    python ml/evaluer_protocole.py --test-debut 2025-10 --test-fin 2025-12

N'écrit que des résultats dans docs/ ; ne touche pas au modèle de production.
"""

import argparse
import json
import subprocess
from datetime import datetime
from pathlib import Path

import duckdb
import lightgbm as lgb
import numpy as np
import pandas as pd

from features import (
    _filtrer_outliers,
    charger_config,
    construire_cat_dtypes,
    construire_features_ingenierie,
    preparer_features,
)

# --- Seuils du protocole (sections 4 et 5) — ne pas modifier après mesure ---
OBJECTIF_DANS_10PCT = 50.0
OBJECTIF_DANS_20PCT = 80.0
CLASSE_FIABLE_MAX = 10.0
CLASSE_INDICATIVE_MAX = 20.0
MIN_VENTES_COMMUNE = 30
MOIS_VALIDATION = 3


def _periode(debut: str, fin: str) -> tuple[pd.Period, pd.Period]:
    return pd.Period(debut, "M"), pd.Period(fin, "M")


def _charger_gold_brut(config: dict) -> pd.DataFrame:
    """Gold sans le filtre ML, pour pouvoir publier la mesure complémentaire."""
    gold_path = Path(config["data"]["gold_path"])
    df = duckdb.sql(f"""
        SELECT * FROM read_parquet('{gold_path}/**/*.parquet', hive_partitioning=true)
        WHERE prix_m2_reference_12m IS NOT NULL
    """).df()
    df["periode"] = pd.to_datetime(df["date_mutation"]).dt.to_period("M")
    return construire_features_ingenierie(df)


def _erreurs(y_reel: np.ndarray, y_pred: np.ndarray) -> np.ndarray:
    return np.abs(y_reel - y_pred) / y_reel * 100


def _metriques(ape: np.ndarray) -> dict:
    return {
        "n": int(len(ape)),
        "mape": round(float(ape.mean()), 2),
        "dans_10pct": round(float((ape <= 10).mean() * 100), 1),
        "dans_20pct": round(float((ape <= 20).mean() * 100), 1),
    }


def _classe(mape: float, n: int) -> str:
    if n < MIN_VENTES_COMMUNE:
        return "donnees_insuffisantes"
    if mape <= CLASSE_FIABLE_MAX:
        return "fiable"
    if mape <= CLASSE_INDICATIVE_MAX:
        return "indicative"
    return "a_completer"


def _classement_communes(test_df: pd.DataFrame, ape: np.ndarray) -> tuple[dict, pd.DataFrame]:
    local = pd.DataFrame({"code_commune": test_df["code_commune"].values, "ape": ape})
    par_commune = local.groupby("code_commune")["ape"].agg(mape="mean", n="count").reset_index()
    par_commune["classe"] = [_classe(m, n) for m, n in zip(par_commune["mape"], par_commune["n"])]
    local = local.merge(par_commune[["code_commune", "classe"]], on="code_commune")

    resume = {}
    for classe in ["fiable", "indicative", "a_completer", "donnees_insuffisantes"]:
        ventes = local[local["classe"] == classe]
        resume[classe] = {
            "communes": int((par_commune["classe"] == classe).sum()),
            "part_ventes": round(len(ventes) / len(local) * 100, 1),
            "mape_dans_classe": round(float(ventes["ape"].mean()), 2) if len(ventes) else None,
        }
    return resume, par_commune


def evaluer(test_debut: str, test_fin: str, config_path: str = "ml/config.yaml") -> dict:
    config = charger_config(config_path)
    debut, fin = _periode(test_debut, test_fin)
    val_debut = debut - MOIS_VALIDATION

    brut = _charger_gold_brut(config)
    filtre = _filtrer_outliers(brut)

    train_df = filtre[filtre["periode"] < val_debut]
    val_df = filtre[(filtre["periode"] >= val_debut) & (filtre["periode"] < debut)]
    test_df = filtre[(filtre["periode"] >= debut) & (filtre["periode"] <= fin)]
    test_brut = brut[(brut["periode"] >= debut) & (brut["periode"] <= fin)]
    if test_df.empty:
        raise SystemExit(f"Aucune vente entre {debut} et {fin} : millésime DVF publié ?")
    print(f"  Train {train_df['periode'].min()}→{train_df['periode'].max()} : {len(train_df):,}")
    print(f"  Validation {val_debut}→{debut - 1} : {len(val_df):,}")
    print(f"  Test {debut}→{fin} : {len(test_df):,} (non filtré : {len(test_brut):,})")

    cat_dtypes = construire_cat_dtypes(brut, config["features"])
    X_train, y_train = preparer_features(train_df, config, cat_dtypes)
    X_val, y_val = preparer_features(val_df, config, cat_dtypes)
    X_test, y_test = preparer_features(test_df, config, cat_dtypes)
    X_brut, y_brut = preparer_features(test_brut, config, cat_dtypes)

    sw_cfg = config.get("sample_weights", {})
    poids = train_df["annee"].map({int(k): v for k, v in sw_cfg.items()}).fillna(1.0).values

    params = dict(config["lightgbm"])
    early_stopping = params.pop("early_stopping_rounds", 50)
    params.pop("verbose", None)
    model = lgb.LGBMRegressor(**params, verbose=-1)
    model.fit(
        X_train, y_train,
        sample_weight=poids,
        eval_set=[(X_val, y_val)],
        callbacks=[lgb.early_stopping(early_stopping, verbose=False), lgb.log_evaluation(200)],
    )

    # Mesure unique sur le test
    ape = _erreurs(y_test.values, model.predict(X_test))
    ape_brut = _erreurs(y_brut.values, model.predict(X_brut))
    principal = _metriques(ape)
    classement, par_commune = _classement_communes(test_df, ape)

    commit = subprocess.run(["git", "rev-parse", "--short", "HEAD"],
                            capture_output=True, text=True).stdout.strip()
    return {
        "protocole": "docs/protocole_evaluation.md",
        "commit": commit,
        "mesure_le": datetime.now().strftime("%Y-%m-%dT%H:%M:%S"),
        "periodes": {
            "train": [str(train_df["periode"].min()), str(train_df["periode"].max())],
            "validation": [str(val_debut), str(debut - 1)],
            "test": [str(debut), str(fin)],
        },
        "n_train": len(train_df),
        "n_validation": len(val_df),
        "n_arbres": int(model.best_iteration_),
        "principal": principal,
        "complementaire_sans_filtre_ml": _metriques(ape_brut),
        "objectif": {
            "dans_10pct_min": OBJECTIF_DANS_10PCT,
            "dans_20pct_min": OBJECTIF_DANS_20PCT,
            "atteint_10pct": principal["dans_10pct"] >= OBJECTIF_DANS_10PCT,
            "atteint_20pct": principal["dans_20pct"] >= OBJECTIF_DANS_20PCT,
            "atteint": principal["dans_10pct"] >= OBJECTIF_DANS_10PCT
                       and principal["dans_20pct"] >= OBJECTIF_DANS_20PCT,
        },
        "classement_communes": classement,
        "_par_commune": par_commune,
    }


def _ecrire_rapport(res: dict, sortie: Path) -> None:
    p, c, o = res["principal"], res["complementaire_sans_filtre_ml"], res["objectif"]
    ok = lambda b: "atteint" if b else "**non atteint**"
    libelles = {"fiable": "Fiable (≤ 10 %)", "indicative": "Indicative (10–20 %)",
                "a_completer": "À compléter (> 20 %)",
                "donnees_insuffisantes": f"Données insuffisantes (< {MIN_VENTES_COMMUNE} ventes)"}
    lignes = [
        f"# Résultats du protocole — test {res['periodes']['test'][0]} → {res['periodes']['test'][1]}",
        "",
        f"Protocole : [`protocole_evaluation.md`](protocole_evaluation.md) · "
        f"mesuré le {res['mesure_le']} · commit `{res['commit']}`",
        "",
        "| Jeu | Période | Ventes |", "|---|---|---:|",
        f"| Entraînement | {res['periodes']['train'][0]} → {res['periodes']['train'][1]} | {res['n_train']:,} |",
        f"| Validation (arrêt anticipé) | {res['periodes']['validation'][0]} → {res['periodes']['validation'][1]} | {res['n_validation']:,} |",
        f"| Test (mesure unique) | {res['periodes']['test'][0]} → {res['periodes']['test'][1]} | {p['n']:,} |",
        "",
        f"Arbres retenus sur la validation : {res['n_arbres']}.",
        "",
        "## Objectif global",
        "",
        "| Critère | Seuil fixé | Mesuré | Résultat |", "|---|---:|---:|---|",
        f"| Part à ±10 % | ≥ {o['dans_10pct_min']:.0f} % | {p['dans_10pct']} % | {ok(o['atteint_10pct'])} |",
        f"| Part à ±20 % | ≥ {o['dans_20pct_min']:.0f} % | {p['dans_20pct']} % | {ok(o['atteint_20pct'])} |",
        "",
        f"**Objectif global : {'atteint' if o['atteint'] else 'non atteint'}.** MAPE : {p['mape']} %.",
        "",
        "Mesure complémentaire, sans le filtre d'outliers ML (addendum 6 bis) : "
        f"{c['n']:,} ventes, MAPE {c['mape']} %, {c['dans_10pct']} % à ±10 %, "
        f"{c['dans_20pct']} % à ±20 %.",
        "",
        "## Classement des communes",
        "",
        "| Classe | Communes | Part des ventes de test | MAPE dans la classe |",
        "|---|---:|---:|---:|",
    ]
    for cle, lib in libelles.items():
        v = res["classement_communes"][cle]
        m = f"{v['mape_dans_classe']} %" if v["mape_dans_classe"] is not None else "—"
        lignes.append(f"| {lib} | {v['communes']} | {v['part_ventes']} % | {m} |")
    sortie.with_suffix(".md").write_text("\n".join(lignes) + "\n", encoding="utf-8")


def main() -> None:
    parseur = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parseur.add_argument("--test-debut", required=True, help="AAAA-MM")
    parseur.add_argument("--test-fin", required=True, help="AAAA-MM")
    args = parseur.parse_args()

    res = evaluer(args.test_debut, args.test_fin)
    par_commune = res.pop("_par_commune")
    sortie = Path("docs") / f"resultats_protocole_{args.test_debut}_{args.test_fin}"
    res["communes"] = {
        r.code_commune: {"mape": round(r.mape, 2), "n": int(r.n), "classe": r.classe}
        for r in par_commune.itertuples()
    }
    sortie.with_suffix(".json").write_text(json.dumps(res, ensure_ascii=False, indent=2), encoding="utf-8")
    _ecrire_rapport(res, sortie)
    print(sortie.with_suffix(".md").read_text(encoding="utf-8"))


if __name__ == "__main__":
    main()
