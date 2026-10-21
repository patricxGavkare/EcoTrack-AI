import os
import sys
import json
import sqlite3
import tempfile
import unittest

# Ensure backend directory is in sys.path so app can be imported
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app import app
from db.database import init_db, get_connection

class TestEcoTrackAPI(unittest.TestCase):
    def setUp(self):
        # Create an isolated temporary database for each test
        self.temp_db = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
        self.temp_db.close()
        self.app = app
        self.app.testing = True
        self.app.config["DATABASE_PATH"] = self.temp_db.name
        init_db(self.temp_db.name)
        self.client = self.app.test_client()

    def tearDown(self):
        # Clean up temporary database file
        if hasattr(self, "temp_db") and os.path.exists(self.temp_db.name):
            try:
                os.remove(self.temp_db.name)
            except Exception:
                pass

    # -------------------------------------------------------------------------
    # STEP 0: Security & Static File Routing Tests
    # -------------------------------------------------------------------------

    def test_static_index_html(self):
        """GET / returns 200 with text/html content type."""
        res = self.client.get("/")
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.headers.get("Content-Type", "").startswith("text/html"))
        self.assertIn(b"EcoTrack", res.data)
        res.close()

    def test_static_js_app(self):
        """GET /js/app.js returns 200 with text/javascript content type."""
        res = self.client.get("/js/app.js")
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.headers.get("Content-Type", "").startswith("text/javascript"))
        res.close()

    def test_static_css_styles(self):
        """GET /css/styles.css returns 200 with text/css content type."""
        res = self.client.get("/css/styles.css")
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.headers.get("Content-Type", "").startswith("text/css"))
        res.close()

    def test_traversal_dot_dot_slash(self):
        """GET /../backend/app.py must NOT return the file contents (expect 404 or 400)."""
        res = self.client.get("/../backend/app.py")
        self.assertIn(res.status_code, [400, 404])
        self.assertNotIn(b"EcoTrack AI - Backend Python Server", res.data)

    def test_traversal_encoded_dots(self):
        """GET /%2e%2e/backend/app.py must NOT return the file contents (expect 404 or 400)."""
        res = self.client.get("/%2e%2e/backend/app.py")
        self.assertIn(res.status_code, [400, 404])
        self.assertNotIn(b"EcoTrack AI - Backend Python Server", res.data)

    def test_traversal_encoded_backslash(self):
        """GET /..%5Cbackend%5Capp.py must NOT return the file contents (expect 404 or 400)."""
        res = self.client.get("/..%5Cbackend%5Capp.py")
        self.assertIn(res.status_code, [400, 404])
        self.assertNotIn(b"EcoTrack AI - Backend Python Server", res.data)

    # -------------------------------------------------------------------------
    # Baseline Endpoints Tests (Health, Factors, Config)
    # -------------------------------------------------------------------------

    def test_health(self):
        """GET /api/health should return online status."""
        res = self.client.get("/api/health")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data.get("status"), "online")
        self.assertIn("service", data)

    def test_factors_verified_flag_present(self):
        """GET /api/factors should return all factors with 'verified' boolean flag."""
        res = self.client.get("/api/factors")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertIn("categories", data)
        categories = data["categories"]

        # Check all 7 categories exist
        expected_cats = ["transport", "electricity", "food", "water", "waste", "shopping", "gas"]
        for cat in expected_cats:
            self.assertIn(cat, categories)

        # Check every factor has verified flag
        for cat_name, cat_dict in categories.items():
            for factor_key, factor in cat_dict.items():
                self.assertIn("verified", factor, f"Missing verified flag in {cat_name}.{factor_key}")
                self.assertIsInstance(factor["verified"], bool)

        # Specifically check known verified & unverified entries
        self.assertTrue(categories["transport"]["car_petrol"]["verified"])
        self.assertTrue(categories["transport"]["car_diesel"]["verified"])
        self.assertTrue(categories["electricity"]["grid_standard"]["verified"])
        self.assertFalse(categories["electricity"]["solar_rooftop"]["verified"])
        self.assertFalse(categories["food"]["meal_vegetarian"]["verified"])

    def test_config(self):
        """GET /api/config should return benchmarks, predict weights, and operational limits."""
        res = self.client.get("/api/config")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertIn("benchmarks", data)
        self.assertIn("predict_weights", data)
        self.assertIn("limits", data)
        self.assertEqual(data["limits"]["min_history_points"], 2)
        self.assertEqual(data["limits"]["max_history_points"], 365)

    # -------------------------------------------------------------------------
    # Calculation, Prediction & Recommendations Tests
    # -------------------------------------------------------------------------

    def test_valid_calculate(self):
        """POST /api/calculate with valid payload should compute CO2e accurately."""
        payload = {"category": "transport", "subType": "car_petrol", "amount": 25}
        res = self.client.post("/api/calculate", json=payload)
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data["category"], "transport")
        self.assertEqual(data["subType"], "car_petrol")
        self.assertEqual(data["amount"], 25)
        self.assertEqual(data["factor"], 0.192)
        self.assertEqual(data["co2e"], 4.8)
        self.assertIn("formula", data)

    def test_valid_predict_default_history(self):
        """POST /api/predict with empty payload should fall back to default history and forecast."""
        res = self.client.post("/api/predict", json={})
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertIn("baselineForecast", data)
        self.assertIn("optimizedForecast", data)
        self.assertIn("rSquared", data)
        self.assertEqual(len(data["baselineForecast"]), 7)

    def test_valid_predict_with_modifiers(self):
        """POST /api/predict with custom history and valid modifiers."""
        payload = {
            "history": [10.2, 9.8, 9.1, 8.5, 8.0, 7.5, 7.0],
            "modifiers": {
                "transportReduction": 20,
                "electricityReduction": 15,
                "dietReduction": 10
            }
        }
        res = self.client.post("/api/predict", json=payload)
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertIn("baselineForecast", data)
        self.assertIn("optimizedForecast", data)
        self.assertGreaterEqual(data["projectedWeeklySavingsKg"], 0)

    def test_valid_recommendations_all_categories(self):
        """POST /api/recommendations for each of the 7 categories, sorted by saving highest first."""
        categories = ["transport", "electricity", "food", "water", "waste", "shopping", "gas"]
        for cat in categories:
            res = self.client.post("/api/recommendations", json={"dominantCategory": cat})
            self.assertEqual(res.status_code, 200, f"Failed for category {cat}")
            data = res.get_json()
            self.assertEqual(data["status"], "success")
            self.assertEqual(data["dominantCategory"], cat)
            recs = data.get("recommendations", [])
            self.assertGreaterEqual(len(recs), 1, f"No recommendations returned for {cat}")

            # Verify sorting: highest saving first
            savings = [r["saving_kg_per_month"] for r in recs]
            sorted_savings = sorted(savings, reverse=True)
            self.assertEqual(savings, sorted_savings, f"Recommendations for {cat} not sorted descending")

    def test_valid_recommendations_default_category(self):
        """POST /api/recommendations with no dominantCategory should fall back to config default."""
        res = self.client.post("/api/recommendations", json={})
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data["status"], "success")
        self.assertEqual(data["dominantCategory"], "transport")

    def test_calculate_amount_abc(self):
        """amount as a string 'abc' returns 400."""
        res = self.client.post("/api/calculate", json={"category": "transport", "subType": "car_petrol", "amount": "abc"})
        self.assertEqual(res.status_code, 400)
        self.assertIn("error", res.get_json())

    def test_calculate_amount_negative(self):
        """amount -5 returns 400."""
        res = self.client.post("/api/calculate", json={"category": "transport", "subType": "car_petrol", "amount": -5})
        self.assertEqual(res.status_code, 400)
        self.assertIn("error", res.get_json())

    def test_calculate_amount_true(self):
        """amount true returns 400."""
        res = self.client.post("/api/calculate", json={"category": "transport", "subType": "car_petrol", "amount": True})
        self.assertEqual(res.status_code, 400)
        self.assertIn("error", res.get_json())

    def test_calculate_amount_null(self):
        """amount null returns 400."""
        res = self.client.post("/api/calculate", json={"category": "transport", "subType": "car_petrol", "amount": None})
        self.assertEqual(res.status_code, 400)
        self.assertIn("error", res.get_json())

    def test_calculate_amount_1e999(self):
        """amount 1e999 (Infinity) returns 400."""
        res = self.client.post(
            "/api/calculate",
            data='{"category": "transport", "subType": "car_petrol", "amount": 1e999}',
            content_type="application/json"
        )
        self.assertEqual(res.status_code, 400)
        self.assertIn("error", res.get_json())

    def test_calculate_unknown_category(self):
        """unknown category returns 400 listing valid categories."""
        res = self.client.post("/api/calculate", json={"category": "teleportation", "subType": "car_petrol", "amount": 10})
        self.assertEqual(res.status_code, 400)
        err = res.get_json().get("error", "")
        self.assertIn("transport", err)

    def test_calculate_unknown_subtype(self):
        """unknown subType returns 400 listing valid subTypes."""
        res = self.client.post("/api/calculate", json={"category": "transport", "subType": "hoverboard", "amount": 10})
        self.assertEqual(res.status_code, 400)
        err = res.get_json().get("error", "")
        self.assertIn("car_petrol", err)

    def test_empty_body(self):
        """empty body returns 400."""
        res = self.client.post("/api/calculate", data="", content_type="application/json")
        self.assertEqual(res.status_code, 400)
        self.assertIn("error", res.get_json())

    def test_malformed_json(self):
        """malformed JSON returns 400."""
        res = self.client.post("/api/calculate", data='{"category": "transport", "subType": }', content_type="application/json")
        self.assertEqual(res.status_code, 400)
        self.assertIn("error", res.get_json())

    def test_predict_history_as_string(self):
        """history as a string returns 400."""
        res = self.client.post("/api/predict", json={"history": "9.5, 9.2, 8.8"})
        self.assertEqual(res.status_code, 400)
        self.assertIn("error", res.get_json())

    def test_predict_history_empty(self):
        """history empty returns 400."""
        res = self.client.post("/api/predict", json={"history": []})
        self.assertEqual(res.status_code, 400)
        self.assertIn("error", res.get_json())

    def test_predict_history_1_point(self):
        """history with 1 point returns 400."""
        res = self.client.post("/api/predict", json={"history": [8.5]})
        self.assertEqual(res.status_code, 400)
        self.assertIn("error", res.get_json())

    def test_predict_history_366_points(self):
        """history with 366 points returns 400."""
        res = self.client.post("/api/predict", json={"history": [5.0] * 366})
        self.assertEqual(res.status_code, 400)
        self.assertIn("error", res.get_json())

    def test_predict_history_containing_x(self):
        """history containing 'x' returns 400."""
        res = self.client.post("/api/predict", json={"history": [9.5, "x", 8.8]})
        self.assertEqual(res.status_code, 400)
        self.assertIn("error", res.get_json())

    def test_predict_history_containing_negative_3(self):
        """history containing -3 returns 400."""
        res = self.client.post("/api/predict", json={"history": [9.5, -3, 8.8]})
        self.assertEqual(res.status_code, 400)
        self.assertIn("error", res.get_json())

    def test_predict_modifiers_as_a_list(self):
        """modifiers as a list returns 400."""
        res = self.client.post("/api/predict", json={"history": [9.5, 9.2], "modifiers": [10, 20]})
        self.assertEqual(res.status_code, 400)
        self.assertIn("error", res.get_json())

    def test_predict_modifier_150(self):
        """modifier 150 (> 100) returns 400."""
        res = self.client.post("/api/predict", json={"history": [9.5, 9.2], "modifiers": {"transport": 150}})
        self.assertEqual(res.status_code, 400)
        self.assertIn("error", res.get_json())

    def test_recommendations_unknown_dominant_category(self):
        """unknown dominantCategory returns 400 listing valid categories."""
        res = self.client.post("/api/recommendations", json={"dominantCategory": "outer_space"})
        self.assertEqual(res.status_code, 400)
        err = res.get_json().get("error", "")
        self.assertIn("transport", err)

    def test_get_on_calculate_method_not_allowed(self):
        """GET on /api/calculate returns 405 Method Not Allowed as JSON."""
        res = self.client.get("/api/calculate")
        self.assertEqual(res.status_code, 405)
        self.assertIn("error", res.get_json())

    def test_get_api_nope_not_found(self):
        """GET /api/nope returns 404 Not Found as JSON."""
        res = self.client.get("/api/nope")
        self.assertEqual(res.status_code, 404)
        self.assertIn("error", res.get_json())

    # -------------------------------------------------------------------------
    # STEP 3: Database Activities & Summary Tests
    # -------------------------------------------------------------------------

    def test_create_then_list_activities(self):
        """POST /api/activities creates an activity, then GET /api/activities lists it."""
        payload = {
            "category": "transport",
            "subType": "car_petrol",
            "amount": 25,
            "loggedAt": "2026-10-21T10:00:00"
        }
        res_post = self.client.post("/api/activities", json=payload)
        self.assertEqual(res_post.status_code, 201)
        created = res_post.get_json()
        self.assertIn("id", created)
        self.assertEqual(created["co2e"], 4.8)

        res_list = self.client.get("/api/activities")
        self.assertEqual(res_list.status_code, 200)
        activities = res_list.get_json()
        self.assertIsInstance(activities, list)
        self.assertEqual(len(activities), 1)
        self.assertEqual(activities[0]["id"], created["id"])
        self.assertEqual(activities[0]["category"], "transport")
        self.assertEqual(activities[0]["amount"], 25)

    def test_create_then_delete_activity(self):
        """POST /api/activities, then DELETE /api/activities/<id> removes it."""
        payload = {"category": "electricity", "subType": "grid_standard", "amount": 10}
        res_post = self.client.post("/api/activities", json=payload)
        self.assertEqual(res_post.status_code, 201)
        activity_id = res_post.get_json()["id"]

        # Delete activity
        res_del = self.client.delete(f"/api/activities/{activity_id}")
        self.assertEqual(res_del.status_code, 200)
        self.assertEqual(res_del.get_json(), {"deleted": activity_id})

        # List should now be empty
        res_list = self.client.get("/api/activities")
        self.assertEqual(res_list.status_code, 200)
        self.assertEqual(len(res_list.get_json()), 0)

    def test_delete_missing_activity_404(self):
        """DELETE non-existent activity returns 404 JSON error."""
        res = self.client.delete("/api/activities/999999")
        self.assertEqual(res.status_code, 404)
        self.assertIn("error", res.get_json())

    def test_activity_invalid_category_400(self):
        """POST /api/activities with invalid category returns 400."""
        payload = {"category": "spaceship", "subType": "car_petrol", "amount": 10}
        res = self.client.post("/api/activities", json=payload)
        self.assertEqual(res.status_code, 400)
        self.assertIn("error", res.get_json())

    def test_activity_invalid_subtype_400(self):
        """POST /api/activities with invalid subType returns 400."""
        payload = {"category": "transport", "subType": "hyperdrive", "amount": 10}
        res = self.client.post("/api/activities", json=payload)
        self.assertEqual(res.status_code, 400)
        self.assertIn("error", res.get_json())

    def test_activity_invalid_amount_400(self):
        """POST /api/activities with invalid amount returns 400."""
        # String amount
        res1 = self.client.post("/api/activities", json={"category": "transport", "subType": "car_petrol", "amount": "abc"})
        self.assertEqual(res1.status_code, 400)
        # Negative amount
        res2 = self.client.post("/api/activities", json={"category": "transport", "subType": "car_petrol", "amount": -10})
        self.assertEqual(res2.status_code, 400)
        # Boolean amount
        res3 = self.client.post("/api/activities", json={"category": "transport", "subType": "car_petrol", "amount": True})
        self.assertEqual(res3.status_code, 400)
        # Null amount
        res4 = self.client.post("/api/activities", json={"category": "transport", "subType": "car_petrol", "amount": None})
        self.assertEqual(res4.status_code, 400)

    def test_client_sent_co2e_ignored(self):
        """Client-sent co2e is ignored; server calculates actual value from emission factors."""
        payload = {
            "category": "transport",
            "subType": "car_petrol",
            "amount": 10,
            "co2e": 99999.0  # Bogus client value
        }
        res = self.client.post("/api/activities", json=payload)
        self.assertEqual(res.status_code, 201)
        data = res.get_json()
        self.assertEqual(data["co2e"], 1.92)  # 10 * 0.192 = 1.92
        self.assertNotEqual(data["co2e"], 99999.0)

    def test_activities_limit_zero_400(self):
        """GET /api/activities?limit=0 returns 400."""
        res = self.client.get("/api/activities?limit=0")
        self.assertEqual(res.status_code, 400)
        self.assertIn("error", res.get_json())

    def test_activities_limit_negative_400(self):
        """GET /api/activities?limit=-1 returns 400."""
        res = self.client.get("/api/activities?limit=-1")
        self.assertEqual(res.status_code, 400)
        self.assertIn("error", res.get_json())

    def test_activities_limit_non_int_400(self):
        """GET /api/activities?limit=x returns 400."""
        res = self.client.get("/api/activities?limit=x")
        self.assertEqual(res.status_code, 400)
        self.assertIn("error", res.get_json())

    def test_activities_limit_above_max_400(self):
        """GET /api/activities with limit exceeding config max (500) returns 400."""
        res = self.client.get("/api/activities?limit=501")
        self.assertEqual(res.status_code, 400)
        self.assertIn("error", res.get_json())

    def test_activities_category_filter(self):
        """GET /api/activities?category=transport returns only matching category records."""
        self.client.post("/api/activities", json={"category": "transport", "subType": "car_petrol", "amount": 10})
        self.client.post("/api/activities", json={"category": "food", "subType": "meal_vegetarian", "amount": 2})

        # Filter transport
        res_t = self.client.get("/api/activities?category=transport")
        self.assertEqual(res_t.status_code, 200)
        items_t = res_t.get_json()
        self.assertEqual(len(items_t), 1)
        self.assertEqual(items_t[0]["category"], "transport")

        # Invalid category filter returns 400
        res_inv = self.client.get("/api/activities?category=nonexistent")
        self.assertEqual(res_inv.status_code, 400)

    def test_summary_continuity_zero_days(self):
        """GET /api/summary?days=7 returns continuous 7 days with zero totals when empty."""
        res = self.client.get("/api/summary?days=7")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(len(data), 7)
        for day in data:
            self.assertIn("date", day)
            self.assertIn("total", day)
            self.assertEqual(day["total"], 0.0)
            self.assertEqual(day["transport"], 0.0)
            self.assertEqual(day["electricity"], 0.0)

    def test_summary_days_zero_400(self):
        """GET /api/summary?days=0 returns 400."""
        res = self.client.get("/api/summary?days=0")
        self.assertEqual(res.status_code, 400)
        self.assertIn("error", res.get_json())

    def test_summary_days_above_max_400(self):
        """GET /api/summary?days=9999 returns 400."""
        res = self.client.get("/api/summary?days=9999")
        self.assertEqual(res.status_code, 400)
        self.assertIn("error", res.get_json())

    def test_sql_injection_subtype(self):
        """SQL injection attempt in subType returns 400 and does NOT compromise table."""
        injection_payload = {
            "category": "transport",
            "subType": "x'; DROP TABLE activities;--",
            "amount": 10
        }
        res = self.client.post("/api/activities", json=injection_payload)
        self.assertEqual(res.status_code, 400)

        # Verify table activities still exists and is completely operational
        conn = get_connection(self.app.config["DATABASE_PATH"])
        cur = conn.cursor()
        cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='activities'")
        table = cur.fetchone()
        conn.close()
        self.assertIsNotNone(table)
        self.assertEqual(table["name"], "activities")

if __name__ == "__main__":
    unittest.main()
