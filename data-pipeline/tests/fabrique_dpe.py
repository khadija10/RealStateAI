"""
Génère des DPE synthétiques au format de l'API ADEME, avec vérité terrain.

Pour chaque vente de l'échantillon, on crée éventuellement :
  - le VRAI DPE du logement, à la même adresse, surface proche ;
  - des LEURRES : DPE d'appartements voisins dans le même immeuble, à la même
    adresse mais de surface nettement différente.

On garde la classe du vrai DPE : les tests vérifient ensuite que
l'appariement retrouve la bonne, et non celle d'un voisin. C'est le seul
moyen de mesurer la justesse de la méthode sans accès à l'API.
"""

from __future__ import annotations

import random
from pathlib import Path

import duckdb
import pandas as pd

# Correspondance entre l'écriture DVF (FANTOIR, abrégée) et l'écriture BAN
# (en toutes lettres) des voies de l'échantillon synthétique.
VOIES_BAN = {
    "RUE DE LA ROQUETTE": "Rue de la Roquette",
    "BD VOLTAIRE": "Boulevard Voltaire",
    "AV DE LA REPUBLIQUE": "Avenue de la République",
    "RUE ST MAUR": "Rue Saint-Maur",
    "RUE OBERKAMPF": "Rue Oberkampf",
    "AV PARMENTIER": "Avenue Parmentier",
    "RUE DE CHARONNE": "Rue de Charonne",
    "PL LEON BLUM": "Place Léon Blum",
    "RUE DE LA PAIX": "Rue de la Paix",
    "AV DU GAL LECLERC": "Avenue du Général Leclerc",
    "BD ST GERMAIN": "Boulevard Saint-Germain",
    "RUE DES MARTYRS": "Rue des Martyrs",
}

CLASSES = ["A", "B", "C", "D", "E", "F", "G"]
POIDS_CLASSES = [2, 5, 14, 30, 28, 13, 8]  # distribution proche du parc réel

# Types de chauffage réels (echantillon), pour le proxy d'état du bien.
TYPES_CHAUFFAGE = [
    "Chaudière fioul standard 1991-2015",
    "Chaudière gaz basse température",
    "Convecteur électrique NFC, NF** et NF***",
    "Réseau de chaleur isolé",
    "Pompe à chaleur air/eau",
]

# Déperditions d'enveloppe (W/K) par classe DPE : corrélées à la classe pour
# que le test synthétique reflète un déperditions_enveloppe_m2 plausible
# (une passoire F/G a une enveloppe nettement plus déperditive qu'un A/B).
DEPERDITION_PAR_M2_BASE = {"A": 0.8, "B": 1.0, "C": 1.3, "D": 1.7, "E": 2.2, "F": 2.8, "G": 3.5}


def generer_dpe(gold: Path, destination: Path, taux_couverture: float = 0.55,
                graine: int = 7) -> dict[str, str]:
    """
    Écrit un fichier DPE au format de l'API et renvoie la vérité terrain :
    {id_mutation: classe du vrai DPE}.
    """
    rng = random.Random(graine)
    ventes = duckdb.sql(f"""
        SELECT id_mutation, code_postal, adresse_numero, adresse_nom_voie,
               surface_bati, date_mutation, type_local, nom_commune
        FROM read_parquet('{gold}/**/*.parquet', hive_partitioning=true)
        WHERE adresse_nom_voie IS NOT NULL
    """).df()

    lignes: list[dict] = []
    verite: dict[str, str] = {}

    for vente in ventes.itertuples():
        if rng.random() > taux_couverture:
            continue
        voie = VOIES_BAN.get(vente.adresse_nom_voie)
        if voie is None:
            continue
        adresse = (f"{vente.adresse_numero} {voie} "
                   f"{vente.code_postal} {vente.nom_commune}")
        classe = rng.choices(CLASSES, weights=POIDS_CLASSES)[0]
        verite[vente.id_mutation] = classe

        # Le vrai DPE : surface habitable légèrement différente de la surface
        # bâtie DVF (les deux mesures ne coïncident jamais exactement).
        date = pd.Timestamp(vente.date_mutation) - pd.Timedelta(
            days=rng.randint(30, 400))
        lignes.append({
            "numero_dpe": f"2{rng.randint(10**11, 10**12 - 1)}",
            "etiquette_dpe": classe,
            "etiquette_ges": rng.choice(CLASSES),
            "surface_habitable_logement": round(
                vente.surface_bati * rng.uniform(0.96, 1.04), 1),
            "date_etablissement_dpe": date.date().isoformat(),
            "type_batiment": "maison" if vente.type_local == "Maison" else "appartement",
            "annee_construction": rng.randint(1900, 2015),
            "deperditions_enveloppe": round(
                DEPERDITION_PAR_M2_BASE[classe] * vente.surface_bati
                * rng.uniform(0.9, 1.1), 1),
            "type_generateur_chauffage_principal": rng.choice(TYPES_CHAUFFAGE),
            "adresse_ban": adresse,
            "code_postal_ban": vente.code_postal,
            "nom_commune_ban": vente.nom_commune,
        })

        # Leurres : les voisins de palier. Même adresse, surface très
        # différente, classe différente. Ce sont eux qui piégeraient une
        # jointure sur l'adresse seule.
        if vente.type_local == "Appartement":
            for _ in range(rng.randint(1, 3)):
                lignes.append({
                    "numero_dpe": f"2{rng.randint(10**11, 10**12 - 1)}",
                    "etiquette_dpe": rng.choice([c for c in CLASSES if c != classe]),
                    "etiquette_ges": rng.choice(CLASSES),
                    "surface_habitable_logement": round(
                        vente.surface_bati * rng.choice([
                            rng.uniform(0.35, 0.75), rng.uniform(1.30, 2.20)]), 1),
                    "date_etablissement_dpe": date.date().isoformat(),
                    "type_batiment": "appartement",
                    "annee_construction": rng.randint(1900, 2015),
                    "deperditions_enveloppe": round(rng.uniform(20, 150), 1),
                    "type_generateur_chauffage_principal": rng.choice(TYPES_CHAUFFAGE),
                    "adresse_ban": adresse,
                    "code_postal_ban": vente.code_postal,
                    "nom_commune_ban": vente.nom_commune,
                })

    destination.parent.mkdir(parents=True, exist_ok=True)
    pd.DataFrame(lignes).to_parquet(destination, index=False)
    return verite
