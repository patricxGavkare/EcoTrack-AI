"""
=============================================================================
🌿 EcoTrack AI - Backend Python Server (Flask + Machine Learning)
=============================================================================
What this file does:
1. Receives carbon activity data sent from the website frontend.
2. Uses scientific carbon emission factors (IPCC/DEFRA) to calculate CO2e.
3. Uses Scikit-learn (Linear Regression) to predict future carbon trends.
4. Returns the results back as JSON so the website charts can display them.
5. Persists and aggregates logged activities via local SQLite database.
=============================================================================
"""

import os
import sys
import json
import math
import mimetypes
import datetime
from flask import Flask, request, jsonify, send_from_directory, abort
from flask_cors import CORS
from werkzeug.exceptions import HTTPException
import numpy as np
from sklearn.linear_model import LinearRegression

from db.database import (
    init_db,
    insert_activity,
    list_activities,
    delete_activity,
    daily_totals,
    get_default_db_path
)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
FRONTEND_DIR = os.path.abspath(os.path.join(BASE_DIR, "..", "frontend"))

def load_json_file(filename):
    """Loads a configuration or data JSON file from backend/data/."""
    file_path = os.path.join(DATA_DIR, filename)
    if not os.path.isfile(file_path):
        sys.exit(f"Configuration file missing: {filename} at {file_path}")
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            return json.load(f)
    except json.JSONDecodeError as exc:
        sys.exit(f"Invalid JSON in file: {filename} ({file_path}): {exc}")
    except Exception as exc:
        sys.exit(f"Error reading file {filename} ({file_path}): {exc}")

# Load operational constants and datasets once at startup
EMISSION_FACTORS = load_json_file("emission_factors.json")
CONFIG = load_json_file("config.json")
RECOMMENDATIONS_DATA = load_json_file("recommendations.json")

# Ensure .js files are served with the proper JavaScript MIME type
mimetypes.add_type('text/javascript', '.js')
mimetypes.add_type('text/css', '.css')

# Create Flask app without default catch-all static rule
app = Flask(__name__, static_folder=None)

# Enable CORS: This allows your frontend (HTML/JS) to talk to this Python server
CORS(app)

def get_db_path():
    """Resolves active database file path, honoring test overrides in app.config."""
    if "DATABASE_PATH" in app.config and app.config["DATABASE_PATH"]:
        return app.config["DATABASE_PATH"]
    rel_path = CONFIG.get("database", {}).get("path", "data/ecotrack.db")
    return os.path.abspath(os.path.join(BASE_DIR, rel_path))

# Automatically initialize database at startup
init_db(get_db_path())

def parse_json_object():
    """Validates that incoming POST request has a non-empty JSON object body."""
    if not request.is_json:
        return None, "Request must have Content-Type: application/json"
    try:
        data = request.get_json(silent=False)
    except Exception:
        return None, "Malformed or invalid JSON body"
    if data is None:
        return None, "Request body cannot be empty or null"
    if not isinstance(data, dict):
        return None, "Request body must be a JSON object"
    return data, None

# ===========================================================================
# 🚨 ERROR HANDLERS (Return clean JSON for all /api/ routes, no HTML/tracebacks)
# ===========================================================================

@app.errorhandler(404)
def handle_not_found(error):
    if request.path.startswith("/api/"):
        return jsonify({"error": "Resource not found"}), 404
    return error

@app.errorhandler(405)
def handle_method_not_allowed(error):
    if request.path.startswith("/api/"):
        return jsonify({"error": "Method not allowed"}), 405
    return error

@app.errorhandler(500)
def handle_internal_server_error(error):
    if request.path.startswith("/api/"):
        return jsonify({"error": "Internal server error"}), 500
    return error

@app.errorhandler(HTTPException)
def handle_http_exception(error):
    if request.path.startswith("/api/"):
        return jsonify({"error": error.description or "HTTP error"}), error.code
    return error

