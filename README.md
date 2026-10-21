# 🌿 EcoTrack AI — Personal Carbon Footprint & Green Impact Tracker

> **2nd Year Engineering Project (EDI / Course Project)**  
> **Tech Stack:** HTML5, CSS3, JavaScript (ES6+ Modules), Chart.js, Python (Flask + Scikit-Learn + SQLite)

---

## 🚀 How to Run the Application

Start the Flask server with a single command:

```bash
C:\venvs\ecotrack\Scripts\python.exe backend\app.py
```

Then open your browser at:
**`http://127.0.0.1:5000`**

The Flask application serves both the backend REST API (`/api/*`) and the static frontend UI (`/`, `/css/*`, `/js/*`).

---

## 🧪 How to Run Automated Tests

To run the complete backend API and database test suite:

```bash
C:\venvs\ecotrack\Scripts\python.exe -m unittest discover -s backend/tests -v
```

All 52 tests execute against isolated temporary SQLite databases (`tempfile`), leaving the live production database untouched.

---

## 📁 Repository & Data Directory Structure

```text
Website/
├── frontend/                        # User Interface (Vanilla JS ES Modules)
│   ├── index.html                   # Main dashboard, MCQ Quick Logger, and modals
│   ├── css/
│   │   └── styles.css               # Dark eco-theme styling and responsive layouts
│   └── js/
│       ├── app.js                   # Application controller & async API bootstrapper
│       ├── carbon-calc.js           # Client-side offline fallback emission factors
│       ├── ai-engine.js             # Client-side green score & OLS regression fallback
│       ├── charts.js                # Chart.js rendering (donut, trend, trajectory)
│       ├── mock-data.js             # Initial 14-day sample demo data & benchmarks
│       └── modules/
│           ├── api.js               # Typed fetch client with 3s timeout protection
│           ├── state.js             # Reactive AppState & DOM element cache
│           ├── storage.js           # LocalStorage wrapper
│           ├── dashboard.js         # KPIs, recommendations, history table rendering
│           ├── logger-form.js       # MCQ Quick Logger, Monthly Logger, and sync
│           ├── events.js            # Tab switching, debounced sliders, event delegation
│           └── modals.js            # Profile and Viva defense modal handlers
│
├── backend/                         # Python Backend (Flask + ML + SQLite)
│   ├── app.py                       # REST API endpoints & Scikit-learn OLS model
│   ├── requirements.txt             # Python dependencies
│   ├── data/                        # Externalized datasets & configuration
│   │   ├── config.json              # Benchmarks, predict weights, limits, LPG & shopping
│   │   ├── emission_factors.json    # 7 categories with scientific honesty flags (verified)
│   │   ├── recommendations.json     # Actionable reduction tips sorted by impact
│   │   └── ecotrack.db              # SQLite persistent database (auto-created)
│   ├── db/
│   │   ├── schema.sql               # Database schema definition with index
│   │   └── database.py              # Parameterized SQLite queries & daily aggregation
│   └── tests/
│       └── test_api.py              # Comprehensive unit tests (52 tests)
│
├── .gitignore                       # Git ignore list (caches, venvs, ecotrack.db)
└── README.md                        # Documentation
```

---

## 🔌 Backend REST API Endpoints

All endpoints start with `/api` and strictly return JSON (including 400, 404, 405, and 500 error handlers):

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Server heartbeat and operational status |
| `GET` | `/api/factors` | Complete emission factors dataset with `verified` honesty flag |
| `GET` | `/api/config` | International benchmarks, predict weights, and limits |
| `POST` | `/api/activities` | Logs user activity; server calculates CO2e and saves to SQLite |
| `GET` | `/api/activities` | Lists newest logged activities with optional `limit` & `category` |
| `DELETE` | `/api/activities/<id>` | Deletes an activity record by primary key |
| `GET` | `/api/summary?days=N` | Continuous daily total & category breakdown for the last N days |
| `POST` | `/api/predict` | Runs Scikit-learn `LinearRegression` (OLS) on historical daily totals |
| `POST` | `/api/recommendations` | Returns tailored CO2 reduction recommendations sorted by savings |

---

## ⚡ Offline Fallback & Automatic Sync

EcoTrack AI is built with an offline-first resilient architecture:
* **Instant First Paint**: The frontend never blocks rendering on the network.
* **Offline Detection**: If the Flask server is stopped or opened via `file://`, the UI falls back seamlessly to browser-side local engines (`carbon-calc.js`, `mock-data.js`, and browser OLS regression in `ai-engine.js`). A non-intrusive **"Offline mode"** badge appears in the top header.
* **Queued Sync**: Activities logged while offline are stored in `localStorage` marked with `pending sync: true`.
* **Idempotent Background Sync**: Once the Flask server reconnects, the frontend automatically syncs pending entries to SQLite and re-fetches the continuous summary without creating duplicate records. The header badge switches to **"Connected"**.

---

## ⚠️ Known Limitations

1. **Single-User Architecture**: The database currently defaults to `user_id = 1`. Multi-user authentication sessions (JWT/cookies) are planned for the next semester phase.
2. **Synthetic Sample Data**: Initial 14-day history charts display synthetic benchmark data labeled `"Sample data"` until the user logs their own real activities.
3. **Unsourced Emission Factors**: Only **Petrol Car** (DEFRA), **Diesel Car** (DEFRA), and **Grid Electricity** (CEA / IPCC) carry peer-reviewed citations (`verified: true`). The remaining factors (auto rickshaw, food items, water, waste, shopping) are domain project estimates (`verified: false`).
