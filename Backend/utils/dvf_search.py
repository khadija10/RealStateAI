"""Chargement du dataset DVF et recherche de transactions comparables.

Deux responsabilités :
  1. `load_dvf` / `prepare_index` : lecture du fichier produit par le pipeline
     et calcul UNE SEULE FOIS des colonnes normalisées. Les requêtes ne font
     ensuite que des comparaisons d'égalité et des filtres numériques.
  2. `search_comparables` : la cascade de repli. Le formulaire React impose
     trois contraintes — `rooms` est requis, `property_type` peut valoir
     "other", et une commune peu fournie ne doit pas se solder par un 404 sec.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from pathlib import Path

import pandas as pd

from utils.address_parser import city_root, normalize_commune

logger = logging.getLogger(__name__)


# ==========================================================================
#  1. CHARGEMENT
# ==========================================================================

# Alias tolérés : le pipeline peut évoluer sans casser l'API.
RENAME_MAP = {
    "Commune": "commune",
    "Surface reelle bati": "surface_m2",
    "Valeur fonciere": "prix_vente",
    "Code postal": "code_postal",
    "Date mutation": "date_mutation",
    "Nombre pieces principales": "nb_pieces",
}

REQUIRED_COLUMNS = ["commune", "type_bien", "surface_m2", "prix_vente", "prix_au_m2"]


def load_dvf(path: str | Path) -> pd.DataFrame:
    """Lit le dataset (.parquet de préférence, .csv accepté) et l'indexe."""
    path = Path(path)
    if path.suffix == ".parquet":
        df = pd.read_parquet(path)
    else:
        df = pd.read_csv(path, low_memory=False)

    df = df.rename(columns={k: v for k, v in RENAME_MAP.items() if k in df.columns})

    missing = [c for c in REQUIRED_COLUMNS if c not in df.columns]
    if missing:
        raise ValueError(f"Colonnes manquantes dans {path.name} : {missing}")

    df = prepare_index(df)
    logger.info("DVF chargé : %s lignes, %s communes", len(df), df["commune_norm"].nunique())
    return df


def prepare_index(df: pd.DataFrame) -> pd.DataFrame:
    """Ajoute les colonnes normalisées utilisées par la recherche."""
    df = df.copy()

    for col in ("surface_m2", "prix_vente", "prix_au_m2"):
        df[col] = pd.to_numeric(df[col], errors="coerce")
    df = df.dropna(subset=["surface_m2", "prix_au_m2"])

    if "nb_pieces" in df.columns:
        df["nb_pieces"] = pd.to_numeric(df["nb_pieces"], errors="coerce")
    else:
        df["nb_pieces"] = pd.NA

    df["commune_norm"] = df["commune"].astype(str).map(normalize_commune)
    df["ville_norm"] = df["commune_norm"].map(city_root)
    df["type_bien_norm"] = df["type_bien"].astype(str).str.strip().str.lower()

    if "dep" not in df.columns:
        if "code_postal" in df.columns:
            df["dep"] = df["code_postal"].astype(str).str.zfill(5).str[:2]
        else:
            df["dep"] = ""
    df["dep"] = df["dep"].astype(str).str.zfill(2)

    # Tri : améliore la localité mémoire des filtres par fenêtre de surface.
    return df.sort_values(["commune_norm", "type_bien_norm", "surface_m2"]).reset_index(drop=True)


def commune_display_names(df: pd.DataFrame) -> list[str]:
    """Libellés pour le datalist du formulaire React.

    On renvoie la casse native du DVF ("PARIS 01"), qui correspond au
    placeholder du champ commune. Une seule entrée par forme normalisée.
    """
    if df is None or df.empty:
        return []
    per_norm = df.groupby("commune_norm")["commune"].agg(
        lambda s: s.mode().iat[0] if not s.mode().empty else s.iat[0]
    )
    return sorted(per_norm.astype(str).unique().tolist())


# ==========================================================================
#  2. RECHERCHE
# ==========================================================================

# Types explorés en repli, dans l'ordre.
TYPE_FALLBACK: dict[str, list[str]] = {
    "apartment": [],
    "house": [],
    "studio": ["apartment"],
    # Bouton « Autre » du formulaire : on ne sait pas, on regarde les deux marchés.
    "other": ["apartment", "house"],
}


@dataclass(frozen=True)
class Profile:
    """Un palier d'assouplissement."""

    surface_tolerance: float
    rooms_tolerance: int | None  # None = critère « nombre de pièces » ignoré


# Du plus strict au plus large. On relâche le nombre de pièces avant d'élargir
# beaucoup la surface : deux 60 m² du même quartier se ressemblent davantage
# que deux 3-pièces de surfaces très différentes.
DEFAULT_PROFILES: tuple[Profile, ...] = (
    Profile(0.15, 0),
    Profile(0.15, 1),
    Profile(0.30, 1),
    Profile(0.30, None),
    Profile(0.50, None),
)


@dataclass(frozen=True)
class SearchConfig:
    profiles: tuple[Profile, ...] = DEFAULT_PROFILES
    min_transactions: int = 8
    max_transactions: int = 3000


