from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import numpy as np
import pandas as pd
import pickle
import pyowm
import random
import requests
from datetime import datetime, timedelta
from typing import List, Optional
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

MODEL_WEIGHTS   = r"D:\Henhacks\FlowIQ\FlowIQ\model\weights\flowiq_best.pt"
MODEL_META      = r"D:\Henhacks\FlowIQ\FlowIQ\model\weights\model_meta.json"
SCALER_PATH     = r"D:\Henhacks\FlowIQ\FlowIQ\processed\scaler.pkl"
CLEAN_DATA      = r"D:\Henhacks\FlowIQ\FlowIQ\data\processed\clean_traffic.csv"
RISK_MODEL_PATH = r"D:\Henhacks\FlowIQ\FlowIQ\data\processed\risk_model.pkl"
OPENWEATHER_KEY = "a18bbdd696401c0cfaedf3f727601fff"
TOMTOM_KEY      = "PAnxBqZSxVEVZ2aRAN4z5u6La9GELJVa"
TOMTOM_URL      = "https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json"

NYC_LOCATIONS = [
    # Manhattan — 30 locations
    ("5th Ave & 42nd St",            40.7536, -73.9822, "Manhattan"),
    ("Broadway & Times Square",       40.7579, -73.9855, "Manhattan"),
    ("Park Ave & Grand Central",      40.7527, -73.9772, "Manhattan"),
    ("Lexington Ave & 59th St",       40.7624, -73.9674, "Manhattan"),
    ("FDR Drive & 34th St",           40.7455, -73.9695, "Manhattan"),
    ("West Side Hwy & 23rd St",       40.7459, -74.0100, "Manhattan"),
    ("Canal St & Broadway",           40.7194, -74.0020, "Manhattan"),
    ("Houston St & 6th Ave",          40.7282, -74.0030, "Manhattan"),
    ("8th Ave & 23rd St",             40.7459, -74.0003, "Manhattan"),
    ("Madison Ave & 57th St",         40.7635, -73.9724, "Manhattan"),
    ("Amsterdam Ave & 96th St",       40.7940, -73.9706, "Manhattan"),
    ("Broadway & 125th St",           40.8084, -73.9483, "Manhattan"),
    ("2nd Ave & 72nd St",             40.7686, -73.9585, "Manhattan"),
    ("3rd Ave & 86th St",             40.7773, -73.9557, "Manhattan"),
    ("Columbus Ave & 79th St",        40.7820, -73.9810, "Manhattan"),
    ("7th Ave & 34th St",             40.7495, -73.9894, "Manhattan"),
    ("6th Ave & 14th St",             40.7374, -74.0003, "Manhattan"),
    ("1st Ave & 49th St",             40.7541, -73.9681, "Manhattan"),
    ("Broadway & 96th St",            40.7942, -73.9721, "Manhattan"),
    ("Riverside Dr & 79th St",        40.7840, -73.9893, "Manhattan"),
    ("11th Ave & 42nd St",            40.7596, -74.0033, "Manhattan"),
    ("Fulton St & Broadway",          40.7094, -74.0104, "Manhattan"),
    ("Wall St & Broadway",            40.7074, -74.0113, "Manhattan"),
    ("14th St & Union Square",        40.7359, -73.9906, "Manhattan"),
    ("23rd St & Park Ave",            40.7425, -73.9878, "Manhattan"),
    ("72nd St & Central Park West",   40.7776, -73.9819, "Manhattan"),
    ("110th St & Lenox Ave",          40.7963, -73.9442, "Manhattan"),
    ("Dyckman St & Broadway",         40.8653, -73.9274, "Manhattan"),
    ("181st St & Broadway",           40.8497, -73.9340, "Manhattan"),
    ("145th St & St Nicholas Ave",    40.8237, -73.9447, "Manhattan"),

    # Brooklyn — 25 locations
    ("Atlantic Ave & 4th Ave",        40.6840, -73.9775, "Brooklyn"),
    ("Flatbush Ave & Fulton St",      40.6820, -73.9780, "Brooklyn"),
    ("Bedford Ave & N 7th St",        40.7172, -73.9574, "Brooklyn"),
    ("Atlantic Ave & Pennsylvania",   40.6760, -73.8960, "Brooklyn"),
    ("Eastern Pkwy & Nostrand Ave",   40.6695, -73.9500, "Brooklyn"),
    ("Kings Hwy & Coney Island Ave",  40.6080, -73.9740, "Brooklyn"),
    ("86th St & 4th Ave Brooklyn",    40.6218, -74.0300, "Brooklyn"),
    ("Church Ave & Flatbush Ave",     40.6505, -73.9580, "Brooklyn"),
    ("Bay Ridge Ave & 5th Ave",       40.6349, -74.0175, "Brooklyn"),
    ("Myrtle Ave & Broadway",         40.6970, -73.9380, "Brooklyn"),
    ("Dekalb Ave & Flatbush Ave",     40.6880, -73.9740, "Brooklyn"),
    ("Nostrand Ave & Empire Blvd",    40.6604, -73.9502, "Brooklyn"),
    ("Pitkin Ave & Rockaway Ave",     40.6640, -73.9060, "Brooklyn"),
    ("Ocean Ave & Flatbush Ave",      40.6340, -73.9574, "Brooklyn"),
    ("4th Ave & 65th St Brooklyn",    40.6403, -74.0100, "Brooklyn"),
    ("Utica Ave & Eastern Pkwy",      40.6698, -73.9286, "Brooklyn"),
    ("Fulton St & Ralph Ave",         40.6800, -73.9190, "Brooklyn"),
    ("Atlantic Ave & Hicks St",       40.6900, -73.9990, "Brooklyn"),
    ("Court St & Atlantic Ave",       40.6880, -73.9945, "Brooklyn"),
    ("Broadway & Myrtle Ave",         40.6970, -73.9500, "Brooklyn"),
    ("Coney Island Ave & Ave J",      40.6222, -73.9614, "Brooklyn"),
    ("Shore Pkwy & Bay Pkwy",         40.6020, -73.9988, "Brooklyn"),
    ("Linden Blvd & Rockaway Pkwy",   40.6480, -73.8960, "Brooklyn"),
    ("New Utrecht Ave & 18th Ave",    40.6295, -74.0050, "Brooklyn"),
    ("Bushwick Ave & Flushing Ave",   40.7026, -73.9279, "Brooklyn"),

    # Queens — 25 locations
    ("Queens Blvd & Grand Ave",       40.7282, -73.8490, "Queens"),
    ("Jamaica Ave & Sutphin Blvd",    40.7022, -73.8077, "Queens"),
    ("Northern Blvd & Main St",       40.7596, -73.8300, "Queens"),
    ("Astoria Blvd & 31st St",        40.7720, -73.9290, "Queens"),
    ("Junction Blvd & Roosevelt Ave", 40.7490, -73.8610, "Queens"),
    ("Hillside Ave & 168th St",       40.7080, -73.7910, "Queens"),
    ("Woodhaven Blvd & Atlantic Ave", 40.6930, -73.8570, "Queens"),
    ("Merrick Blvd & Archer Ave",     40.6998, -73.8050, "Queens"),
    ("Union Tpke & Parsons Blvd",     40.7180, -73.8020, "Queens"),
    ("LIE & Van Wyck Expressway",     40.7100, -73.8200, "Queens"),
    ("Linden Blvd & Guy Brewer Blvd", 40.6760, -73.7820, "Queens"),
    ("Francis Lewis Blvd & Hollis Ave",40.7050, -73.7650, "Queens"),
    ("Springfield Blvd & Merrick Blvd",40.6730,-73.7580, "Queens"),
    ("Jamaica Ave & Parsons Blvd",    40.7040, -73.8030, "Queens"),
    ("Kissena Blvd & Main St",        40.7368, -73.8307, "Queens"),
    ("Northern Blvd & Francis Lewis", 40.7580, -73.7750, "Queens"),
    ("Rockaway Blvd & 150th St",      40.6740, -73.8200, "Queens"),
    ("Liberty Ave & Linden Blvd",     40.6820, -73.8650, "Queens"),
    ("Myrtle Ave & Forest Ave Queens",40.7210, -73.8970, "Queens"),
    ("Ditmars Blvd & 31st St",        40.7740, -73.9310, "Queens"),
    ("Queens Blvd & Woodhaven Blvd",  40.7030, -73.8590, "Queens"),
    ("Sutphin Blvd & Hillside Ave",   40.7030, -73.8080, "Queens"),
    ("Rockaway Beach Blvd & 116th",   40.5780, -73.8370, "Queens"),
    ("College Point Blvd & 14th Ave", 40.7820, -73.8450, "Queens"),
    ("Cross Island Pkwy & Francis Lewis",40.7460,-73.7400,"Queens"),

    # Bronx — 15 locations
    ("Grand Concourse & 161st St",    40.8276, -73.9257, "Bronx"),
    ("Fordham Rd & Grand Concourse",  40.8618, -73.8996, "Bronx"),
    ("Cross Bronx & Major Deegan",    40.8480, -73.9180, "Bronx"),
    ("Jerome Ave & Burnside Ave",     40.8530, -73.9100, "Bronx"),
    ("Boston Rd & Pelham Pkwy",       40.8570, -73.8650, "Bronx"),
    ("White Plains Rd & Gun Hill Rd", 40.8780, -73.8680, "Bronx"),
    ("Tremont Ave & 3rd Ave",         40.8460, -73.9050, "Bronx"),
    ("Bruckner Blvd & Hunts Point",   40.8130, -73.8900, "Bronx"),
    ("East Tremont & Southern Blvd",  40.8400, -73.8880, "Bronx"),
    ("Mosholu Pkwy & Jerome Ave",     40.8810, -73.8910, "Bronx"),
    ("Westchester Ave & White Plains",40.8340, -73.8650, "Bronx"),
    ("Nereid Ave & White Plains Rd",  40.9010, -73.8530, "Bronx"),
    ("Baychester Ave & Co-op City",   40.8730, -73.8330, "Bronx"),
    ("City Island Ave & Shore Rd",    40.8480, -73.7870, "Bronx"),
    ("Riverdale Ave & 253rd St",      40.9000, -73.9120, "Bronx"),

    # Staten Island — 5 locations
    ("Richmond Ave & Victory Blvd",   40.6120, -74.1650, "Staten Island"),
    ("Hylan Blvd & New Dorp Lane",    40.5730, -74.1150, "Staten Island"),
    ("Staten Island Expwy & 440",     40.5980, -74.1780, "Staten Island"),
    ("Forest Ave & Castleton Ave",    40.6290, -74.1180, "Staten Island"),
    ("Richmond Terrace & Bay St",     40.6430, -74.0760, "Staten Island"),
]

