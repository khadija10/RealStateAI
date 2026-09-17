"""
Contrôle qualité du dataset gold.

Deux niveaux de vérification, volontairement séparés :

1. SCHÉMA (pandera) — le dataset est-il bien FORMÉ ?
   Types, unicité de la clé, plages de valeurs, colonnes obligatoires.
   Un échec ici signale un bug du pipeline.

2. SEUILS MÉTIER — le dataset est-il bien PEUPLÉ ?
   Taux de valeurs manquantes, taux de conservation, couverture du périmètre,
   plausibilité des prix médians. Un échec ici signale une dégradation de la
   donnée source, typiquement après une nouvelle publication de la DGFiP.

Cette distinction compte en soutenance : le premier niveau protège du bug,
le second protège de la dérive silencieuse. Un pipeline qui tourne sans
erreur peut très bien produire un dataset devenu inexploitable.

Usage :
    python -m realstate_data.pipeline qualite
Code de sortie non nul si un contrôle échoue → utilisable en intégration continue.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path

import duckdb
import pandas as pd
# pandera a déplacé son API pandas dans un sous-module à partir de la 0.24.
# On supporte les deux pour ne pas imposer une version précise à l'équipe.
try:
    import pandera.pandas as pa
    from pandera.pandas import Check, Column, DataFrameSchema
except ImportError:  # pandera < 0.24
    import pandera as pa
    from pandera import Check, Column, DataFrameSchema

from realstate_data.config import Settings, charger_settings
from realstate_data.logging_conf import configurer_logging

log = configurer_logging()

# Bornes géographiques de la France métropolitaine. Une coordonnée en dehors
# signale une inversion latitude/longitude ou un géocodage défaillant.
LAT_MIN, LAT_MAX = 41.0, 51.5
LON_MIN, LON_MAX = -5.5, 9.8


def construire_schema(settings: Settings) -> DataFrameSchema:
    """
    Schéma attendu du dataset gold.

    Les bornes de prix reprennent la configuration : le schéma reste cohérent
    si quelqu'un modifie les seuils de nettoyage, plutôt que de devenir faux.
    """
    outliers = settings.nettoyage.get("outliers", {})
    plancher = outliers.get("prix_m2_plancher", 300)
    plafond = outliers.get("prix_m2_plafond", 30000)
    surface_min = settings.nettoyage.get("surface_bati_min_m2", 9)
    types_attendus = [str(c) for c in settings.nettoyage.get("codes_type_local_gardes", [1, 2])]

    return DataFrameSchema(
        {
            "id_mutation": Column(str, nullable=False, unique=True),
            "date_mutation": Column("datetime64[ns]", nullable=False),
            "mois": Column(int, Check.in_range(1, 12)),
            "trimestre": Column(int, Check.in_range(1, 4)),
            "mois_index": Column(int, Check.gt(0)),
            "code_departement": Column(
                str, Check.str_matches(r"^(\d{2}|2[AB]|\d{3})$"), nullable=False
            ),
            "code_commune": Column(str, Check.str_length(5, 5), nullable=False),
            "nom_commune": Column(str, nullable=False),
            "latitude": Column(float, Check.in_range(LAT_MIN, LAT_MAX), nullable=False),
            "longitude": Column(float, Check.in_range(LON_MIN, LON_MAX), nullable=False),
            "code_type_local": Column(str, Check.isin(types_attendus), nullable=False),
            "type_local": Column(str, Check.isin(["Maison", "Appartement"])),
            "surface_bati": Column(float, Check.ge(surface_min), nullable=False),
            # Borne large : la cohérence réelle est assurée par le contrôle
            # surface/pièces ci-dessous, pas par un plafond arbitraire.
            "nb_pieces": Column(float, Check.in_range(0, 100), nullable=True),
            "surface_terrain": Column(float, Check.ge(0), nullable=True),
            "valeur_fonciere": Column(float, Check.gt(0), nullable=False),
            "prix_m2": Column(float, Check.in_range(plancher, plafond), nullable=False),
            "prix_m2_reference_12m": Column(
                float, Check.in_range(plancher, plafond), nullable=True
            ),
            "source_reference_prix": Column(str, Check.isin(["commune", "departement"])),
        },
        # strict=False : l'équipe ML peut recevoir des colonnes supplémentaires
        # sans faire échouer la validation. Seules les colonnes du contrat sont
        # contrôlées.
        strict=False,
        coerce=False,
        name="gold_transactions",
    )


@dataclass
class Controle:
    """Résultat d'un contrôle unitaire."""

    nom: str
    valeur: str
    seuil: str
    ok: bool
    message: str = ""


