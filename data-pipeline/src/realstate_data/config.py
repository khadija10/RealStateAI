"""
Chargement centralisé de la configuration.

Principe : `config/settings.yaml` est l'unique source de vérité. Aucun module
du pipeline ne lit un chemin ou un seuil ailleurs qu'ici. Cela rend chaque
décision de nettoyage inspectable dans un seul fichier, ce qui est exactement
ce qu'un jury demande à voir.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from datetime import datetime
from functools import lru_cache
from pathlib import Path
from typing import Any

import yaml
from dotenv import load_dotenv

load_dotenv()

# Racine du dépôt : config.py est dans data-pipeline/src/realstate_data/,
# on remonte donc de 4 niveaux. Rend le pipeline exécutable depuis n'importe
# quel répertoire courant (indispensable pour les notebooks et la CI).
REPO_ROOT = Path(__file__).resolve().parents[3]
SETTINGS_PATH = REPO_ROOT / "data-pipeline" / "config" / "settings.yaml"

# Départements attendus pour l'Île-de-France ; sert de garde-fou de saisie.
DEPARTEMENTS_IDF = {"75", "77", "78", "91", "92", "93", "94", "95"}

# Premier millésime publié en open data par la DGFiP. Avant cette date,
# aucune donnée n'existe : autant le dire tout de suite plutôt que de laisser
# l'utilisateur découvrir 40 erreurs 404 puis un plantage incompréhensible.
MILLESIME_MIN = 2014


@dataclass(frozen=True)
class Chemins:
    """Chemins absolus des couches de données (bronze / silver / gold)."""

    raw: Path
    interim: Path
    processed: Path
    external: Path
    samples: Path

    def creer_dossiers(self) -> None:
        """Crée les dossiers manquants ; sans effet s'ils existent déjà."""
        for chemin in (self.raw, self.interim, self.processed,
                       self.external, self.samples):
            chemin.mkdir(parents=True, exist_ok=True)


@dataclass(frozen=True)
class Settings:
    """Vue typée de settings.yaml."""

    projet: str
    departements: tuple[str, ...]
    millesimes: tuple[int, ...]
    chemins: Chemins
    ingestion: dict[str, Any] = field(default_factory=dict)
    execution: dict[str, Any] = field(default_factory=dict)
    nettoyage: dict[str, Any] = field(default_factory=dict)
    qualite: dict[str, Any] = field(default_factory=dict)
    enrichissement: dict[str, Any] = field(default_factory=dict)

    def valider(self) -> None:
        """Échoue vite et bruyamment si la config est incohérente."""
        inconnus = set(self.departements) - DEPARTEMENTS_IDF
        if inconnus:
            raise ValueError(
                f"Départements hors périmètre Île-de-France : {sorted(inconnus)}. "
                "Élargis DEPARTEMENTS_IDF si le périmètre change volontairement."
            )
        if not all(len(d) == 2 and d.isdigit() for d in self.departements):
            raise ValueError("Un code département doit être une chaîne de 2 chiffres.")
        if not self.millesimes:
            raise ValueError("Aucun millésime configuré.")

        annee_courante = datetime.now().year
        hors_plage = [m for m in self.millesimes
                      if not (MILLESIME_MIN <= m <= annee_courante)]
        if hors_plage:
            raise ValueError(
                f"Millésimes hors plage disponible : {hors_plage}. "
                f"DVF est publié de {MILLESIME_MIN} à aujourd'hui. "
                f"Note : le millésime de l'année en cours et souvent celui de "
                f"l'année précédente ne sont pas encore publiés — la DGFiP "
                f"diffuse en avril et octobre. Corrige 'millesimes' dans "
                f"config/settings.yaml."
            )
        if not all(isinstance(m, int) for m in self.millesimes):
            raise ValueError("Un millésime doit être un entier, sans guillemets.")


@lru_cache(maxsize=1)
def charger_settings(chemin: Path | None = None) -> Settings:
    """
    Lit settings.yaml et renvoie un objet Settings validé.

    Le résultat est mis en cache : le YAML n'est lu qu'une fois par exécution.
    La variable d'environnement REALSTATE_DATA_ROOT permet de déporter les
    données sur un autre disque sans toucher au code ni au YAML.
    """
    chemin = chemin or SETTINGS_PATH
    with open(chemin, encoding="utf-8") as fichier:
        brut = yaml.safe_load(fichier)

    racine_data = Path(os.getenv("REALSTATE_DATA_ROOT", REPO_ROOT / "data"))
    if not racine_data.is_absolute():
        racine_data = (REPO_ROOT / racine_data).resolve()

    # Les chemins du YAML sont relatifs au dépôt ; on ne garde que le nom de
    # feuille pour les rebaser sur racine_data.
    chemins = Chemins(
        **{cle: racine_data / Path(valeur).name
           for cle, valeur in brut["chemins"].items()}
    )

    settings = Settings(
        projet=brut["projet"],
        departements=tuple(brut["perimetre"]["departements"]),
        millesimes=tuple(brut["perimetre"]["millesimes"]),
        chemins=chemins,
        ingestion=brut.get("ingestion", {}),
        execution=brut.get("execution", {}),
        nettoyage=brut.get("nettoyage", {}),
        qualite=brut.get("qualite", {}),
        enrichissement=brut.get("enrichissement", {}),
    )
    settings.valider()
    return settings


if __name__ == "__main__":
    s = charger_settings()
    print(f"Projet        : {s.projet}")
    print(f"Départements  : {', '.join(s.departements)}")
    print(f"Millésimes    : {', '.join(map(str, s.millesimes))}")
    print(f"Dossier brut  : {s.chemins.raw}")
    print(f"Moteur        : {s.execution.get('moteur')} "
          f"({s.execution.get('memory_limit')})")