@app.errorhandler(Exception)
def handle_unhandled_exception(error):
    if request.path.startswith("/api/"):
        return jsonify({"error": "Internal server error"}), 500
    raise error

# ===========================================================================
# 🌐 STATIC AND DASHBOARD ROUTES (send_from_directory prevents ../ traversal)
# ===========================================================================

@app.route("/", methods=["GET"])
def index():
    """Serves the main frontend dashboard."""
    return send_from_directory(FRONTEND_DIR, "index.html")

@app.route("/<path:filename>", methods=["GET"])
def serve_static(filename):
    """Serves static assets from frontend/, disallowing API path hijacking."""
    if filename.startswith("api/") or filename == "api":
        target_rule = "/" + filename
        for rule in app.url_map.iter_rules():
            if rule.rule == target_rule and "GET" not in rule.methods:
                abort(405)
        abort(404)
    return send_from_directory(FRONTEND_DIR, filename)

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

# 2. Emission Factors Catalog URL
@app.route("/api/factors", methods=["GET"])
def get_factors():
    """Returns the scientific emission factors catalog."""
    return jsonify(EMISSION_FACTORS)

# 3. Application Configuration URL
@app.route("/api/config", methods=["GET"])
def get_config():
    """Returns benchmarks, predict weights, and calculation/prediction limits."""
    pred_conf = CONFIG.get("predict", {})
    calc_conf = CONFIG.get("calculate", {})
    db_conf = CONFIG.get("database", {})
    return jsonify({
        "benchmarks": CONFIG.get("benchmarks", {}),
        "predict_weights": pred_conf.get("modifier_weights", {}),
        "limits": {
            "min_amount": calc_conf.get("min_amount"),
            "max_amount": calc_conf.get("max_amount"),
            "min_history_points": pred_conf.get("min_history_points"),
            "max_history_points": pred_conf.get("max_history_points"),
            "min_modifier": pred_conf.get("min_modifier"),
            "max_modifier": pred_conf.get("max_modifier"),
            "forecast_days": pred_conf.get("forecast_days"),
            "baseline_floor_kg": pred_conf.get("baseline_floor_kg"),
            "optimized_floor_kg": pred_conf.get("optimized_floor_kg"),
            "default_list_limit": db_conf.get("default_list_limit"),
            "max_list_limit": db_conf.get("max_list_limit")
        },
        "recommendations": CONFIG.get("recommendations", {}),
        "database": {
            "default_list_limit": db_conf.get("default_list_limit"),
            "max_list_limit": db_conf.get("max_list_limit")
        }
    })

# 4. Carbon Calculation URL: Calculates CO2e using Activity Amount * Factor
@app.route("/api/calculate", methods=["POST"])
def calculate_carbon():
    """
    Receives: Category, Subtype, Amount
    Returns: Calculated emission in kg CO2e
    """
    data, err = parse_json_object()
    if err:
        return jsonify({"error": err}), 400

    category = data.get("category")
    sub_type = data.get("subType") if "subType" in data else data.get("sub_type")
    amount = data.get("amount")

    if not isinstance(category, str) or not isinstance(sub_type, str):
        return jsonify({"error": "Fields 'category' and 'subType' must be strings"}), 400

    categories = EMISSION_FACTORS.get("categories", {})
    if category not in categories:
        valid_cats = sorted(categories.keys())
        return jsonify({"error": f"Unknown category '{category}'. Valid categories: {valid_cats}"}), 400

    if sub_type not in categories[category]:
        valid_subtypes = sorted(categories[category].keys())
        return jsonify({"error": f"Unknown subType '{sub_type}'. Valid subTypes for '{category}': {valid_subtypes}"}), 400

    calc_conf = CONFIG["calculate"]
    min_amount = calc_conf["min_amount"]
    max_amount = calc_conf["max_amount"]

    if amount is None or isinstance(amount, bool) or not isinstance(amount, (int, float)) or math.isnan(amount) or math.isinf(amount):
        return jsonify({"error": "Field 'amount' must be a real number"}), 400

    if amount < min_amount or amount > max_amount:
        return jsonify({"error": f"Amount must be between {min_amount} and {max_amount}"}), 400

    factor_entry = categories[category][sub_type]
    factor = factor_entry["factor"] if isinstance(factor_entry, dict) else factor_entry
    co2e = round(amount * factor, 3)

    return jsonify({
        "category": category,
        "subType": sub_type,
        "amount": amount,
        "factor": factor,
        "co2e": co2e,
        "formula": f"{amount} × {factor} = {co2e} kg CO2e"
    })

