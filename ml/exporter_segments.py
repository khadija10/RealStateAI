"""Exporte les performances par segment (docs/scenarios_performance.md) en JSON
pour le backend, qui signale à l'utilisateur le segment difficile de son bien.

Aucune mesure nouvelle : les valeurs sont celles du modèle v2 sur le test
officiel (oct.–déc. 2025), découpé par segment sans rien régler.

    python -m ml.exporter_segments
"""
import json
import re
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
SOURCE = RACINE / "docs" / "scenarios_performance.md"
SORTIE = RACINE / "Backend" / "models" / "segments_performance.json"

# segment de l'application → (titre de section du .md, libellé de la ligne)
SEGMENTS = {
    "paris": ("Zone", "Paris"),
    "maison": ("Type", "Maison"),
    "petite_surface": ("Surface", "< 30 m²"),
    "grande_surface": ("Surface", "≥ 100 m²"),
    "dpe_inconnu": ("DPE", "Non"),
    "sans_vente_immeuble": ("immeuble", "Non"),
    "ensemble": ("Ensemble", "Toutes les ventes de test"),
}


def _nombre(txt: str) -> float:
    return float(re.sub(r"[^\d.,]", "", txt).replace(",", "."))


def lire(source: Path = SOURCE) -> dict:
    sections, courante = {}, None
    for ligne in source.read_text().splitlines():
        if ligne.startswith("#"):
            courante = ligne.lstrip("# ").strip()
            sections[courante] = {}
        elif ligne.startswith("|") and courante and not ligne.startswith("|---"):
            cases = [c.strip() for c in ligne.strip("|").split("|")]
            if cases[0] != "Segment" and len(cases) == 7:
                sections[courante][cases[0]] = {
                    "n": int(_nombre(cases[1])), "mape": _nombre(cases[3]),
                    "dans_10pct": _nombre(cases[5]), "dans_20pct": _nombre(cases[6]),
                }
    resultat = {}
    for cle, (motif, libelle) in SEGMENTS.items():
        section = next(s for t, s in sections.items() if motif.lower() in t.lower() and libelle in s)
        resultat[cle] = section[libelle]
    return resultat


if __name__ == "__main__":
    segments = lire()
    SORTIE.write_text(json.dumps({"source": "docs/scenarios_performance.md", "modele": "v2",
                                  "test": "2025-10 → 2025-12", "segments": segments},
                                 ensure_ascii=False, indent=2))
    print(json.dumps(segments, ensure_ascii=False, indent=1))