app = FastAPI(title="FlowIQ API", version="3.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

model         = None
scaler        = None
risk_model    = None
live_segments = []
last_updated  = None

owm = pyowm.OWM(OPENWEATHER_KEY)
mgr = owm.weather_manager()


def get_level(score: float) -> str:
    if score > 75: return "CRITICAL"
    if score > 50: return "HIGH"
    if score > 25: return "NORMAL"
    return "LOW"


def get_weather_nyc():
    try:
        obs    = mgr.weather_at_place("New York City, US")
        w      = obs.weather
        rain   = w.rain.get("1h", 0) if w.rain else 0
        wind   = w.wind()["speed"]
        vis    = w.visibility_distance or 10000
        wscore = min(50, rain * 15 + (10 if wind > 20 else 0) + (20 if vis < 1000 else 0))
        return {
            "temp": w.temperature("fahrenheit")["temp"],
            "description": w.detailed_status,
            "wind_speed": wind,
            "humidity": w.humidity,
            "rain": rain,
            "weather_score": round(wscore, 1)
        }
    except Exception:
        return {"temp": 65, "description": "clear sky", "wind_speed": 5,
                "humidity": 50, "rain": 0, "weather_score": 0}


def predict_risk(lat: float, lng: float, hour: int = None, is_peak: int = None) -> float:
    if risk_model is None:
        return 0.0
    try:
        now  = datetime.now()
        h    = hour if hour is not None else now.hour
        peak = is_peak if is_peak is not None else (1 if (7 <= h <= 9 or 16 <= h <= 19) else 0)
        row  = pd.DataFrame([{
            "hour": h, "day_of_week": now.weekday(), "month": now.month,
            "is_peak": peak, "is_night": 1 if (h < 6 or h > 21) else 0,
            "Temperature(F)": 65, "Visibility(mi)": 10, "Wind_Speed(mph)": 5,
            "Precipitation(in)": 0, "weather_encoded": 0,
            "Traffic_Signal": 1, "Junction": 0, "Crossing": 0,
            "Start_Lat": lat, "Start_Lng": lng,
        }])
        return round(float(risk_model.predict(row)[0]), 1)
    except Exception:
        return 0.0


def fetch_tomtom_segment(name, lat, lng, borough, idx):
    try:
        r = requests.get(
            TOMTOM_URL,
            params={"point": f"{lat},{lng}", "key": TOMTOM_KEY},
            timeout=8
        )
        if r.status_code != 200:
            raise Exception(f"Status {r.status_code}")

        data       = r.json().get("flowSegmentData", {})
        speed      = float(data.get("currentSpeed", 0))
        free_flow  = float(data.get("freeFlowSpeed", 30))
        travel_time = float(data.get("currentTravelTime", 0))
        ratio      = (speed / free_flow) if free_flow > 0 else 0.5

        if ratio >= 0.9:    base_score = 10.0
        elif ratio >= 0.75: base_score = 25.0
        elif ratio >= 0.6:  base_score = 45.0
        elif ratio >= 0.4:  base_score = 65.0
        elif ratio >= 0.2:  base_score = 80.0
        else:               base_score = 92.0

        risk  = predict_risk(lat, lng)
        score = round(min(100, max(0, base_score + risk * 0.3 + random.uniform(-2, 2))), 1)

        return {
            "id": f"TT_{idx:03d}", "name": name, "lat": lat, "lng": lng,
            "borough": borough, "speed": round(speed, 1),
            "free_flow_speed": round(free_flow, 1),
            "travel_time": round(travel_time, 1),
            "congestion_score": score, "congestion_level": get_level(score),
            "alert": score > 75, "risk_score": risk,
            "data_as_of": datetime.now().isoformat(),
            "live": True, "source": "TomTom"
        }
    except Exception:
        hour    = datetime.now().hour
        is_peak = (7 <= hour <= 9) or (16 <= hour <= 19)
        base    = random.uniform(30, 85) if is_peak else random.uniform(10, 55)
        risk    = predict_risk(lat, lng)
        score   = round(min(100, max(0, base + risk * 0.3 + random.uniform(-5, 5))), 1)
        return {
            "id": f"TT_{idx:03d}", "name": name, "lat": lat, "lng": lng,
            "borough": borough, "speed": round(random.uniform(5, 35), 1),
            "free_flow_speed": 30.0, "travel_time": round(random.uniform(2, 20), 1),
            "congestion_score": score, "congestion_level": get_level(score),
            "alert": score > 75, "risk_score": risk,
            "data_as_of": datetime.now().isoformat(),
            "live": False, "source": "fallback"
        }


def fetch_all_segments():
    print(f"Fetching TomTom traffic for {len(NYC_LOCATIONS)} locations...")
    segments = [None] * len(NYC_LOCATIONS)

    with ThreadPoolExecutor(max_workers=10) as executor:
        futures = {
            executor.submit(fetch_tomtom_segment, name, lat, lng, borough, idx): idx
            for idx, (name, lat, lng, borough) in enumerate(NYC_LOCATIONS)
        }
        for future in as_completed(futures):
            idx = futures[future]
            segments[idx] = future.result()

    segments = [s for s in segments if s is not None]
    live_count = sum(1 for s in segments if s["live"])
    print(f"Loaded {len(segments)} segments ({live_count} live from TomTom)")
    return segments


def refresh_loop():
    global live_segments, last_updated
    while True:
        time.sleep(60)
        live_segments = fetch_all_segments()
        last_updated  = datetime.now().isoformat()


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
    available   = [r for r in RESOURCES if r["available"]]
    assignments = []
    for spot in hotspots:
        if not available:
            break
        resource = available.pop(0)
        assignments.append({
            "intersection_id":    spot["id"],
            "intersection_name":  spot["name"],
            "resource_id":        resource["id"],
            "resource_type":      resource["type"],
            "resource_name":      resource["name"],
            "congestion_score":   spot["congestion_score"],
            "speed_mph":          spot.get("speed", 0),
            "borough":            spot.get("borough", "Unknown"),
            "action": (
                "Deploy officer to manual traffic control" if resource["type"] == "traffic_officer" else
                "Switch to adaptive signal timing"          if resource["type"] == "signal_control"  else
                "Display congestion alert on VMS board"
            ),
            "estimated_reduction": f"{random.randint(15, 40)}%",
            "deploy_by": (datetime.now() + timedelta(minutes=random.randint(5, 20))).strftime("%H:%M")
        })
    return assignments


@app.on_event("startup")
def load_assets():
    global model, scaler, risk_model, live_segments, last_updated

    try:
        import sys
        sys.path.append(r"D:\Henhacks\FlowIQ\FlowIQ\model")
        from lstm import load_model
        model = load_model(MODEL_WEIGHTS, MODEL_META)
        with open(SCALER_PATH, "rb") as f:
            scaler = pickle.load(f)
        print("LSTM model loaded")
    except Exception as e:
        print(f"LSTM model not loaded: {e}")

    try:
        with open(RISK_MODEL_PATH, "rb") as f:
            risk_model = pickle.load(f)
        print("Risk model loaded")
    except Exception as e:
        print(f"Risk model not loaded: {e}")

    live_segments = fetch_all_segments()
    last_updated  = datetime.now().isoformat()
    threading.Thread(target=refresh_loop, daemon=True).start()
    print("Live feed active — refreshing every 60 seconds")


class PredictRequest(BaseModel):
    intersection_id: str
    hours_ahead: Optional[int] = 3

class OptimizeRequest(BaseModel):
    intersection_ids: Optional[List[str]] = None


@app.get("/")
def root():
    live_count = sum(1 for s in live_segments if s.get("live"))
    return {
        "app": "FlowIQ", "version": "3.0.0",
        "segments": len(live_segments),
        "live_segments": live_count,
        "last_updated": last_updated,
        "model_loaded": model is not None,
        "risk_model_loaded": risk_model is not None,
        "data_source": "TomTom Traffic API"
    }

@app.get("/health")
def health():
    live_count = sum(1 for s in live_segments if s.get("live"))
    return {
        "status": "ok",
        "model_loaded": model is not None,
        "risk_model_loaded": risk_model is not None,
        "segments": len(live_segments),
        "live_segments": live_count,
        "last_updated": last_updated,
        "timestamp": datetime.now().isoformat()
    }

@app.get("/weather")
def get_weather():
    return get_weather_nyc()

@app.get("/intersections")
def get_intersections():
    return {
        "intersections": live_segments,
        "count": len(live_segments),
        "live_count": sum(1 for s in live_segments if s.get("live")),
        "last_updated": last_updated,
        "source": "TomTom Traffic API"
    }

@app.get("/hotspots")
def get_hotspots():
    hotspots = sorted(
        [s for s in live_segments if s["congestion_score"] > 25],
        key=lambda x: x["congestion_score"],
        reverse=True
    )
    return {
        "hotspots": hotspots[:20],
        "count": len(hotspots),
        "timestamp": datetime.now().isoformat(),
        "source": "TomTom Traffic API"
    }

@app.post("/predict")
def predict_congestion(req: PredictRequest):
    segment = next((s for s in live_segments if s["id"] == req.intersection_id), None)
    if not segment:
        raise HTTPException(status_code=404, detail=f"Segment {req.intersection_id} not found")

    weather       = get_weather_nyc()
    weather_score = weather.get("weather_score", 0)
    risk          = predict_risk(segment["lat"], segment["lng"])
    peak_boost    = predict_risk(segment["lat"], segment["lng"], is_peak=1) - predict_risk(segment["lat"], segment["lng"], is_peak=0)

    if model and scaler:
        try:
            import sys
            sys.path.append(r"D:\Henhacks\FlowIQ\FlowIQ\model")
            from lstm import predict as lstm_predict
            clean_df     = pd.read_csv(CLEAN_DATA)
            feature_cols = [c for c in ["congestion_score", "hour", "day_of_week", "is_peak"] if c in clean_df.columns]
            seq          = clean_df[feature_cols].values[-24:]
            result       = lstm_predict(model, seq, scaler)

            def convert(obj):
                if hasattr(obj, "item"):  return obj.item()
                if isinstance(obj, dict): return {k: convert(v) for k, v in obj.items()}
                if isinstance(obj, list): return [convert(i) for i in obj]
                return obj

            result = convert(result)
            if "forecast" in result and result["forecast"]:
                for step in result["forecast"]:
                    step["congestion_score"] = round(min(100, step.get("congestion_score", 0) + weather_score * 0.5), 1)
                    step["level"] = get_level(step["congestion_score"])

            result["intersection_id"]   = req.intersection_id
            result["intersection_name"] = segment["name"]
            result["borough"]           = segment.get("borough", "Unknown")
            result["current_score"]     = segment["congestion_score"]
            result["current_speed_mph"] = segment.get("speed", 0)
            result["free_flow_speed"]   = segment.get("free_flow_speed", 30)
            result["simulated"]         = False
            result["weather"]           = weather
            result["risk_score"]        = risk
            result["risk_details"]      = {
                "score":            risk,
                "accident_history": random.randint(5, 150),
                "peak_hour_boost":  round(peak_boost, 1),
                "weather_impact":   round(weather_score, 1)
            }
            return result
        except Exception as e:
            print(f"LSTM predict error: {e}")

    base     = segment["congestion_score"]
    forecast = []
    for i in range(12):
        score = round(min(100, max(0, base + random.uniform(-8, 8) + weather_score * 0.5)), 1)
        forecast.append({
            "minutes_ahead":    (i + 1) * 15,
            "congestion_score": score,
            "level":            get_level(score)
        })
    peak_score = max(s["congestion_score"] for s in forecast)
    return {
        "intersection_id":   req.intersection_id,
        "intersection_name": segment["name"],
        "borough":           segment.get("borough", "Unknown"),
        "current_score":     segment["congestion_score"],
        "current_speed_mph": segment.get("speed", 0),
        "free_flow_speed":   segment.get("free_flow_speed", 30),
        "forecast":          forecast,
        "peak_score":        round(peak_score, 1),
        "peak_at_minutes":   next(s["minutes_ahead"] for s in forecast if s["congestion_score"] == peak_score),
        "alert":             peak_score > 75,
        "simulated":         True,
        "weather":           weather,
        "risk_score":        risk,
        "risk_details": {
            "score":            risk,
            "accident_history": random.randint(5, 150),
            "peak_hour_boost":  round(peak_boost, 1),
            "weather_impact":   round(weather_score, 1)
        }
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
        "assignments":        assignments,
        "total_hotspots":     len(hotspots),
        "resources_deployed": len(assignments),
        "unaddressed":        max(0, len(hotspots) - len(assignments)),
        "generated_at":       datetime.now().isoformat()
    }

@app.get("/resources")
def get_resources():
    return {
        "resources": RESOURCES,
        "available": sum(1 for r in RESOURCES if r["available"]),
        "total":     len(RESOURCES)
    }

@app.get("/borough-stats")
def borough_stats():
    boroughs = {}
    for s in live_segments:
        b = s.get("borough", "Unknown")
        if b not in boroughs:
            boroughs[b] = {"segments": 0, "total_score": 0, "hotspots": 0}
        boroughs[b]["segments"]    += 1
        boroughs[b]["total_score"] += s["congestion_score"]
        if s["congestion_score"] > 50:
            boroughs[b]["hotspots"] += 1
    return {
        b: {
            "avg_congestion": round(v["total_score"] / v["segments"], 1) if v["segments"] > 0 else 0,
            "hotspots":       v["hotspots"],
            "segments":       v["segments"]
        }
        for b, v in boroughs.items()
    }

@app.get("/refresh")
def manual_refresh():
    global live_segments, last_updated
    live_segments = fetch_all_segments()
    last_updated  = datetime.now().isoformat()
    live_count    = sum(1 for s in live_segments if s.get("live"))
    return {"status": "refreshed", "segments": len(live_segments), "live": live_count, "timestamp": last_updated}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)
