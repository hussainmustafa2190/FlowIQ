# FlowIQ 🚦
### Predictive City Traffic Intelligence System

> *"Don't react to traffic. Prevent it."*

FlowIQ predicts traffic congestion **1-3 hours ahead** and automatically deploys city resources before commuters get stuck. Built for NYC's Department of Transportation operations center — and the 8 million commuters who depend on it.

---

## 🧠 How It Works

1. **Predict** — LSTM neural network forecasts congestion at 100 NYC intersections up to 3 hours ahead
2. **Risk Score** — Random Forest model trained on 7M US accidents scores historical danger at each location
3. **Weather** — Live OpenWeather data adjusts predictions in real time
4. **Optimize** — AI assigns city resources (officers, signal units, VMS boards) to highest-impact hotspots
5. **Act** — Dispatchers deploy resources before gridlock forms

---

## 🗺️ Coverage

- **100 intersections** across all 5 boroughs
- Manhattan, Brooklyn, Queens, Bronx, Staten Island
- Live speed data from **TomTom Traffic API**
- Refreshed every 60 seconds

---

## 🤖 AI Stack

| Model | Purpose | Dataset |
|-------|---------|---------|
| LSTM Neural Network | 3-hour congestion forecast | 48,000+ traffic records (Kaggle) |
| Random Forest | Accident risk scoring | 7M US accidents (2016-2023) |
| TomTom API | Live speed feed | Real-time NYC traffic |
| OpenWeather API | Weather impact | Live NYC weather |

---

## 🚀 Quick Start

### Backend
```bash
cd api
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

### Environment Variables
Create `api/.env`:
```
OPENWEATHER_KEY=your_key_here
TOMTOM_KEY=your_key_here
```

Create `frontend/.env`:
```
VITE_MAPBOX_TOKEN=your_token_here
```

---

## 📡 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/intersections` | GET | All 100 live intersections |
| `/hotspots` | GET | Active congestion hotspots |
| `/predict` | POST | 3-hour forecast for intersection |
| `/optimize` | POST | AI resource deployment plan |
| `/weather` | GET | Live NYC weather |
| `/borough-stats` | GET | Congestion by borough |
| `/resources` | GET | Available city resources |

---

## 🏙️ Who Uses FlowIQ

**City Operations Center** — Traffic engineers and dispatchers get a 3-hour window to act before congestion forms

**Commuters** — Real-time alerts on which roads to avoid and when to leave

---

## 🏗️ Architecture

```
TomTom API ──┐
OpenWeather ─┤──► FastAPI Backend ──► React Dashboard
US Accidents ─┤         │
Kaggle Data ──┘    LSTM + RF Models
```

---

## 👥 Team

Built at HenHacks 2026 in under 24 hours.

---

## 📄 License

MIT
