"""Calcul de l'estimation à partir des transactions comparables.

Note méthodologique importante : Q25/Q75 n'est PAS un intervalle de confiance,
c'est un écart interquartile. Il décrit la dispersion des prix observés sur le
marché, pas l'incertitude de l'estimation. Le champ s'appelle donc `price_range`
et porte `basis: "interquartile"`. Le score `reliability`, lui, mesure bien la
qualité de l'échantillon.
"""

from __future__ import annotations

from dataclasses import dataclass

import pandas as pd


class NoComparableError(ValueError):
    """Levée quand l'échantillon ne permet aucun calcul."""


@dataclass
class PriceResult:
    estimated_price: float
    price_per_m2: float
    range_low: float
    range_high: float
    range_low_per_m2: float
    range_high_per_m2: float
    reliability: float  # 0..1
    n_transactions: int
    dispersion: float  # (Q75 - Q25) / médiane


def calculate_price(transactions: pd.DataFrame, surface_m2: float) -> PriceResult:
    if transactions is None or transactions.empty:
        raise NoComparableError("Aucune transaction similaire trouvée.")
    if surface_m2 <= 0:
        raise ValueError("La surface doit être strictement positive.")

    ppm2 = pd.to_numeric(transactions["prix_au_m2"], errors="coerce").dropna()
    ppm2 = ppm2[ppm2 > 0]
    if ppm2.empty:
        raise NoComparableError("Aucun prix au m² exploitable dans l'échantillon.")

    n = int(len(ppm2))
    median = float(ppm2.median())
    q25 = float(ppm2.quantile(0.25))
    q75 = float(ppm2.quantile(0.75))
    dispersion = (q75 - q25) / median if median > 0 else 1.0

    # Fiabilité = volume de l'échantillon (60 %) + homogénéité (40 %).
    volume_score = min(1.0, n / 40.0)
    homogeneity_score = max(0.0, 1.0 - min(dispersion, 1.0))
    reliability = round(0.6 * volume_score + 0.4 * homogeneity_score, 2)

    # Garde-fou : la jauge du frontend exige low < estimation < high.
    # Avec une seule transaction, Q25 == Q75 == médiane et le repère sortirait
    # de la règle graduée.
    if q75 - q25 < 1e-6:
        q25, q75 = median * 0.95, median * 1.05

    return PriceResult(
        estimated_price=round(median * surface_m2, 2),
        price_per_m2=round(median, 2),
        range_low=round(q25 * surface_m2, 2),
        range_high=round(q75 * surface_m2, 2),
        range_low_per_m2=round(q25, 2),
        range_high_per_m2=round(q75, 2),
        reliability=reliability,
        n_transactions=n,
        dispersion=round(dispersion, 3),
    )