# 5. Activity Logging & Management URLs
@app.route("/api/activities", methods=["POST"])
def create_activity():
    """
    Logs an activity into SQLite. The server calculates co2e using emission factors.
    Returns 201 with saved row including id and co2e.
    """
    data, err = parse_json_object()
    if err:
        return jsonify({"error": err}), 400

    category = data.get("category")
    sub_type = data.get("subType") if "subType" in data else data.get("sub_type")
    amount = data.get("amount")

    if not isinstance(category, str) or not isinstance(sub_type, str):
        return jsonify({"error": "Fields 'category' and 'subType' must be strings"}), 400

    categories = EMISSION_FACTORS.get("categories", {})
    if category not in categories:
        valid_cats = sorted(categories.keys())
        return jsonify({"error": f"Unknown category '{category}'. Valid categories: {valid_cats}"}), 400

    if sub_type not in categories[category]:
        valid_subtypes = sorted(categories[category].keys())
        return jsonify({"error": f"Unknown subType '{sub_type}'. Valid subTypes for '{category}': {valid_subtypes}"}), 400

    calc_conf = CONFIG["calculate"]
    min_amount = calc_conf["min_amount"]
    max_amount = calc_conf["max_amount"]

    if amount is None or isinstance(amount, bool) or not isinstance(amount, (int, float)) or math.isnan(amount) or math.isinf(amount):
        return jsonify({"error": "Field 'amount' must be a real number"}), 400

    if amount < min_amount or amount > max_amount:
        return jsonify({"error": f"Amount must be between {min_amount} and {max_amount}"}), 400

    # Optional loggedAt timestamp (defaults to current time)
    logged_at_raw = data.get("loggedAt") if "loggedAt" in data else data.get("logged_at")
    if logged_at_raw is not None:
        if not isinstance(logged_at_raw, str):
            return jsonify({"error": "Field 'loggedAt' must be a string"}), 400
        try:
            datetime.datetime.fromisoformat(logged_at_raw.replace("Z", "+00:00"))
            logged_at = logged_at_raw
        except Exception:
            return jsonify({"error": "Field 'loggedAt' must be a valid ISO 8601 string"}), 400
    else:
        logged_at = datetime.datetime.now(datetime.timezone.utc).isoformat()

    factor_entry = categories[category][sub_type]
    factor = factor_entry["factor"] if isinstance(factor_entry, dict) else factor_entry
    co2e = round(amount * factor, 3)

    saved_row = insert_activity(
        category=category,
        sub_type=sub_type,
        amount=amount,
        co2e=co2e,
        logged_at=logged_at,
        db_path=get_db_path()
    )

    return jsonify(saved_row), 201

@app.route("/api/activities", methods=["GET"])
def get_activities():
    """
    Returns logged activities newest first, with optional limit and category filters.
    """
    db_conf = CONFIG.get("database", {})
    default_limit = db_conf.get("default_list_limit", 50)
    max_limit = db_conf.get("max_list_limit", 500)

    raw_limit = request.args.get("limit")
    if raw_limit is not None:
        try:
            limit = int(raw_limit)
            if str(limit) != raw_limit.strip():
                return jsonify({"error": "Query parameter 'limit' must be an integer"}), 400
        except (ValueError, TypeError):
            return jsonify({"error": "Query parameter 'limit' must be an integer"}), 400
        if limit < 1 or limit > max_limit:
            return jsonify({"error": f"Query parameter 'limit' must be between 1 and {max_limit}"}), 400
    else:
        limit = default_limit

    category = request.args.get("category")
    if category is not None:
        categories = EMISSION_FACTORS.get("categories", {})
        if category not in categories:
            valid_cats = sorted(categories.keys())
            return jsonify({"error": f"Unknown category '{category}'. Valid categories: {valid_cats}"}), 400

    activities = list_activities(limit=limit, category=category, db_path=get_db_path())
    return jsonify(activities), 200

