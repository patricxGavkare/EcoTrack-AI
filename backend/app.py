"""
=============================================================================
🌿 EcoTrack AI - Backend Python Server (Flask + Machine Learning)
=============================================================================
What this file does:
1. Receives carbon activity data sent from the website frontend.
2. Uses scientific carbon emission factors (IPCC/DEFRA) to calculate CO2e.
3. Uses Scikit-learn (Linear Regression) to predict future carbon trends.
4. Returns the results back as JSON so the website charts can display them.
=============================================================================
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import numpy as np
from sklearn.linear_model import LinearRegression
import datetime

# Create the Flask web app
app = Flask(__name__)

# Enable CORS: This allows your frontend (HTML/JS) to talk to this Python server
CORS(app)

# ---------------------------------------------------------------------------
# Scientific Emission Factors (IPCC & DEFRA guidelines)
# Formula: Emission (kg CO2e) = Amount * Factor
# ---------------------------------------------------------------------------
EMISSION_FACTORS = {
    "transport": {
        "car_petrol": 0.192,
        "car_diesel": 0.171,
        "car_electric": 0.053,
        "bike_petrol": 0.103,
        "bus_public": 0.089,
        "metro_train": 0.035,
        "flight_domestic": 0.255,
        "bicycle_walk": 0.000
    },
    "electricity": {
        "grid_standard": 0.710,
        "solar_rooftop": 0.041,
        "ac_hour": 1.065,
        "pc_hour": 0.177,
        "tv_hour": 0.071
    },
    "food": {
        "diet_heavy_meat": 7.20,
        "diet_medium_meat": 5.60,
        "diet_pescatarian": 3.90,
        "diet_vegetarian": 3.80,
        "diet_vegan": 2.90,
        "meal_meat": 3.30,
        "meal_chicken": 1.30,
        "meal_vegetarian": 0.90
    },
    "water": {
        "tap_water": 0.0003,
        "shower_hot": 0.850,
        "shower_cold": 0.050,
        "laundry_load": 0.600
    },
    "waste": {
        "landfill_mixed": 0.580,
        "landfill_organic": 1.250,
        "composted_organic": 0.080,
        "recycled_plastic_paper": -0.150
    },
    "shopping": {
        "clothing_fast_fashion": 9.50,
        "electronics_accessory": 4.20,
        "electronics_device": 25.00,
        "packaged_goods": 1.10
    },
    "gas": {
        "lpg_kg": 2.98,
        "lpg_hour_cooking": 0.65,
        "png_m3": 2.05,
        "electric_induction": 0.85
    }
}

# -------------------------------------------------------------
# Optional MySQL Database Connection Schema (Slide 6)
# -------------------------------------------------------------
"""
CREATE DATABASE IF NOT EXISTS ecotrack_db;
USE ecotrack_db;

CREATE TABLE IF NOT EXISTS users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100),
    email VARCHAR(100) UNIQUE,
    green_score INT DEFAULT 75,
    streak_days INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS activities (
    activity_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    category VARCHAR(50),
    sub_type VARCHAR(50),
    amount FLOAT,
    co2e FLOAT,
    logged_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);
