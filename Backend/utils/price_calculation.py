from dataclasses import dataclass
import pandas as pd

@dataclass
class PriceResult:
    estimated_price: float
    price_per_m2: float
    low: float
    high: float
    confidence: float
    n_transactions: int

def calculate_price(transactions: pd.DataFrame, surface_m2: float) -> PriceResult:
    n = len(transactions) if transactions is not None else 0
    if transactions is None or transactions.empty:
        raise ValueError("Aucune transaction similaire trouvée.")

    ppm2 = transactions["prix_au_m2"].dropna().astype(float)
    if ppm2.empty:
        raise ValueError("prix_au_m2 manquant.")

    median_ppm2 = float(ppm2.median())
    q25 = float(ppm2.quantile(0.25))
    q75 = float(ppm2.quantile(0.75))

    estimated = median_ppm2 * surface_m2
    low = q25 * surface_m2
    high = q75 * surface_m2

    # confiance simple: augmente jusqu’à 50 transactions
    confidence = min(1.0, max(0.2, n / 50.0))

    return PriceResult(
        estimated_price=estimated,
        price_per_m2=median_ppm2,
        low=low,
        high=high,
        confidence=confidence,
        n_transactions=n,
    )