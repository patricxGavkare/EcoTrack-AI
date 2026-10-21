import os
import sys
import json
import unittest

# Ensure backend directory is in sys.path so app can be imported
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app import app

class TestEcoTrackAPI(unittest.TestCase):
    def setUp(self):
        self.app = app
        self.app.testing = True
        self.client = self.app.test_client()

    # -------------------------------------------------------------------------
    # Positive / Valid Endpoints Tests
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

    # -------------------------------------------------------------------------
    # Failure Cases (Step 4 exact assertions)
    # -------------------------------------------------------------------------

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


if __name__ == "__main__":
    unittest.main()
