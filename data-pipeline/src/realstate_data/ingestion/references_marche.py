"""
Références de marché hors DVF : historique long des prix et loyers d'annonce.

POURQUOI
DVF ne couvre que cinq années (2021-2025), dont une crise. C'est trop court
pour dire quelque chose d'une revente dans dix ans. Deux sources publiques
comblent ce manque, sans modèle :
  1. Indices Notaires-INSEE des prix des logements anciens, trimestriels,
     par département d'Île-de-France depuis 1992 (75, 92, 93, 94) ou 1996.
     Ils servent à mesurer, sur toutes les périodes passées de même durée,
     combien de fois les prix ont progressé d'au moins un rythme donné.
  2. « Carte des loyers » (ANIL / ministère du Logement), loyer d'annonce
     prédit au m², charges comprises, par commune. Il sert à chiffrer ce que
     coûterait la location d'un bien équivalent.

SORTIES (petits JSON versionnés, lus par le backend au démarrage)
  data/samples/indices_prix_insee.json
  data/samples/loyers_anil.json

Usage : python -m realstate_data.ingestion.references_marche
"""

from __future__ import annotations

import csv
import io
import json
import re
from datetime import datetime, timezone
from pathlib import Path

import requests

DEPARTEMENTS = ("75", "77", "78", "91", "92", "93", "94", "95")

# Série CVS, base 100 en 2015. Paris n'a pas d'indice « maisons ».
URL_INSEE = (
    "https://bdm.insee.fr/series/sdmx/data/IPLA-IPLNA-2015/"
    "T.IPLA_A+IPLA_M.INDICE." + "+".join("D" + d for d in DEPARTEMENTS) + ".SO.CVS.2015.FALSE"
)
TYPES_INSEE = {"IPLA_A": "apartment", "IPLA_M": "house"}

MILLESIME_LOYERS = 2025
URLS_ANIL = {
    "apartment": "https://static.data.gouv.fr/resources/carte-des-loyers-indicateurs-de-loyers-dannonce-par-commune-en-2025/20251211-145010/pred-app-mef-dhup.csv",
    "house": "https://static.data.gouv.fr/resources/carte-des-loyers-indicateurs-de-loyers-dannonce-par-commune-en-2025/20251211-145039/pred-mai-mef-dhup.csv",
}

SORTIE = Path(__file__).resolve().parents[4] / "data" / "samples"


def indices_insee() -> dict:
    xml = requests.get(URL_INSEE, timeout=120).text
    series: dict = {}
    for attrs, corps in re.findall(r"<Series ([^>]*)>(.*?)</Series>", xml, re.S):
        a = dict(re.findall(r'(\w+)="([^"]*)"', attrs))
        obs = []
        for o in re.findall(r"<Obs ([^>]*)/>", corps):
            v = dict(re.findall(r'(\w+)="([^"]*)"', o))
            if v.get("OBS_VALUE"):
                obs.append((v["TIME_PERIOD"], float(v["OBS_VALUE"])))
        obs.sort()
        dep = a["REF_AREA"].removeprefix("D")
        series.setdefault(dep, {})[TYPES_INSEE[a["INDICATEUR"]]] = {
            "debut": obs[0][0], "fin": obs[-1][0], "idbank": a.get("IDBANK"),
            "valeurs": [v for _, v in obs],
        }
    return {"source": "Indices Notaires-INSEE des prix des logements anciens, CVS, base 100 en 2015",
            "url": URL_INSEE, "genere_le": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "series": series}


def loyers_anil() -> dict:
    communes: dict = {}
    for typ, url in URLS_ANIL.items():
        texte = requests.get(url, timeout=120).content.decode("cp1252")
        for r in csv.DictReader(io.StringIO(texte), delimiter=";"):
            if r["DEP"] not in DEPARTEMENTS:
                continue
            num = lambda k: round(float(r[k].replace(",", ".")), 2)
            communes.setdefault(r["INSEE_C"], {})[typ] = {
                "m2": num("loypredm2"), "bas": num("lwr.IPm2"), "haut": num("upr.IPm2"),
                # « commune » : estimé sur les annonces de la commune ; « maille » : sur un
                # regroupement de communes voisines, faute d'annonces suffisantes.
                "niveau": r["TYPPRED"], "annonces": int(r["nbobs_com"]),
            }
    return {"source": f"Carte des loyers {MILLESIME_LOYERS} (ANIL, ministère du Logement) — loyer d'annonce charges comprises, €/m²/mois",
            "millesime": MILLESIME_LOYERS, "urls": URLS_ANIL,
            "genere_le": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "communes": communes}


def main() -> None:
    SORTIE.mkdir(parents=True, exist_ok=True)
    for nom, f in (("indices_prix_insee.json", indices_insee), ("loyers_anil.json", loyers_anil)):
        donnees = f()
        (SORTIE / nom).write_text(json.dumps(donnees, ensure_ascii=False, separators=(",", ":")))
        print(f"{nom} : {(SORTIE / nom).stat().st_size // 1024} Ko")


if __name__ == "__main__":
    main()