@app.route("/api/activities/<int:activity_id>", methods=["DELETE"])
def remove_activity(activity_id):
    """
    Deletes an activity by ID. Returns 200 with {"deleted": activity_id} or 404 if missing.
    """
    deleted = delete_activity(activity_id, db_path=get_db_path())
    if not deleted:
        return jsonify({"error": f"Activity with id {activity_id} not found"}), 404
    return jsonify({"deleted": activity_id}), 200

# 6. Activity Summary (Daily Aggregation across all categories)
@app.route("/api/summary", methods=["GET"])
def get_summary():
    """
    Returns continuous daily totals for the last N days (chronological order)
    with total and individual category totals.
    """
    pred_conf = CONFIG.get("predict", {})
    max_days = pred_conf.get("max_history_points", 365)

    raw_days = request.args.get("days")
    if raw_days is not None:
        try:
            days = int(raw_days)
            if str(days) != raw_days.strip():
                return jsonify({"error": "Query parameter 'days' must be an integer"}), 400
        except (ValueError, TypeError):
            return jsonify({"error": "Query parameter 'days' must be an integer"}), 400
        if days < 1 or days > max_days:
            return jsonify({"error": f"Query parameter 'days' must be between 1 and {max_days}"}), 400
    else:
        days = 14

    summary_list = daily_totals(days=days, db_path=get_db_path())
    return jsonify(summary_list), 200

# 7. Machine Learning Prediction URL: Uses Scikit-learn to forecast future trend
@app.route("/api/predict", methods=["POST"])
def predict_emissions():
    """
    Takes past days' emissions and fits a Scikit-Learn Linear Regression model
    to predict what the user's carbon footprint will be for the upcoming week.
    """
    data, err = parse_json_object()
    if err:
        return jsonify({"error": err}), 400

    pred_conf = CONFIG["predict"]
    min_pts = pred_conf["min_history_points"]
    max_pts = pred_conf["max_history_points"]

    if "history" in data:
        raw_history = data["history"]
    else:
        raw_history = pred_conf["default_history"]

    if not isinstance(raw_history, list):
        return jsonify({"error": "Field 'history' must be a list"}), 400

    n = len(raw_history)
    if n < min_pts or n > max_pts:
        return jsonify({"error": f"History points must be between {min_pts} and {max_pts}"}), 400

    history_values = []
    for idx, item in enumerate(raw_history):
        if isinstance(item, dict):
            if "total" not in item:
                return jsonify({"error": f"History item at index {idx} missing 'total'"}), 400
            val = item["total"]
        else:
            val = item

        if val is None or isinstance(val, bool) or not isinstance(val, (int, float)) or math.isnan(val) or math.isinf(val):
            return jsonify({"error": f"Invalid history value at index {idx}: must be a real number"}), 400
        if val < 0:
            return jsonify({"error": f"Negative history value at index {idx} not allowed"}), 400
        history_values.append(float(val))

    modifiers = data.get("modifiers", {})
    if modifiers is None:
        modifiers = {}
    if not isinstance(modifiers, dict):
        return jsonify({"error": "Field 'modifiers' must be an object"}), 400

    min_mod = pred_conf["min_modifier"]
    max_mod = pred_conf["max_modifier"]
    for mod_key, mod_val in modifiers.items():
        if mod_val is None or isinstance(mod_val, bool) or not isinstance(mod_val, (int, float)) or math.isnan(mod_val) or math.isinf(mod_val):
            return jsonify({"error": f"Modifier '{mod_key}' must be a real number"}), 400
        if mod_val < min_mod or mod_val > max_mod:
            return jsonify({"error": f"Modifier '{mod_key}' must be between {min_mod} and {max_mod}"}), 400

    X = np.array(range(1, n + 1)).reshape(-1, 1)
    y = np.array(history_values)

    # Train Scikit-learn LinearRegression model
    model = LinearRegression()
    model.fit(X, y)

    # Compute genuine R² score
    r_squared = float(round(model.score(X, y), 3))

    # Forecast future days
    forecast_days = pred_conf["forecast_days"]
    future_X = np.array(range(n + 1, n + forecast_days + 1)).reshape(-1, 1)
    raw_predictions = model.predict(future_X)
    baseline_floor = pred_conf["baseline_floor_kg"]
    baseline_forecast = [round(max(baseline_floor, float(val)), 2) for val in raw_predictions]

    # Support both frontend key naming conventions
    t_val = modifiers.get("transportReduction", modifiers.get("transport", 0))
    e_val = modifiers.get("electricityReduction", modifiers.get("electricity", 0))
    d_val = modifiers.get("dietReduction", modifiers.get("diet", 0))

    t_mod = float(t_val) / 100.0
    e_mod = float(e_val) / 100.0
    d_mod = float(d_val) / 100.0

    weights = pred_conf["modifier_weights"]
    reduction_pct = (t_mod * weights["transport"]) + (e_mod * weights["electricity"]) + (d_mod * weights["diet"])

    optimized_floor = pred_conf["optimized_floor_kg"]
    optimized_forecast = [round(max(optimized_floor, val * (1.0 - reduction_pct)), 2) for val in baseline_forecast]
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

