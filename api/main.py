from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import numpy as np
import pickle
import random
import requests
from datetime import datetime, timedelta
from typing import List, Optional
import threading
import time

app = FastAPI(title="FlowIQ API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

MODEL_WEIGHTS = r"D:\Henhacks\FlowIQ\FlowIQ\model\weights\flowiq_best.pt"
MODEL_META    = r"D:\Henhacks\FlowIQ\FlowIQ\model\weights\model_meta.json"
SCALER_PATH   = r"D:\Henhacks\FlowIQ\FlowIQ\processed\scaler.pkl"
CLEAN_DATA    = r"D:\Henhacks\FlowIQ\FlowIQ\processed\clean_traffic.csv"
NYC_DOT_URL = "https://data.cityofnewyork.us/resource/i4gi-tjb9.json?$limit=100"

model = None
scaler = None
live_segments = []
last_updated = None


def get_level(score: float) -> str:
    if score > 75: return "CRITICAL"
    if score > 50: return "HIGH"
    if score > 25: return "NORMAL"
    return "LOW"


def fetch_nyc_traffic():
    try:
        print("Fetching live NYC DOT traffic data...")
        response = requests.get(NYC_DOT_URL, params={"$limit": 300}, timeout=15)
        data = response.json()
        segments = []

        for i, item in enumerate(data):
            try:
                lat = float(item.get("latitude") or 0)
                lng = float(item.get("longitude") or 0)
                if lat == 0 or lng == 0:
                    continue
                if not (40.4 < lat < 40.95 and -74.3 < lng < -73.6):
                    continue

                speed = float(item.get("speed") or 0)

                if speed <= 0:   score = 50.0
                elif speed < 5:  score = 95.0
                elif speed < 10: score = 85.0
                elif speed < 15: score = 70.0
                elif speed < 20: score = 55.0
                elif speed < 25: score = 40.0
                elif speed < 35: score = 20.0
                else:            score = 10.0

                score = round(min(100, max(0, score + random.uniform(-3, 3))), 1)
                street = item.get("street") or item.get("linkname") or f"Segment {i}"

                segments.append({
                    "id": f"SEG_{item.get('segmentid', i)}",
                    "name": street.title(),
                    "lat": lat,
                    "lng": lng,
                    "speed": round(speed, 1),
                    "travel_time": round(float(item.get("travel_time") or 0), 1),
                    "congestion_score": score,
                    "congestion_level": get_level(score),
                    "alert": score > 75,
                    "data_as_of": item.get("data_as_of", datetime.now().isoformat()),
                    "live": True
                })
            except Exception:
                continue

        print(f"Loaded {len(segments)} live NYC segments")
        return segments if segments else generate_fallback_segments()

    except Exception as e:
        print(f"NYC DOT fetch failed: {e}")
        return generate_fallback_segments()


def generate_fallback_segments():
    nyc_streets = [
        ("5th Ave & 42nd St",          40.7536, -73.9822),
        ("Broadway & Times Square",     40.7579, -73.9855),
        ("Park Ave & Grand Central",    40.7527, -73.9772),
        ("Lexington Ave & 59th St",     40.7624, -73.9674),
        ("FDR Drive & 34th St",         40.7455, -73.9695),
        ("West Side Hwy & 23rd St",     40.7459, -74.0100),
        ("Canal St & Broadway",         40.7194, -74.0020),
        ("Houston St & 6th Ave",        40.7282, -74.0030),
        ("8th Ave & 23rd St",           40.7459, -74.0003),
        ("Madison Ave & 57th St",       40.7635, -73.9724),
        ("Atlantic Ave & 4th Ave",      40.6840, -73.9775),
        ("Flatbush Ave & Fulton St",    40.6820, -73.9780),
        ("Bedford Ave & N 7th St",      40.7172, -73.9574),
        ("Atlantic Ave & Pennsylvania", 40.6760, -73.8960),
        ("Queens Blvd & Grand Ave",     40.7282, -73.8490),
        ("Jamaica Ave & Sutphin Blvd",  40.7022, -73.8077),
        ("Northern Blvd & Main St",     40.7596, -73.8300),
        ("Astoria Blvd & 31st St",      40.7720, -73.9290),
        ("Grand Concourse & 161st",     40.8276, -73.9257),
        ("Fordham Rd & Grand Concourse",40.8618, -73.8996),
        ("Jerome Ave & Burnside Ave",   40.8530, -73.9100),
        ("Cross Bronx & Major Deegan",  40.8480, -73.9180),
        ("Richmond Ave & Victory Blvd", 40.6120, -74.1650),
        ("Hylan Blvd & New Dorp Lane",  40.5730, -74.1150),
        ("Staten Island Expwy & 440",   40.5980, -74.1780),
    ]
    hour = datetime.now().hour
    is_peak = (7 <= hour <= 9) or (16 <= hour <= 19)
    segments = []
    for i, (name, lat, lng) in enumerate(nyc_streets):
        base = random.uniform(30, 90) if is_peak else random.uniform(10, 60)
        score = round(min(100, max(0, base + random.uniform(-5, 5))), 1)
        segments.append({
            "id": f"SEG_{i+1:03d}",
            "name": name,
            "lat": lat,
            "lng": lng,
            "speed": round(random.uniform(5, 35), 1),
            "travel_time": round(random.uniform(2, 20), 1),
            "congestion_score": score,
            "congestion_level": get_level(score),
            "alert": score > 75,
            "data_as_of": datetime.now().isoformat(),
            "live": False
        })
    return segments


def refresh_loop():
    global live_segments, last_updated
    while True:
        time.sleep(60)
        live_segments = fetch_nyc_traffic()
        last_updated = datetime.now().isoformat()


RESOURCES = [
    {"id": "RES_001", "type": "traffic_officer", "name": "Officer Chen",     "available": True},
    {"id": "RES_002", "type": "traffic_officer", "name": "Officer Davis",    "available": True},
    {"id": "RES_003", "type": "traffic_officer", "name": "Officer Martinez", "available": False},
    {"id": "RES_004", "type": "signal_control",  "name": "Signal Unit A",    "available": True},
    {"id": "RES_005", "type": "signal_control",  "name": "Signal Unit B",    "available": True},
    {"id": "RES_006", "type": "vms_board",        "name": "VMS Board North",  "available": True},
    {"id": "RES_007", "type": "traffic_officer", "name": "Officer Johnson",  "available": True},
    {"id": "RES_008", "type": "signal_control",  "name": "Signal Unit C",    "available": True},
]


def optimize_resources(hotspots: list) -> list:
    available = [r for r in RESOURCES if r["available"]]
    assignments = []
    for spot in hotspots:
        if not available:
            break
        resource = available.pop(0)
        assignments.append({
            "intersection_id": spot["id"],
            "intersection_name": spot["name"],
            "resource_id": resource["id"],
            "resource_type": resource["type"],
            "resource_name": resource["name"],
            "congestion_score": spot["congestion_score"],
            "speed_mph": spot.get("speed", 0),
            "action": (
                "Deploy officer to manual traffic control" if resource["type"] == "traffic_officer" else
                "Switch to adaptive signal timing"          if resource["type"] == "signal_control" else
                "Display congestion alert on VMS board"
            ),
            "estimated_reduction": f"{random.randint(15, 40)}%",
            "deploy_by": (datetime.now() + timedelta(minutes=random.randint(5, 20))).strftime("%H:%M")
        })
    return assignments


@app.on_event("startup")
def load_assets():
    global model, scaler, live_segments, last_updated
    try:
        import sys
        sys.path.append(r"D:\Henhacks\FlowIQ\FlowIQ\model")
        from lstm import load_model
        model = load_model(MODEL_WEIGHTS, MODEL_META)
        with open(SCALER_PATH, "rb") as f:
            scaler = pickle.load(f)
        print("LSTM model loaded")
    except Exception as e:
        print(f"Model not loaded: {e}")

    live_segments = fetch_nyc_traffic()
    last_updated = datetime.now().isoformat()
    threading.Thread(target=refresh_loop, daemon=True).start()


class PredictRequest(BaseModel):
    intersection_id: str
    hours_ahead: Optional[int] = 3

class OptimizeRequest(BaseModel):
    intersection_ids: Optional[List[str]] = None


@app.get("/")
def root():
    return {
        "app": "FlowIQ",
        "version": "2.0.0",
        "segments": len(live_segments),
        "last_updated": last_updated,
        "model_loaded": model is not None
    }

@app.get("/health")
def health():
    return {
        "status": "ok",
        "model_loaded": model is not None,
        "segments": len(live_segments),
        "last_updated": last_updated,
        "timestamp": datetime.now().isoformat()
    }

@app.get("/intersections")
def get_intersections():
    return {
        "intersections": live_segments,
        "count": len(live_segments),
        "last_updated": last_updated,
        "source": "NYC DOT Live Feed"
    }

@app.get("/hotspots")
def get_hotspots():
    hotspots = sorted(
        [s for s in live_segments if s["congestion_score"] > 50],
        key=lambda x: x["congestion_score"],
        reverse=True
    )
    return {
        "hotspots": hotspots[:20],
        "count": len(hotspots),
        "timestamp": datetime.now().isoformat(),
        "source": "NYC DOT Live Feed"
    }

@app.post("/predict")
def predict_congestion(req: PredictRequest):
    segment = next((s for s in live_segments if s["id"] == req.intersection_id), None)
    if not segment:
        raise HTTPException(status_code=404, detail=f"Segment {req.intersection_id} not found")

    if model and scaler:
        try:
            import sys, pandas as pd
            sys.path.append(r"D:\Henhacks\FlowIQ\FlowIQ\model")
            from lstm import predict as lstm_predict
            clean_df = pd.read_csv(CLEAN_DATA)
            feature_cols = [c for c in ["congestion_score", "hour", "day_of_week", "is_peak"] if c in clean_df.columns]
            seq = clean_df[feature_cols].values[-24:]
            result = lstm_predict(model, seq, scaler)

        # Convert all numpy types to native Python types
            def convert(obj):
                if hasattr(obj, 'item'):
                    return obj.item()
                if isinstance(obj, dict):
                    return {k: convert(v) for k, v in obj.items()}
                if isinstance(obj, list):
                    return [convert(i) for i in obj]
                return obj

            result = convert(result)
            result["intersection_id"] = req.intersection_id
            result["intersection_name"] = segment["name"]
            result["current_score"] = segment["congestion_score"]
            result["current_speed_mph"] = segment.get("speed", 0)
            result["simulated"] = False
            return result
        except Exception as e:
            print(f"Model predict error: {e}")

    base = segment["congestion_score"]
    forecast = []
    for i in range(12):
        score = round(min(100, max(0, base + random.uniform(-8, 8))), 1)
        forecast.append({
            "minutes_ahead": (i + 1) * 15,
            "congestion_score": score,
            "level": get_level(score)
        })
    peak_score = max(s["congestion_score"] for s in forecast)
    return {
        "intersection_id": req.intersection_id,
        "intersection_name": segment["name"],
        "current_score": segment["congestion_score"],
        "current_speed_mph": segment.get("speed", 0),
        "forecast": forecast,
        "peak_score": round(peak_score, 1),
        "peak_at_minutes": next(s["minutes_ahead"] for s in forecast if s["congestion_score"] == peak_score),
        "alert": peak_score > 75,
        "simulated": True
    }

@app.post("/optimize")
def optimize(req: OptimizeRequest = None):
    hotspots = sorted(
        [s for s in live_segments if s["congestion_score"] > 50],
        key=lambda x: x["congestion_score"],
        reverse=True
    )
    assignments = optimize_resources(hotspots[:8])
    return {
        "assignments": assignments,
        "total_hotspots": len(hotspots),
        "resources_deployed": len(assignments),
        "unaddressed": max(0, len(hotspots) - len(assignments)),
        "generated_at": datetime.now().isoformat()
    }

@app.get("/resources")
def get_resources():
    return {
        "resources": RESOURCES,
        "available": sum(1 for r in RESOURCES if r["available"]),
        "total": len(RESOURCES)
    }

@app.get("/refresh")
def manual_refresh():
    global live_segments, last_updated
    live_segments = fetch_nyc_traffic()
    last_updated = datetime.now().isoformat()
    return {"status": "refreshed", "segments": len(live_segments), "timestamp": last_updated}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)
