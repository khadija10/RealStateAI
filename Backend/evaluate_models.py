import os
from pathlib import Path

import pandas as pd
from sklearn.metrics import mean_absolute_error, mean_squared_error
from sklearn.model_selection import train_test_split

from train_model import load_dataset, prepare_data, train_model


BACKEND_DIR = Path(__file__).resolve().parent
DEFAULT_DVF_PATH = BACKEND_DIR / "Data pipeline" / "outputs" / "DVF_clean_2023_2024.csv"


def _ensure_ppm2(df: pd.DataFrame) -> pd.DataFrame:
    if "prix_au_m2" not in df.columns:
        df = df.copy()
        df["prix_au_m2"] = df["prix_vente"] / df["surface_m2"]
    return df


def baseline_predict(train_df: pd.DataFrame, valid_df: pd.DataFrame) -> pd.Series:
    train_df = _ensure_ppm2(train_df)
    valid_df = _ensure_ppm2(valid_df)

    group_cols = ["commune", "type_bien"]
    med_ppm2 = (
        train_df.groupby(group_cols)["prix_au_m2"]
        .median()
        .rename("median_ppm2")
    )
    global_median = float(train_df["prix_au_m2"].median())

    merged = valid_df.merge(
        med_ppm2.reset_index(),
        on=group_cols,
        how="left",
    )
    merged["median_ppm2"] = merged["median_ppm2"].fillna(global_median)
    preds = merged["median_ppm2"] * merged["surface_m2"]
    return preds


def evaluate(y_true: pd.Series, y_pred: pd.Series) -> dict:
    mae = mean_absolute_error(y_true, y_pred)
    rmse = mean_squared_error(y_true, y_pred, squared=False)
    mape = (abs((y_true - y_pred) / y_true)).mean() * 100
    return {"MAE": mae, "RMSE": rmse, "MAPE": mape}


def main() -> None:
    env_path = os.getenv("DVF_CLEAN_PATH")
    data_path = Path(env_path) if env_path else DEFAULT_DVF_PATH
    if not data_path.exists():
        raise FileNotFoundError(f"Dataset introuvable: {data_path}")

    df = prepare_data(load_dataset(data_path))

    sample = os.getenv("SAMPLE_ROWS")
    if sample:
        df = df.sample(n=int(sample), random_state=42)

    features = ["commune", "type_bien", "surface_m2"]
    X = df[features]
    y = df["prix_vente"]

    X_train, X_valid, y_train, y_valid = train_test_split(
        X, y, test_size=0.2, random_state=42
    )

    train_df = X_train.join(y_train).copy()
    valid_df = X_valid.join(y_valid).copy()

    # Baseline
    baseline_preds = baseline_predict(train_df, valid_df)
    baseline_metrics = evaluate(y_valid, baseline_preds)

    # Model
    model = train_model(df)
    model_preds = model.predict(X_valid)
    model_metrics = evaluate(y_valid, model_preds)

    print("Baseline (median price/m2 by commune+type)")
    for k, v in baseline_metrics.items():
        print(f"{k}: {v:,.2f}")

    print("\nModel (RandomForest)")
    for k, v in model_metrics.items():
        print(f"{k}: {v:,.2f}")


if __name__ == "__main__":
    main()
