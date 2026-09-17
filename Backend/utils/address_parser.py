"""Tout ce qui touche au TEXTE des localisations.

Deux responsabilités :
  1. `normalize_commune` : forme canonique d'un nom de commune.
     Le DVF écrit "PARIS 15", l'utilisateur tape "Paris 15e" ou "paris 15ème".
     Cette fonction est appliquée DES DEUX CÔTÉS (chargement du dataset ET
     requête entrante) — c'est la seule garantie que les deux se rencontrent.
  2. `parse_address` : extraire code postal et commune d'une adresse libre,
     utilisée en repli quand le champ commune est vide.
"""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass

# --------------------------------------------------------- normalisation

BIG_CITIES = ("paris", "lyon", "marseille")

# "paris 15", "paris 15e", "paris 15eme arrondissement", "paris 01"
_ARR_RE = re.compile(
    r"^(paris|lyon|marseille)\s*0*(\d{1,2})"
    r"(?:\s*(?:arrondissement|ieme|eme|er|e))*$"
)

_ABBREV = (
    (re.compile(r"^ste\b"), "sainte"),
    (re.compile(r"^st\b"), "saint"),
)


def strip_accents(value: str) -> str:
    decomposed = unicodedata.normalize("NFKD", value)
    return "".join(c for c in decomposed if not unicodedata.combining(c))


def normalize_commune(value: str | None) -> str:
    """Forme canonique d'un nom de commune.

    >>> normalize_commune("Paris 15ème")
    'paris 15'
    >>> normalize_commune("St-Denis")
    'saint denis'
    """
    if value is None:
        return ""
    text = strip_accents(str(value)).lower()
    text = re.sub(r"[^a-z0-9]+", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    if not text:
        return ""

    for pattern, replacement in _ABBREV:
        text = pattern.sub(replacement, text)

    arrondissement = _ARR_RE.match(text)
    if arrondissement:
        return f"{arrondissement.group(1)} {int(arrondissement.group(2)):02d}"
    return text


def city_root(commune_norm: str) -> str:
    """Racine "ville", pour élargir la recherche à tous les arrondissements.

    'paris 15' -> 'paris' ; 'versailles' -> 'versailles'
    """
    for city in BIG_CITIES:
        if commune_norm == city or commune_norm.startswith(city + " "):
            return city
    return commune_norm


# ------------------------------------------------------------- adresse

# Bloc de 5 chiffres non collé à d'autres chiffres.
CP_REGEX = re.compile(r"(?<!\d)(\d{5})(?!\d)")


@dataclass
class ParsedAddress:
    raw: str
    code_postal: str | None
    dep: str | None
    commune: str | None
    commune_norm: str


def parse_address(address: str | None) -> ParsedAddress:
    """Découpe "10 Rue de Rivoli, 75001 Paris" en (75001, Paris)."""
    raw = (address or "").strip()
    if not raw:
        return ParsedAddress("", None, None, None, "")

    # On retient le DERNIER code postal : un numéro de rue à 5 chiffres
    # (rare mais existant) se trouve toujours avant celui de la commune.
    matches = list(CP_REGEX.finditer(raw))
    code_postal = matches[-1].group(1) if matches else None
    dep = code_postal[:2] if code_postal else None

    commune: str | None = None
    if code_postal:
        commune = raw[matches[-1].end():].strip(" ,-\t") or None

    if not commune and "," in raw:
        tail = CP_REGEX.sub("", raw.rsplit(",", 1)[-1])
        commune = tail.strip(" ,-\t") or None

    if not commune and not code_postal:
        # Ni code postal ni virgule : la saisie est probablement déjà une commune.
        commune = raw

    return ParsedAddress(
        raw=raw,
        code_postal=code_postal,
        dep=dep,
        commune=commune,
        commune_norm=normalize_commune(commune),
    )