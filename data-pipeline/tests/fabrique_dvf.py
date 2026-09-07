"""
Génère un échantillon DVF synthétique réaliste pour les tests et la CI.

Il reproduit volontairement les pathologies de la vraie donnée :
  - mutations éclatées sur plusieurs lignes (lots, parcelles) ;
  - doublons stricts ;
  - ventes multi-biens (immeuble entier) ;
  - valeurs foncières nulles, surfaces à 0, lignes non géocodées ;
  - prix au m² aberrants.

Un test qui passe sur une donnée propre ne prouve rien : c'est le seul moyen
de vérifier que la déduplication et les filtres font vraiment leur travail.
"""

from __future__ import annotations

import gzip
import random
from datetime import date, timedelta
from pathlib import Path

COLONNES = [
    "id_mutation", "date_mutation", "numero_disposition", "nature_mutation",
    "valeur_fonciere", "adresse_numero", "adresse_nom_voie", "code_postal",
    "code_commune", "nom_commune", "code_departement", "id_parcelle",
    "code_type_local", "type_local", "surface_reelle_bati",
    "nombre_pieces_principales", "surface_terrain", "longitude", "latitude",
]

COMMUNES = {
    "75056": ("Paris", "75", "75011", 11000, 2.37, 48.86),
    "92044": ("Issy-les-Moulineaux", "92", "92130", 8000, 2.27, 48.82),
    "93066": ("Saint-Denis", "93", "93200", 4200, 2.36, 48.94),
    "77288": ("Melun", "77", "77000", 2800, 2.66, 48.54),
}


def _ligne(**kwargs) -> str:
    return ",".join(str(kwargs.get(c, "")) for c in COLONNES)


def generer(destination: Path, n_mutations: int = 1200, graine: int = 42,
            prefixe: str | None = None) -> Path:
    """
    Écrit un fichier .csv.gz au format DVF géolocalisées.

    `prefixe` rend les id_mutation uniques entre fichiers, comme dans la vraie
    donnée. Sans lui, deux fichiers généreraient les mêmes identifiants et
    l'agrégation les fusionnerait à tort en mutations multi-biens.
    """
    rng = random.Random(graine)
    prefixe = prefixe or destination.stem.split(".")[0]
    destination.parent.mkdir(parents=True, exist_ok=True)
    lignes = [",".join(COLONNES)]
    debut = date(2021, 1, 1)

    for i in range(n_mutations):
        code_commune = rng.choice(list(COMMUNES))
        nom, dep, cp, prix_ref, lon, lat = COMMUNES[code_commune]
        jour = debut + timedelta(days=rng.randint(0, 4 * 365))
        id_mut = f"{prefixe}-{i:06d}"

        # 8 % de natures de mutation hors périmètre (échange, adjudication...)
        nature = rng.choices(
            ["Vente", "Vente en l'état futur d'achèvement", "Echange",
             "Adjudication", "Expropriation"],
            weights=[80, 12, 3, 3, 2],
        )[0]

        code_type = rng.choices(["1", "2", "3"], weights=[25, 65, 10])[0]
        type_local = {"1": "Maison", "2": "Appartement", "3": "Dépendance"}[code_type]

        surface = max(9, int(rng.gauss(65, 28)))
        prix_m2 = max(500, rng.gauss(prix_ref, prix_ref * 0.22))
        valeur = round(surface * prix_m2, 2)

        # 3 % de ventes multi-biens (immeuble ou lot de plusieurs logements)
        nb_biens = rng.choices([1, 1, 1, 4, 9], weights=[92, 3, 2, 2, 1])[0]
        if nb_biens > 1:
            valeur = round(valeur * nb_biens * 0.85, 2)  # décote de bloc

        # 2 % de valeurs foncières manquantes
        if rng.random() < 0.02:
            valeur = ""
        # 1 % de prix aberrants (erreur de saisie : facteur 100)
        elif rng.random() < 0.01:
            valeur = round(valeur * 100, 2)

        geocode = rng.random() > 0.03  # 3 % de lignes non géocodées

        for bien in range(nb_biens):
            surface_bien = surface if bien == 0 else max(9, int(rng.gauss(60, 20)))
            if rng.random() < 0.02:
                surface_bien = 0  # 2 % de surfaces à 0
            parcelle = f"{code_commune}000AB{bien:04d}"
            # Chaque bien est réparti sur 1 à 3 lots -> autant de lignes
            # portant la MÊME valeur foncière : c'est le piège à dédoublonner.
            for lot in range(rng.randint(1, 3)):
                lignes.append(_ligne(
                    id_mutation=id_mut,
                    date_mutation=jour.isoformat(),
                    numero_disposition=1,
                    nature_mutation=nature,
                    valeur_fonciere=valeur,
                    adresse_numero=rng.randint(1, 150),
                    adresse_nom_voie="RUE DE LA PAIX",
                    code_postal=cp,
                    code_commune=code_commune,
                    nom_commune=nom,
                    code_departement=dep,
                    id_parcelle=parcelle,
                    code_type_local=code_type,
                    type_local=type_local,
                    surface_reelle_bati=surface_bien,
                    nombre_pieces_principales=max(1, surface_bien // 22),
                    surface_terrain=rng.choice(["", "", 120, 350]),
                    longitude=round(lon + rng.uniform(-0.05, 0.05), 6) if geocode else "",
                    latitude=round(lat + rng.uniform(-0.04, 0.04), 6) if geocode else "",
                ))
                # 1 % de doublons stricts
                if rng.random() < 0.01:
                    lignes.append(lignes[-1])

    with gzip.open(destination, "wt", encoding="utf-8") as f:
        f.write("\n".join(lignes) + "\n")
    return destination


if __name__ == "__main__":
    chemin = generer(Path("data/samples/dvf_echantillon.csv.gz"))
    print(f"Échantillon écrit : {chemin}")
