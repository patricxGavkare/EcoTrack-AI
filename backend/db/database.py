"""
=============================================================================
🌿 EcoTrack AI - SQLite Database Interface
=============================================================================
Manages SQLite database operations for logging and summarizing activities.
All queries strictly use parameterized SQL with ? placeholders.
"""

import os
import json
import sqlite3
from datetime import date, datetime, timedelta

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCHEMA_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "schema.sql")
CONFIG_PATH = os.path.join(BASE_DIR, "data", "config.json")
FACTORS_PATH = os.path.join(BASE_DIR, "data", "emission_factors.json")

def get_default_db_path():
    """Resolves database path relative to backend directory as defined in config.json."""
    try:
        with open(CONFIG_PATH, "r", encoding="utf-8") as f:
            conf = json.load(f)
            rel_path = conf.get("database", {}).get("path", "data/ecotrack.db")
            return os.path.abspath(os.path.join(BASE_DIR, rel_path))
    except Exception:
        return os.path.abspath(os.path.join(BASE_DIR, "data", "ecotrack.db"))

def get_connection(db_path=None):
    """Establishes connection to the SQLite database with Row factory."""
    target_path = db_path or get_default_db_path()
    os.makedirs(os.path.dirname(target_path), exist_ok=True)
    conn = sqlite3.connect(target_path)
    conn.row_factory = sqlite3.Row
    return conn

def init_db(db_path=None):
    """Initializes database tables and indexes from schema.sql."""
    target_path = db_path or get_default_db_path()
    os.makedirs(os.path.dirname(target_path), exist_ok=True)
    with open(SCHEMA_PATH, "r", encoding="utf-8") as f:
        schema_sql = f.read()
    conn = get_connection(target_path)
    try:
        conn.executescript(schema_sql)
        conn.commit()
    finally:
        conn.close()

def insert_activity(category, sub_type, amount, co2e, logged_at, user_id=1, db_path=None):
    """Inserts a single activity record and returns the created row dict."""
    conn = get_connection(db_path)
    try:
        cursor = conn.cursor()
        query = """
            INSERT INTO activities (user_id, category, sub_type, amount, co2e, logged_at)
            VALUES (?, ?, ?, ?, ?, ?)
        """
        cursor.execute(query, (user_id, category, sub_type, amount, co2e, logged_at))
        conn.commit()
        row_id = cursor.lastrowid
        return {
            "id": row_id,
            "user_id": user_id,
            "userId": user_id,
            "category": category,
            "sub_type": sub_type,
            "subType": sub_type,
            "amount": amount,
            "co2e": co2e,
            "logged_at": logged_at,
            "loggedAt": logged_at
        }
    finally:
        conn.close()

def list_activities(limit=50, category=None, user_id=1, db_path=None):
    """Returns activities newest first, optionally filtered by category."""
    conn = get_connection(db_path)
    try:
        cursor = conn.cursor()
        if category:
            query = """
                SELECT id, user_id, category, sub_type, amount, co2e, logged_at
                FROM activities
                WHERE user_id = ? AND category = ?
                ORDER BY logged_at DESC, id DESC
                LIMIT ?
            """
            cursor.execute(query, (user_id, category, limit))
        else:
            query = """
                SELECT id, user_id, category, sub_type, amount, co2e, logged_at
                FROM activities
                WHERE user_id = ?
                ORDER BY logged_at DESC, id DESC
                LIMIT ?
            """
            cursor.execute(query, (user_id, limit))
        rows = cursor.fetchall()
        results = []
        for r in rows:
            results.append({
                "id": r["id"],
                "user_id": r["user_id"],
                "userId": r["user_id"],
                "category": r["category"],
                "sub_type": r["sub_type"],
                "subType": r["sub_type"],
                "amount": r["amount"],
                "co2e": r["co2e"],
                "logged_at": r["logged_at"],
                "loggedAt": r["logged_at"]
            })
        return results
    finally:
        conn.close()

def delete_activity(activity_id, user_id=1, db_path=None):
    """Deletes an activity by id and user_id. Returns True if row was deleted, False otherwise."""
    conn = get_connection(db_path)
    try:
        cursor = conn.cursor()
        query = "DELETE FROM activities WHERE id = ? AND user_id = ?"
        cursor.execute(query, (activity_id, user_id))
        conn.commit()
        return cursor.rowcount > 0
    finally:
        conn.close()

def get_known_categories():
    """Helper to fetch category keys from emission_factors.json."""
    try:
        with open(FACTORS_PATH, "r", encoding="utf-8") as f:
            factors_data = json.load(f)
            return list(factors_data.get("categories", {}).keys())
    except Exception:
        return ["transport", "electricity", "food", "water", "waste", "shopping", "gas"]

def daily_totals(days=14, user_id=1, db_path=None):
    """
    Returns continuous daily totals for the last N days (chronological order).
    Each day item has date, total, and one key per category.
    """
    today = datetime.now().astimezone().date()
    date_list = [(today - timedelta(days=i)).isoformat() for i in range(days - 1, -1, -1)]
    categories = get_known_categories()

    # Initialize continuous result structure with zeros
    summary_map = {}
    for d in date_list:
        day_entry = {"date": d, "total": 0.0}
        for cat in categories:
            day_entry[cat] = 0.0
        summary_map[d] = day_entry

    if not date_list:
        return []

    conn = get_connection(db_path)
    try:
        cursor = conn.cursor()
        query = """
            SELECT SUBSTR(logged_at, 1, 10) AS log_date, category, SUM(co2e) AS cat_total
            FROM activities
            WHERE user_id = ? AND SUBSTR(logged_at, 1, 10) >= ? AND SUBSTR(logged_at, 1, 10) <= ?
            GROUP BY SUBSTR(logged_at, 1, 10), category
        """
        cursor.execute(query, (user_id, date_list[0], date_list[-1]))
        rows = cursor.fetchall()
        for r in rows:
            log_date = r["log_date"]
            cat = r["category"]
            cat_total = float(r["cat_total"] or 0)
            if log_date in summary_map:
                if cat in summary_map[log_date]:
                    summary_map[log_date][cat] = round(cat_total, 3)
                else:
                    summary_map[log_date][cat] = round(cat_total, 3)
                summary_map[log_date]["total"] = round(summary_map[log_date]["total"] + cat_total, 3)

        return [summary_map[d] for d in date_list]
    finally:
        conn.close()