@dataclass
class SearchOutcome:
    transactions: pd.DataFrame
    scope: str  # "commune" | "ville" | "departement" | "none"
    scope_value: str
    type_used: str
    surface_tolerance: float | None
    rooms_tolerance: int | None
    fallback_level: int  # nombre d'assouplissements appliqués ; 0 = match strict
    notes: list[str] = field(default_factory=list)

    @property
    def is_empty(self) -> bool:
        return self.transactions is None or self.transactions.empty


def _surface_window(base: pd.DataFrame, surface_m2: float, tolerance: float) -> pd.DataFrame:
    low = surface_m2 * (1 - tolerance)
    high = surface_m2 * (1 + tolerance)
    return base[(base["surface_m2"] >= low) & (base["surface_m2"] <= high)]


def _rooms_window(base: pd.DataFrame, rooms: int, tolerance: int) -> pd.DataFrame:
    if "nb_pieces" not in base.columns:
        return base
    pieces = base["nb_pieces"]
    # Les lignes sans nombre de pièces connu sont conservées plutôt qu'écartées.
    return base[pieces.between(rooms - tolerance, rooms + tolerance) | pieces.isna()]


def _cap(base: pd.DataFrame, surface_m2: float, max_n: int) -> pd.DataFrame:
    """Garde les N transactions les plus proches en surface."""
    if len(base) <= max_n:
        return base
    distances = (base["surface_m2"] - surface_m2).abs()
    return base.loc[distances.nsmallest(max_n).index]


def search_comparables(
    df: pd.DataFrame,
    commune_norm: str,
    type_bien: str,
    surface_m2: float,
    rooms: int | None = None,
    dep: str | None = None,
    config: SearchConfig = SearchConfig(),
) -> SearchOutcome:
    """Cherche des comparables en élargissant progressivement.

    Ordre des boucles : périmètre (commune -> ville -> département), puis type
    de bien, puis paliers surface/pièces. Le périmètre est donc élargi EN
    DERNIER, ce qui est voulu : pour un prix au m², la localisation compte
    davantage que la précision de la surface.

    Le premier palier atteignant `min_transactions` gagne ; à défaut on renvoie
    le meilleur résultat non vide rencontré.
    """
    empty = SearchOutcome(
        transactions=df.iloc[0:0] if df is not None else pd.DataFrame(),
        scope="none",
        scope_value="",
        type_used=type_bien,
        surface_tolerance=None,
        rooms_tolerance=None,
        fallback_level=99,
        notes=["aucun comparable trouvé"],
    )
    if df is None or df.empty or not commune_norm:
        return empty

    requested_type = type_bien
    types = [type_bien] if type_bien in {"apartment", "house"} else []
    types += [t for t in TYPE_FALLBACK.get(type_bien, []) if t not in types]
    if not types:
        types = ["apartment", "house"]

    scopes: list[tuple[str, str, pd.Series]] = [
        ("commune", commune_norm, df["commune_norm"] == commune_norm),
    ]
    root = city_root(commune_norm)
    if root != commune_norm:
        scopes.append(("ville", root, df["ville_norm"] == root))
    if dep:
        scopes.append(("departement", dep, df["dep"] == dep))

    best_partial: SearchOutcome | None = None
    strictest = config.profiles[0]

    for scope_name, scope_value, scope_mask in scopes:
        scoped = df[scope_mask]
        if scoped.empty:
            continue

        for type_used in types:
            typed = scoped[scoped["type_bien_norm"] == type_used]
            if typed.empty:
                continue

            for profile in config.profiles:
                window = _surface_window(typed, surface_m2, profile.surface_tolerance)
                if rooms and profile.rooms_tolerance is not None:
                    window = _rooms_window(window, rooms, profile.rooms_tolerance)
                if window.empty:
                    continue

                notes: list[str] = []
                if scope_name != "commune":
                    label = "ville entière" if scope_name == "ville" else "département"
                    notes.append(f"périmètre élargi : {label} ({scope_value})")
                if type_used != requested_type:
                    notes.append(f"type de bien replié sur « {type_used} »")
                if profile.surface_tolerance != strictest.surface_tolerance:
                    pct = int(profile.surface_tolerance * 100)
                    notes.append(f"tolérance de surface élargie à ±{pct} %")
                if rooms and profile.rooms_tolerance is None:
                    notes.append("critère du nombre de pièces ignoré")
                elif rooms and profile.rooms_tolerance != strictest.rooms_tolerance:
                    notes.append(f"nombre de pièces élargi à ±{profile.rooms_tolerance}")

                outcome = SearchOutcome(
                    transactions=_cap(window, surface_m2, config.max_transactions),
                    scope=scope_name,
                    scope_value=scope_value,
                    type_used=type_used,
                    surface_tolerance=profile.surface_tolerance,
                    rooms_tolerance=profile.rooms_tolerance,
                    fallback_level=len(notes),
                    notes=notes,
                )

                if len(window) >= config.min_transactions:
                    return outcome
                if best_partial is None:
                    best_partial = outcome

    return best_partial or empty