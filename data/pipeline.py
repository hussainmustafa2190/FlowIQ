import pandas as pd
import numpy as np
from sklearn.preprocessing import MinMaxScaler
import pickle
import os

DATA_PATH = r"D:\Henhacks\FlowIQ\FlowIQ\dataset\traffic.csv"
SEQUENCE_LENGTH = 24
FORECAST_HORIZON = 12
TARGET_COL = "Vehicles"
TRAIN_SPLIT = 0.8
SAVE_DIR = "./processed"

os.makedirs(SAVE_DIR, exist_ok=True)


def load_data(path: str) -> pd.DataFrame:
    print("Loading dataset...")
    df = pd.read_csv(path)
    print(f"   Shape: {df.shape}")
    print(f"   Columns: {list(df.columns)}")
    print(f"   Sample:\n{df.head(3)}\n")
    return df


def clean_data(df: pd.DataFrame) -> pd.DataFrame:
    print(" Cleaning data...")

    if "DateTime" in df.columns:
        df["DateTime"] = pd.to_datetime(df["DateTime"])
        df = df.sort_values("DateTime").reset_index(drop=True)

    before = len(df)
    df = df.drop_duplicates()
    print(f"   Dropped {before - len(df)} duplicates")

    df = df.ffill().bfill()
    print(f"   Missing values remaining: {df.isnull().sum().sum()}")

    if "DateTime" in df.columns:
        df["hour"] = df["DateTime"].dt.hour
        df["day_of_week"] = df["DateTime"].dt.dayofweek
        df["month"] = df["DateTime"].dt.month
        df["is_peak"] = df["hour"].apply(
            lambda h: 1 if (7 <= h <= 9) or (16 <= h <= 19) else 0
        )

    print(f"   Final shape: {df.shape}\n")
    return df


def add_congestion_score(df: pd.DataFrame) -> pd.DataFrame:
    print("Engineering congestion score...")

    if TARGET_COL in df.columns:
        max_val = df[TARGET_COL].quantile(0.99)
        df["congestion_score"] = (df[TARGET_COL] / max_val * 100).clip(0, 100)
        df["congestion_level"] = pd.cut(
            df["congestion_score"],
            bins=[0, 25, 50, 75, 100],
            labels=["LOW", "NORMAL", "HIGH", "CRITICAL"]
        )
        print(f"   Congestion distribution:\n{df['congestion_level'].value_counts()}\n")
    return df


def normalize(df: pd.DataFrame, feature_cols: list) -> tuple:
    print("Normalizing features...")
    scaler = MinMaxScaler()
    df[feature_cols] = scaler.fit_transform(df[feature_cols])
    print(f"   Normalized {len(feature_cols)} features\n")
    return df, scaler


def create_sequences(data: np.ndarray, seq_len: int, horizon: int) -> tuple:
    print(f"Creating sequences (window={seq_len}, horizon={horizon})...")
    X, y = [], []
    for i in range(len(data) - seq_len - horizon):
        X.append(data[i : i + seq_len])
        y.append(data[i + seq_len : i + seq_len + horizon, 0])
    X, y = np.array(X), np.array(y)
    print(f"   X shape: {X.shape}  |  y shape: {y.shape}\n")
    return X, y


def split(X: np.ndarray, y: np.ndarray, ratio: float) -> tuple:
    split_idx = int(len(X) * ratio)
    return X[:split_idx], X[split_idx:], y[:split_idx], y[split_idx:]


def run_pipeline():
    df = load_data(DATA_PATH)

    df = clean_data(df)

    df = add_congestion_score(df)

    feature_cols = ["congestion_score"]
    if "hour" in df.columns:
        feature_cols += ["hour", "day_of_week", "is_peak"]
    if "CarCount" in df.columns:
        feature_cols += ["CarCount"]
    if "BusCount" in df.columns:
        feature_cols += ["BusCount"]
    if "TruckCount" in df.columns:
        feature_cols += ["TruckCount"]

    feature_cols = [c for c in feature_cols if c in df.columns]
    print(f"Features selected: {feature_cols}")

    df, scaler = normalize(df, feature_cols)

    data = df[feature_cols].values
    X, y = create_sequences(data, SEQUENCE_LENGTH, FORECAST_HORIZON)

    X_train, X_test, y_train, y_test = split(X, y, TRAIN_SPLIT)
    print(f"✅ Train: {X_train.shape} | Test: {X_test.shape}")

    np.save(f"{SAVE_DIR}/X_train.npy", X_train)
    np.save(f"{SAVE_DIR}/X_test.npy", X_test)
    np.save(f"{SAVE_DIR}/y_train.npy", y_train)
    np.save(f"{SAVE_DIR}/y_test.npy", y_test)
    with open(f"{SAVE_DIR}/scaler.pkl", "wb") as f:
        pickle.dump(scaler, f)
    df.to_csv(f"{SAVE_DIR}/clean_traffic.csv", index=False)

    print(f"\nipeline complete. Files saved to {SAVE_DIR}/")
    print("   Next step → run: python model/lstm.py")

    return X_train, X_test, y_train, y_test, scaler, feature_cols


if __name__ == "__main__":
    run_pipeline()
