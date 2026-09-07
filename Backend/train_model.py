import os
from pathlib import Path

import pandas as pd
from joblib import dump
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder


BACKEND_DIR = Path(__file__).resolve().parent
DEFAULT_DVF_PATH = BACKEND_DIR / "Data pipeline" / "outputs" / "DVF_clean_2023_2024.csv"
MODEL_DIR = BACKEND_DIR / "models"
MODEL_PATH = MODEL_DIR / "price_model.pkl"


def load_dataset(path: Path) -> pd.DataFrame:
    df = pd.read_csv(path)

    rename_map = {
        "Commune": "commune",
        "Surface reelle bati": "surface_m2",
        "Valeur fonciere": "prix_vente",
        "Type local": "type_local",
    }

    df = df.rename(columns={k: v for k, v in rename_map.items() if k in df.columns})

    # Standardize type_bien if not already present
    if "type_bien" not in df.columns and "type_local" in df.columns:
        df["type_bien"] = df["type_local"].astype(str).str.strip().str.lower()

    return df


def prepare_data(df: pd.DataFrame) -> pd.DataFrame:
    required = ["commune", "type_bien", "surface_m2", "prix_vente"]
    missing = [c for c in required if c not in df.columns]
    if missing:
        raise ValueError(f"Colonnes manquantes: {missing}")

    df = df.copy()

    df["commune"] = df["commune"].astype(str).str.strip().str.lower()
    df["type_bien"] = df["type_bien"].astype(str).str.strip().str.lower()
    df["surface_m2"] = pd.to_numeric(df["surface_m2"], errors="coerce")
    df["prix_vente"] = pd.to_numeric(df["prix_vente"], errors="coerce")

    df = df.dropna(subset=["commune", "type_bien", "surface_m2", "prix_vente"])

    # Basic sanity filters
    df = df[(df["surface_m2"] > 5) & (df["surface_m2"] < 1000)]
    df = df[(df["prix_vente"] > 1000) & (df["prix_vente"] < 50_000_000)]

    return df


def train_model(df: pd.DataFrame) -> Pipeline:
    features = ["commune", "type_bien", "surface_m2"]
    X = df[features]
    y = df["prix_vente"]

    categorical = ["commune", "type_bien"]
    numeric = ["surface_m2"]

    preprocessor = ColumnTransformer(
        transformers=[
            ("cat", OneHotEncoder(handle_unknown="ignore"), categorical),
            ("num", "passthrough", numeric),
        ]
    )

    model = RandomForestRegressor(
        n_estimators=200,
        random_state=42,
        n_jobs=-1,
    )

    pipeline = Pipeline(
        steps=[
            ("preprocess", preprocessor),
            ("model", model),
        ]
    )

    X_train, X_valid, y_train, y_valid = train_test_split(
        X, y, test_size=0.2, random_state=42
    )

    pipeline.fit(X_train, y_train)

    preds = pipeline.predict(X_valid)
    mae = mean_absolute_error(y_valid, preds)
    mape = (abs((y_valid - preds) / y_valid)).mean() * 100

    print(f"Rows used: {len(df)}")
    print(f"MAE: {mae:,.2f}")
    print(f"MAPE: {mape:.2f}%")

    return pipeline


def main() -> None:
    env_path = os.getenv("DVF_CLEAN_PATH")
    data_path = Path(env_path) if env_path else DEFAULT_DVF_PATH
    if not data_path.exists():
        raise FileNotFoundError(f"Dataset introuvable: {data_path}")

    df = load_dataset(data_path)
    df = prepare_data(df)
    pipeline = train_model(df)

    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    dump(pipeline, MODEL_PATH)
    print(f"Model saved: {MODEL_PATH}")


if __name__ == "__main__":
    main()
