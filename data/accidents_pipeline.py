import pandas as pd
import numpy as np
import pickle
import os

ACCIDENTS_PATH = r"D:\Henhacks\FlowIQ\FlowIQ\dataset\US_Accidents_March23.csv"
OUTPUT_DIR = r"D:\Henhacks\FlowIQ\FlowIQ\data\processed"

def run_accidents_pipeline():
    print("Loading US Accidents dataset...")
    df = pd.read_csv(ACCIDENTS_PATH, usecols=[
        'Severity', 'Start_Lat', 'Start_Lng', 'Street', 'City', 'State',
        'Temperature(F)', 'Visibility(mi)', 'Wind_Speed(mph)',
        'Precipitation(in)', 'Weather_Condition', 'Traffic_Signal',
        'Junction', 'Crossing', 'Start_Time'
    ], low_memory=False)

    print(f"   Loaded {len(df):,} accident records")

    print("Filtering to NYC area...")
    nyc = df[
        (df['Start_Lat'].between(40.4, 40.95)) &
        (df['Start_Lng'].between(-74.3, -73.6))
    ].copy()
    print(f"   NYC accidents: {len(nyc):,}")

    if len(nyc) < 100:
        print("   Not enough NYC data — using all NY state data")
        nyc = df[df['State'] == 'NY'].copy()
        print(f"   NY state accidents: {len(nyc):,}")

    print("Engineering risk features...")
    nyc['Start_Time'] = pd.to_datetime(nyc['Start_Time'], errors='coerce')
    nyc['hour'] = nyc['Start_Time'].dt.hour
    nyc['is_peak'] = nyc['hour'].apply(lambda h: 1 if (7 <= h <= 9 or 16 <= h <= 19) else 0)
    nyc['is_night'] = nyc['hour'].apply(lambda h: 1 if (h < 6 or h > 21) else 0)

    nyc['Temperature(F)'] = pd.to_numeric(nyc['Temperature(F)'], errors='coerce').fillna(65)
    nyc['Visibility(mi)'] = pd.to_numeric(nyc['Visibility(mi)'], errors='coerce').fillna(10)
    nyc['Wind_Speed(mph)'] = pd.to_numeric(nyc['Wind_Speed(mph)'], errors='coerce').fillna(0)
    nyc['Precipitation(in)'] = pd.to_numeric(nyc['Precipitation(in)'], errors='coerce').fillna(0)

    nyc['bad_weather'] = (
        (nyc['Visibility(mi)'] < 1) |
        (nyc['Precipitation(in)'] > 0.1) |
        (nyc['Wind_Speed(mph)'] > 25)
    ).astype(int)

    nyc['risk_score'] = (
        nyc['Severity'] * 20 +
        nyc['is_peak'] * 10 +
        nyc['bad_weather'] * 15 +
        nyc['Junction'].astype(int) * 5 +
        nyc['Traffic_Signal'].astype(int) * 5 +
        nyc['Crossing'].astype(int) * 3
    ).clip(0, 100)

    print("Building street-level risk index...")
    street_risk = nyc.groupby('Street').agg(
        accident_count=('Severity', 'count'),
        avg_severity=('Severity', 'mean'),
        avg_risk_score=('risk_score', 'mean'),
        peak_accidents=('is_peak', 'sum'),
        bad_weather_accidents=('bad_weather', 'sum'),
        lat=('Start_Lat', 'mean'),
        lng=('Start_Lng', 'mean')
    ).reset_index()

    street_risk['normalized_risk'] = (
        street_risk['avg_risk_score'] *
        np.log1p(street_risk['accident_count'])
    )
    street_risk['normalized_risk'] = (
        100 * street_risk['normalized_risk'] /
        street_risk['normalized_risk'].max()
    ).round(1)

    street_risk = street_risk.sort_values('normalized_risk', ascending=False)

    os.makedirs(OUTPUT_DIR, exist_ok=True)
    out_path = os.path.join(OUTPUT_DIR, 'street_risk.csv')
    street_risk.to_csv(out_path, index=False)
    print(f"Saved {len(street_risk):,} street risk records to {out_path}")

    print("\nTop 10 highest risk streets:")
    print(street_risk[['Street', 'accident_count', 'avg_severity', 'normalized_risk']].head(10).to_string())

    risk_lookup = dict(zip(
        street_risk['Street'].str.lower(),
        street_risk['normalized_risk']
    ))
    lookup_path = os.path.join(OUTPUT_DIR, 'risk_lookup.pkl')
    with open(lookup_path, 'wb') as f:
        pickle.dump(risk_lookup, f)
    print(f"\nSaved risk lookup to {lookup_path}")
    print("Pipeline complete!")

if __name__ == "__main__":
    run_accidents_pipeline()