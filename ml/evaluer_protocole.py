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


def _transformations(config: dict):
    """Cible apprise (log ou brute) et retour à l'échelle des prix."""
    if config.get("target_transform") == "log":
        return np.log, np.exp
    return (lambda v: v), (lambda v: v)


def _periode(debut: str, fin: str) -> tuple[pd.Period, pd.Period]:
    return pd.Period(debut, "M"), pd.Period(fin, "M")


def _charger_gold_brut(config: dict) -> pd.DataFrame:
    """Gold sans le filtre ML, pour pouvoir publier la mesure complémentaire."""
    gold_path = Path(config["data"]["gold_path"])
    source = f"read_parquet('{gold_path}/**/*.parquet', hive_partitioning=true)"
    # Seules les colonnes utiles sont lues (features du modèle, entrées des features
    # calculées, cible et période) : le gold complet (66 colonnes) dépasse la mémoire
    # disponible d'une petite machine. Mêmes lignes, mêmes valeurs.
    feats = config["features"]
    utiles = set(feats["numeric"]) | set(feats["categorical"]) | set(feats["boolean"]) | {
        "prix_m2", "prix_m2_reference_12m", "date_mutation", "annee", "code_commune", "code_departement",
        "code_type_local", "surface_bati", "nb_pieces", "dpe_classe", "nb_ventes_commune_12m",
        "nb_ventes_dept_12m", "prix_m2_median_dept_12m", "prix_m2_median_local_12m", "valeur_fonciere"}
    presentes = [c for c in duckdb.sql(f"DESCRIBE SELECT * FROM {source}").df()["column_name"] if c in utiles]
    df = duckdb.sql(f"""
        SELECT {", ".join(presentes)} FROM {source}
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


def _jeux(config: dict, test_debut: str, test_fin: str):
    debut, fin = _periode(test_debut, test_fin)
    val_debut = debut - MOIS_VALIDATION
    filtre = _filtrer_outliers(_charger_gold_brut(config))
    train_df = filtre[filtre["periode"] < val_debut]
    val_df = filtre[(filtre["periode"] >= val_debut) & (filtre["periode"] < debut)]
    test_df = filtre[(filtre["periode"] >= debut) & (filtre["periode"] <= fin)]
    cat_dtypes = construire_cat_dtypes(filtre, config["features"])
    jeux = [preparer_features(d, config, cat_dtypes) for d in (train_df, val_df, test_df)]
    sw_cfg = config.get("sample_weights", {})
    poids = train_df["annee"].map({int(k): v for k, v in sw_cfg.items()}).fillna(1.0).values
    return jeux, poids, val_df, test_df


def _corrections_conformes(y: np.ndarray, bas: np.ndarray, haut: np.ndarray,
                           classes: np.ndarray, cible: float = 0.85) -> dict:
    """CQR par classe, en échelle log — même calcul que ml/train.py (_calibrer)."""
    score = np.maximum(np.log(bas) - np.log(y), np.log(y) - np.log(haut))
    corrections = {}
    for c in np.unique(classes):
        s = np.sort(score[classes == c])
        corrections[c] = float(s[min(int(np.ceil((len(s) + 1) * cible)) - 1, len(s) - 1)])
    return corrections


def evaluer_fourchette(test_debut: str, test_fin: str, config_path: str = "ml/config.yaml",
                       version: str = "") -> dict:
    """Section 6 ter : couverture et largeur de la fourchette q7,5–q92,5.

    Modèle en log (v2) : la fourchette mesurée est la fourchette CALIBRÉE,
    celle qu'affiche l'application (section 8)."""
    config = charger_config(config_path)
    resultats = Path("docs") / f"resultats_protocole_{version}{test_debut}_{test_fin}.json"
    classes = {k: v["classe"] for k, v in json.loads(resultats.read_text())["communes"].items()}

    jeux, poids, val_df, test_df = _jeux(config, test_debut, test_fin)
    (X_train, y_train), (X_val, y_val), (X_test, y_test) = jeux
    params = dict(config["lightgbm"])
    early_stopping = params.pop("early_stopping_rounds", 50)
    params.pop("verbose", None)
    model = lgb.LGBMRegressor(**params, verbose=-1)
    f, inv = _transformations(config)
    model.fit(X_train, f(y_train), sample_weight=poids, eval_set=[(X_val, f(y_val))],
              callbacks=[lgb.early_stopping(early_stopping, verbose=False)])
    n_arbres = int(model.best_iteration_)
    y_pred = inv(model.predict(X_test))
    # Contrôle de reproductibilité : doit redonner la MAPE de la mesure principale
    mape_controle = round(float(_erreurs(y_test.values, y_pred).mean()), 2)

    bornes, bornes_val = {}, {}
    for alpha in (0.075, 0.925):
        q = lgb.LGBMRegressor(**{**params, "objective": "quantile", "metric": "quantile",
                                 "alpha": alpha, "n_estimators": n_arbres}, verbose=-1)
        q.fit(X_train, f(y_train), sample_weight=poids)
        bornes[alpha] = inv(q.predict(X_test))
        bornes_val[alpha] = inv(q.predict(X_val))
    bas, haut = np.minimum(bornes[0.075], bornes[0.925]), np.maximum(bornes[0.075], bornes[0.925])

    brute = None
    if config.get("target_transform") == "log":
        # Calibration sur la validation : classes des communes établies sur
        # la validation, comme en production (le test n'y entre pas).
        ape_val = _erreurs(y_val.values, inv(model.predict(X_val)))
        loc = pd.DataFrame({"c": val_df["code_commune"].values, "ape": ape_val}).groupby("c")["ape"].agg(["mean", "count"])
        classe_val = {c: _classe(r["mean"], r["count"]) for c, r in loc.iterrows()}
        cl_val = val_df["code_commune"].map(classe_val).fillna("donnees_insuffisantes").values
        bas_v = np.minimum(bornes_val[0.075], bornes_val[0.925])
        haut_v = np.maximum(bornes_val[0.075], bornes_val[0.925])
        corr = _corrections_conformes(y_val.values, bas_v, haut_v, cl_val)
        cl_test = test_df["code_commune"].map(classe_val).fillna("donnees_insuffisantes").values
        d = np.array([corr.get(c, corr.get("donnees_insuffisantes", 0.0)) for c in cl_test])
        brute = {"couverture": round(float(((y_test.values >= bas) & (y_test.values <= haut)).mean() * 100), 1),
                 "largeur_mediane": round(float(np.median((haut - bas) / y_pred * 100)), 1)}
        bas, haut = bas * np.exp(-d), haut * np.exp(d)

    df = pd.DataFrame({
        "classe": test_df["code_commune"].map(classes).fillna("donnees_insuffisantes").values,
        "dedans": (y_test.values >= bas) & (y_test.values <= haut),
        "largeur": (haut - bas) / y_pred * 100,
    })
    def _resume(d):
        return {"n": int(len(d)), "couverture": round(float(d["dedans"].mean() * 100), 1),
                "largeur_mediane": round(float(d["largeur"].median()), 1)}
    par_classe = {c: _resume(d) for c, d in df.groupby("classe")}
    globale = _resume(df)
    classes_affichees = [c for c in ("fiable", "indicative", "a_completer") if c in par_classe]
    criteres = {
        "couverture_globale": globale["couverture"] >= 80.0,
        "couverture_par_classe": all(par_classe[c]["couverture"] >= 80.0 for c in classes_affichees),
        "largeur_mediane": globale["largeur_mediane"] <= 30.0,
    }
    return {"mesure_le": datetime.now().strftime("%Y-%m-%dT%H:%M:%S"),
            "mape_controle": mape_controle, "n_arbres": n_arbres,
            "fourchette": "calibrée (CQR sur la validation)" if brute else "brute",
            "globale": globale, "par_classe": par_classe,
            "fourchette_brute_avant_calibration": brute,
            "criteres": criteres, "tenue": all(criteres.values())}


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
    f, inv = _transformations(config)
    model.fit(
        X_train, f(y_train),
        sample_weight=poids,
        eval_set=[(X_val, f(y_val))],
        callbacks=[lgb.early_stopping(early_stopping, verbose=False), lgb.log_evaluation(200)],
    )

    # Mesure unique sur le test
    ape = _erreurs(y_test.values, inv(model.predict(X_test)))
    ape_brut = _erreurs(y_brut.values, inv(model.predict(X_brut)))
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
    parseur.add_argument("--config", default="ml/config.yaml",
                         help="configuration du modèle à évaluer (par défaut, celle de production)")
    parseur.add_argument("--version", default="",
                         help="préfixe des fichiers de résultats, ex. v2_ (n'écrase pas une mesure précédente)")
    parseur.add_argument("--fourchette", action="store_true",
                         help="section 6 ter : couverture de la fourchette (après la mesure principale)")
    args = parseur.parse_args()

    if args.fourchette:
        res = evaluer_fourchette(args.test_debut, args.test_fin, config_path=args.config, version=args.version)
        sortie = Path("docs") / f"resultats_fourchette_{args.version}{args.test_debut}_{args.test_fin}.json"
        sortie.write_text(json.dumps(res, ensure_ascii=False, indent=2), encoding="utf-8")
        print(json.dumps(res, ensure_ascii=False, indent=2))
        return

    res = evaluer(args.test_debut, args.test_fin, config_path=args.config)
    par_commune = res.pop("_par_commune")
    sortie = Path("docs") / f"resultats_protocole_{args.version}{args.test_debut}_{args.test_fin}"
    if sortie.with_suffix(".json").exists():
        raise SystemExit(f"{sortie}.json existe déjà : mesure unique, choisir un autre --version")
    res["communes"] = {
        r.code_commune: {"mape": round(r.mape, 2), "n": int(r.n), "classe": r.classe}
        for r in par_commune.itertuples()
    }
    sortie.with_suffix(".json").write_text(json.dumps(res, ensure_ascii=False, indent=2), encoding="utf-8")
    _ecrire_rapport(res, sortie)
    print(sortie.with_suffix(".md").read_text(encoding="utf-8"))


if __name__ == "__main__":
    main()
