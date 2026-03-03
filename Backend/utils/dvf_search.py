from dataclasses import dataclass
import pandas as pd
import numpy as np

@dataclass
class SearchConfig:
    surface_tolerance_ratio: float = 0.20  # +/- 20%
    min_transactions: int = 8
    max_transactions: int = 3000

def find_similar_properties(
    df: pd.DataFrame,
    commune: str,
    type_bien: str,
    surface_m2: float,
    config: SearchConfig = SearchConfig(),
) -> pd.DataFrame:
    if df is None or df.empty:
        return df

    commune_norm = (commune or "").strip().lower()
    type_norm = (type_bien or "").strip().lower()

    base = df[
        (df["commune_norm"] == commune_norm) &
        (df["type_bien_norm"] == type_norm)
    ]

    if base.empty:
        return base

    tol = config.surface_tolerance_ratio
    s_min = surface_m2 * (1 - tol)
    s_max = surface_m2 * (1 + tol)

    base = base[(base["surface_m2"] >= s_min) & (base["surface_m2"] <= s_max)]

    if base.empty:
        return base

    if len(base) > config.max_transactions:
        base = base.assign(surface_diff=np.abs(base["surface_m2"] - surface_m2)) \
                   .sort_values("surface_diff") \
                   .head(config.max_transactions)

    return base