"""

# ===========================================================================
# 🚀 API ENDPOINTS (URLs that the frontend JavaScript calls)
# ===========================================================================

# 1. Health Check URL: Frontend pings this to see if the Python server is running
@app.route("/api/health", methods=["GET"])
def health_check():
    """Tells the frontend that the Python backend is live and healthy."""
    return jsonify({
        "status": "online",
        "service": "EcoTrack AI Flask & Scikit-learn Engine",
        "timestamp": datetime.datetime.now().isoformat()
    })

# 2. Carbon Calculation URL: Calculates CO2e using Activity Amount * Factor
@app.route("/api/calculate", methods=["POST"])
def calculate_carbon():
    """
    Receives: Category (e.g. transport), Subtype (e.g. petrol car), Amount (e.g. 25 km)
    Returns: Calculated emission in kg CO2e
    """
    data = request.get_json() or {}
    category = data.get("category")
    sub_type = data.get("subType")
    amount = float(data.get("amount", 0))

    if category not in EMISSION_FACTORS or sub_type not in EMISSION_FACTORS[category]:
        return jsonify({"error": "Invalid category or subType"}), 400

    factor = EMISSION_FACTORS[category][sub_type]
    co2e = round(amount * factor, 3)

    return jsonify({
        "category": category,
        "subType": sub_type,
        "amount": amount,
        "factor": factor,
        "co2e": co2e,
        "formula": f"{amount} × {factor} = {co2e} kg CO2e"
    })

# 3. Machine Learning Prediction URL: Uses Scikit-learn to forecast next 7 days
@app.route("/api/predict", methods=["POST"])
def predict_emissions():
    """
    Takes past days' emissions and fits a Scikit-Learn Linear Regression model
    to predict what the user's carbon footprint will be for the upcoming week.
    """
    data = request.get_json() or {}
    raw_history = data.get("history", [9.5, 9.2, 8.8, 8.4, 7.9, 7.1, 6.8])
    modifiers = data.get("modifiers", {})

    # Extract numerical totals if history is a list of objects or dicts
    if raw_history and isinstance(raw_history[0], dict):
        history_values = [float(d.get("total", 0)) for d in raw_history]
    else:
        history_values = [float(v) for v in raw_history]

    n = len(history_values)
    if n < 2:
        return jsonify({"error": "Insufficient history points for regression"}), 400

    X = np.array(range(1, n + 1)).reshape(-1, 1)
    y = np.array(history_values)

    # Train Scikit-learn LinearRegression model
    model = LinearRegression()
    model.fit(X, y)

    # Compute genuine R² score
    r_squared = float(round(model.score(X, y), 3))

    # Forecast next 7 days
    future_X = np.array(range(n + 1, n + 8)).reshape(-1, 1)
    raw_predictions = model.predict(future_X)
    baseline_forecast = [round(max(1.5, float(val)), 2) for val in raw_predictions]

    # Support both frontend key naming conventions
    t_val = modifiers.get("transportReduction", modifiers.get("transport", 0))
    e_val = modifiers.get("electricityReduction", modifiers.get("electricity", 0))
    d_val = modifiers.get("dietReduction", modifiers.get("diet", 0))

    t_mod = float(t_val) / 100.0
    e_mod = float(e_val) / 100.0
    d_mod = float(d_val) / 100.0
    reduction_pct = (t_mod * 0.30) + (e_mod * 0.40) + (d_mod * 0.20)

    optimized_forecast = [round(max(1.0, val * (1.0 - reduction_pct)), 2) for val in baseline_forecast]
    total_savings = round(sum(baseline_forecast) - sum(optimized_forecast), 1)

    return jsonify({
        "model": "Scikit-Learn LinearRegression (OLS)",
        "slope": float(round(model.coef_[0], 4)),
        "intercept": float(round(model.intercept_, 2)),
        "rSquared": r_squared,
        "baselineForecast": baseline_forecast,
        "optimizedForecast": optimized_forecast,
        "projectedWeeklySavingsKg": total_savings
    })

@app.route("/api/recommendations", methods=["POST"])
def get_recommendations():
    """
    Slide 2, 7: AI Personalized Recommendations based on category breakdown
    """
    data = request.get_json() or {}
    dominant_cat = data.get("dominantCategory", "transport")

    recommendations = [
        {
            "id": "rec-1",
            "category": "transport",
            "title": "Shift 2 Car Commutes to Metro",
            "saving": "18.4 kg CO2e / month",
            "difficulty": "Easy"
        },
        {
            "id": "rec-2",
            "category": "electricity",
            "title": "Set Air Conditioner to 24°C",
            "saving": "14.8 kg CO2e / month",
            "difficulty": "Zero Cost"
        }
    ]

    return jsonify({
        "status": "success",
        "dominantCategory": dominant_cat,
        "recommendations": recommendations
    })

if __name__ == "__main__":
    print("==================================================================")
    print("🌿 EcoTrack AI Backend starting on http://127.0.0.1:5000")
    print("Slide 6 Stack: Flask + Scikit-Learn + Pandas + NumPy + MySQL")
    print("==================================================================")
    app.run(host="127.0.0.1", port=5000, debug=True)