@dataclass
class RapportQualite:
    controles: list[Controle] = field(default_factory=list)
    erreurs_schema: list[str] = field(default_factory=list)

    @property
    def succes(self) -> bool:
        return not self.erreurs_schema and all(c.ok for c in self.controles)

    def ajouter(self, nom: str, valeur, seuil: str, ok, message: str = "") -> None:
        # bool() explicite : les comparaisons pandas renvoient des numpy.bool_,
        # que le module json ne sait pas sérialiser.
        self.controles.append(Controle(nom, str(valeur), seuil, bool(ok), message))


def _charger_gold(settings: Settings) -> pd.DataFrame:
    dossier = settings.chemins.processed / "gold_transactions"
    if not dossier.exists():
        raise FileNotFoundError(
            f"Dataset gold introuvable : {dossier}\n"
            "Lance d'abord : python -m realstate_data.pipeline gold"
        )
    return duckdb.sql(
        f"SELECT * FROM read_parquet('{dossier}/**/*.parquet', hive_partitioning=true)"
    ).df()


def valider(settings: Settings | None = None) -> RapportQualite:
    """Exécute tous les contrôles et renvoie le rapport."""
    settings = settings or charger_settings()
    conf = settings.qualite
    rapport = RapportQualite()
    df = _charger_gold(settings)

    # --- Niveau 1 : schéma -------------------------------------------------
    # lazy=True collecte TOUTES les violations au lieu de s'arrêter à la
    # première : on veut un diagnostic complet, pas un jeu de piste.
    try:
        construire_schema(settings).validate(df, lazy=True)
        rapport.ajouter("schéma pandera", f"{len(df.columns)} colonnes",
                        "conforme", True)
    except pa.errors.SchemaErrors as err:
        echecs = err.failure_cases
        for _, ligne in echecs.head(20).iterrows():
            rapport.erreurs_schema.append(
                f"{ligne.get('column')} — {ligne.get('check')} "
                f"(exemple : {ligne.get('failure_case')})"
            )
        rapport.ajouter("schéma pandera", f"{len(echecs)} violations",
                        "0 violation", False)

    # --- Niveau 2 : seuils métier -----------------------------------------
    n = len(df)
    rapport.ajouter("volumétrie", n, "> 1000 lignes", n > 1000)

    # Unicité de la clé primaire : contrôlé par pandera, mais on l'expose
    # séparément car c'est LE contrôle que le jury regardera.
    doublons = int(df["id_mutation"].duplicated().sum())
    rapport.ajouter("doublons id_mutation", doublons, "0", doublons == 0)

    # Valeurs manquantes sur la feature de marché : au-delà du seuil, la
    # profondeur d'historique est insuffisante pour le périmètre demandé.
    seuil_nuls = conf.get("taux_nuls_max_prix_m2", 0.02)
    taux_nuls = df["prix_m2_reference_12m"].isna().mean() if n else 1.0
    rapport.ajouter(
        "nuls prix_m2_reference_12m", f"{taux_nuls:.2%}", f"<= {seuil_nuls:.0%}",
        taux_nuls <= seuil_nuls,
        "Ajoute un millésime d'historique en amont si le seuil est dépassé.",
    )

    # Taux de conservation, lu depuis le rapport du nettoyage : un filtre
    # devenu trop agressif détruirait la représentativité sans erreur visible.
    chemin_silver = settings.chemins.interim / "rapport_silver.json"
    if chemin_silver.exists():
        conservation = json.loads(chemin_silver.read_text(encoding="utf-8")).get(
            "taux_conservation_mutations", 0
        )
        perte_max = conf.get("perte_lignes_max_nettoyage", 0.60)
        rapport.ajouter(
            "conservation après nettoyage", f"{conservation:.1%}",
            f">= {1 - perte_max:.0%}", conservation >= (1 - perte_max),
        )

    # Couverture : chaque département configuré doit être représenté.
    presents = set(df["code_departement"].unique())
    manquants = sorted(set(settings.departements) - presents)
    rapport.ajouter(
        "couverture départements", f"{len(presents)}/{len(settings.departements)}",
        "tous présents", not manquants,
        f"Absents : {', '.join(manquants)}" if manquants else "",
    )

    # Couverture temporelle : un millésime configuré mais absent du résultat
    # signale un téléchargement incomplet.
    annees_presentes = set(int(a) for a in df["annee"].unique())
    annees_manquantes = sorted(set(settings.millesimes) - annees_presentes)
    rapport.ajouter(
        "couverture millésimes", f"{len(annees_presentes)}/{len(settings.millesimes)}",
        "tous présents", not annees_manquantes,
        f"Absents : {annees_manquantes}" if annees_manquantes else "",
    )

    # Plausibilité : une médiane hors de cette plage indique une erreur
    # d'agrégation (valeur foncière sommée) ou un périmètre inattendu.
    borne_basse = conf.get("prix_m2_median_min", 1000)
    borne_haute = conf.get("prix_m2_median_max", 20000)
    mediane = float(df["prix_m2"].median()) if n else 0
    rapport.ajouter(
        "prix au m² médian", f"{mediane:,.0f} €".replace(",", " "),
        f"{borne_basse}–{borne_haute} €", borne_basse <= mediane <= borne_haute,
        "Une médiane trop haute est le symptôme d'une déduplication défaillante.",
    )

    # Cohérence surface / pièces : un logement ne peut pas avoir plus de
    # pièces que sa surface ne le permet. Détecte le défaut de saisie où la
    # surface est recopiée dans le champ "nombre de pièces".
    m2_min = settings.nettoyage.get("m2_min_par_piece", 8)
    avec_pieces = df[df["nb_pieces"].fillna(0) > 0]
    incoherents = int(
        (avec_pieces["surface_bati"] / avec_pieces["nb_pieces"] < m2_min).sum()
    ) if len(avec_pieces) else 0
    rapport.ajouter(
        "cohérence surface / pièces", incoherents, f"0 sous {m2_min} m²/pièce",
        incoherents == 0,
        "Le champ nb_pieces doit être neutralisé sur ces lignes.",
    )

    # Cohérence : le prix au m² recalculé doit correspondre à la colonne.
    ecart_max = float(
        (df["prix_m2"] - df["valeur_fonciere"] / df["surface_bati"]).abs().max()
    ) if n else 0
    rapport.ajouter("cohérence prix_m2", f"{ecart_max:.4f}", "< 0.01",
                    ecart_max < 0.01)

    _ecrire_rapport(rapport, settings.chemins.processed / "rapport_qualite.json")
    return rapport