# 8. AI Personalized Recommendations based on category breakdown
@app.route("/api/recommendations", methods=["POST"])
def get_recommendations():
    """
    AI Personalized Recommendations based on category breakdown.
    """
    data, err = parse_json_object()
    if err:
        return jsonify({"error": err}), 400

    categories = EMISSION_FACTORS.get("categories", {})
    valid_cats = sorted(categories.keys())

    rec_conf = CONFIG.get("recommendations", {})
    default_cat = rec_conf.get("default_category", "transport")

    if "dominantCategory" in data and data["dominantCategory"] is not None:
        dominant_cat = data["dominantCategory"]
        if not isinstance(dominant_cat, str):
            return jsonify({"error": "Field 'dominantCategory' must be a string"}), 400
        if dominant_cat not in categories:
            return jsonify({"error": f"Unknown category '{dominant_cat}'. Valid categories: {valid_cats}"}), 400
    else:
        dominant_cat = default_cat

    categories_recs = RECOMMENDATIONS_DATA.get("categories", RECOMMENDATIONS_DATA)
    tips = list(categories_recs.get(dominant_cat, categories_recs.get(default_cat, [])))
    # Return tips sorted by saving, highest first
    tips.sort(key=lambda item: item.get("saving_kg_per_month", 0), reverse=True)

    formatted_recs = []
    for tip in tips:
        saving_val = tip.get("saving_kg_per_month", 0)
        formatted_recs.append({
            "id": tip.get("id"),
            "category": tip.get("category", dominant_cat),
            "title": tip.get("title"),
            "description": tip.get("description", ""),
            "saving": f"{saving_val} kg CO2e / month",
            "saving_kg_per_month": saving_val,
            "difficulty": tip.get("difficulty")
        })

    return jsonify({
        "status": "success",
        "dominantCategory": dominant_cat,
        "recommendations": formatted_recs
    })

if __name__ == "__main__":
    server_conf = CONFIG["server"]
    host = server_conf["host"]
    port = int(server_conf["port"])
    debug = bool(server_conf["debug"])

    print("==================================================================")
    print(f"🌿 EcoTrack AI Backend starting on http://{host}:{port}")
    print("Flask + Scikit-Learn + NumPy")
    print("==================================================================")
    app.run(host=host, port=port, debug=debug)
