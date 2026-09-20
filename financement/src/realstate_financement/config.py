"""
Chargement du barème réglementaire.

Comme pour le pipeline data : une seule source de vérité, un seul fichier,
et aucune valeur chiffrée en dur dans le code métier. Tout paramètre
contestable devant un jury doit être lisible dans config/bareme.yaml.
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Any

import yaml

RACINE = Path(__file__).resolve().parents[2]
CHEMIN_BAREME = RACINE / "config" / "bareme.yaml"


@lru_cache(maxsize=1)
def charger_bareme(chemin: Path | None = None) -> dict[str, Any]:
    """Lit le barème et le met en cache pour toute la durée d'exécution."""
    chemin = chemin or CHEMIN_BAREME
    with open(chemin, encoding="utf-8") as fichier:
        return yaml.safe_load(fichier)


def parametre(*cles: str, defaut: Any = None) -> Any:
    """
    Accès à un paramètre imbriqué : parametre("hcsf", "duree_max_annees").

    Évite d'écrire bareme["hcsf"]["duree_max_annees"] partout et renvoie le
    défaut plutôt que de lever une exception si la clé manque.
    """
    valeur: Any = charger_bareme()
    for cle in cles:
        if not isinstance(valeur, dict) or cle not in valeur:
            return defaut
        valeur = valeur[cle]
    return valeur