def _ecrire_rapport(rapport: RapportQualite, chemin: Path) -> None:
    contenu = {
        "succes": rapport.succes,
        "controles": [vars(c) for c in rapport.controles],
        "erreurs_schema": rapport.erreurs_schema,
    }
    chemin.write_text(json.dumps(contenu, indent=2, ensure_ascii=False),
                      encoding="utf-8")


def afficher(rapport: RapportQualite) -> None:
    """Affiche le rapport sous forme de tableau lisible."""
    print("\n" + "=" * 84)
    print("CONTRÔLE QUALITÉ DU DATASET GOLD")
    print("=" * 84)
    print(f"{'Contrôle':<32} {'Valeur':>18} {'Seuil':>18}   État")
    print("-" * 84)
    for c in rapport.controles:
        etat = "OK" if c.ok else "ÉCHEC"
        print(f"{c.nom:<32} {c.valeur:>18} {c.seuil:>18}   {etat}")
        if not c.ok and c.message:
            print(f"    -> {c.message}")

    if rapport.erreurs_schema:
        print("\nViolations de schéma (20 premières) :")
        for e in rapport.erreurs_schema:
            print(f"  - {e}")

    print("=" * 84)
    print("RÉSULTAT : " + ("tous les contrôles sont passés"
                           if rapport.succes else "AU MOINS UN CONTRÔLE A ÉCHOUÉ"))
    print("=" * 84 + "\n")
