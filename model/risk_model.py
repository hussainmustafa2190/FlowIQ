import pandas as pd
import numpy as np
import pickle
import os
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error, r2_score
from sklearn.preprocessing import LabelEncoder

ACCIDENTS_PATH = r"D:\Henhacks\FlowIQ\FlowIQ\dataset\US_Accidents_March23.csv"
OUTPUT_DIR = r"D:\Henhacks\FlowIQ\FlowIQ\data\processed"

def run_training():
    print("Loading accidents data...")
    df = pd.read_csv(ACCIDENTS_PATH, usecols=[
        'Severity', 'Start_Lat', 'Start_Lng', 'State',
        'Temperature(F)', 'Visibility(mi)', 'Wind_Speed(mph)',
        'Precipitation(in)', 'Weather_Condition', 'Traffic_Signal',
        'Junction', 'Crossing', 'Start_Time', 'Sunrise_Sunset'
    ], low_memory=False)

    print(f"   Loaded {len(df):,} records")

    print("Filtering to NY state...")
    df = df[df['State'] == 'NY'].copy()
    print(f"   NY records: {len(df):,}")

    print("Engineering features...")
    df['Start_Time'] = pd.to_datetime(df['Start_Time'], errors='coerce')
    df['hour'] = df['Start_Time'].dt.hour.fillna(12).astype(int)
    df['day_of_week'] = df['Start_Time'].dt.dayofweek.fillna(0).astype(int)
    df['month'] = df['Start_Time'].dt.month.fillna(1).astype(int)
    df['is_peak'] = df['hour'].apply(lambda h: 1 if (7 <= h <= 9 or 16 <= h <= 19) else 0)
    df['is_night'] = df['Sunrise_Sunset'].apply(lambda x: 1 if str(x).lower() == 'night' else 0)

    df['Temperature(F)'] = pd.to_numeric(df['Temperature(F)'], errors='coerce').fillna(65)
    df['Visibility(mi)'] = pd.to_numeric(df['Visibility(mi)'], errors='coerce').fillna(10)
    df['Wind_Speed(mph)'] = pd.to_numeric(df['Wind_Speed(mph)'], errors='coerce').fillna(0)
    df['Precipitation(in)'] = pd.to_numeric(df['Precipitation(in)'], errors='coerce').fillna(0)
    df['Traffic_Signal'] = df['Traffic_Signal'].astype(int)
    df['Junction'] = df['Junction'].astype(int)
    df['Crossing'] = df['Crossing'].astype(int)

    df['weather_encoded'] = LabelEncoder().fit_transform(
        df['Weather_Condition'].fillna('Clear').astype(str)
    )

    df['risk_score'] = (
        df['Severity'] * 20 +
        df['is_peak'] * 10 +
        df['is_night'] * 8 +
        ((df['Visibility(mi)'] < 1).astype(int)) * 20 +
        ((df['Precipitation(in)'] > 0.1).astype(int)) * 15 +
        ((df['Wind_Speed(mph)'] > 25).astype(int)) * 10 +
        df['Junction'] * 5 +
        df['Traffic_Signal'] * 5 +
        df['Crossing'] * 3
    ).clip(0, 100)

    FEATURES = [
        'hour', 'day_of_week', 'month', 'is_peak', 'is_night',
        'Temperature(F)', 'Visibility(mi)', 'Wind_Speed(mph)',
        'Precipitation(in)', 'weather_encoded',
        'Traffic_Signal', 'Junction', 'Crossing',
        'Start_Lat', 'Start_Lng'
    ]

    X = df[FEATURES].fillna(0)
    y = df['risk_score']

    print(f"   Training samples: {len(X):,}")
    print(f"   Features: {FEATURES}")

    print("Splitting data...")
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42
    )

    print("Training Random Forest Risk Model...")
    model = RandomForestRegressor(
        n_estimators=100,
        max_depth=12,
        min_samples_split=10,
        n_jobs=-1,
        random_state=42,
        verbose=1
    )
    model.fit(X_train, y_train)

    print("Evaluating...")
    y_pred = model.predict(X_test)
    mae = mean_absolute_error(y_test, y_pred)
    r2 = r2_score(y_test, y_pred)
    print(f"   MAE: {mae:.2f}")
    print(f"   R2 Score: {r2:.4f}")

    print("Feature importances:")
    importances = sorted(zip(FEATURES, model.feature_importances_), key=lambda x: x[1], reverse=True)
    for feat, imp in importances[:8]:
        print(f"   {feat}: {imp:.4f}")

    os.makedirs(OUTPUT_DIR, exist_ok=True)
    model_path = os.path.join(OUTPUT_DIR, 'risk_model.pkl')
    with open(model_path, 'wb') as f:
        pickle.dump(model, f)
    print(f"\nModel saved to {model_path}")

    meta = {
        "features": FEATURES,
        "mae": round(mae, 2),
        "r2": round(r2, 4),
        "n_estimators": 100,
        "training_samples": len(X_train)
    }
    meta_path = os.path.join(OUTPUT_DIR, 'risk_model_meta.json')
    import json
    with open(meta_path, 'w') as f:
        json.dump(meta, f, indent=2)

    print("Training complete!")
    print(f"   MAE: {mae:.2f} | R2: {r2:.4f}")

if __name__ == "__main__":
    run_training()