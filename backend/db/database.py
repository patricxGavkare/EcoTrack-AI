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
import calendar
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
    """Initializes database tables and indexes from schema.sql and migrates schema if needed."""
    target_path = db_path or get_default_db_path()
    os.makedirs(os.path.dirname(target_path), exist_ok=True)
    with open(SCHEMA_PATH, "r", encoding="utf-8") as f:
        schema_sql = f.read()
    conn = get_connection(target_path)
    try:
        conn.executescript(schema_sql)
        # Migration: check if 'period' column exists in activities table
        cursor = conn.cursor()
        cursor.execute("PRAGMA table_info(activities)")
        columns = [row["name"] for row in cursor.fetchall()]
        if "period" not in columns:
            cursor.execute("ALTER TABLE activities ADD COLUMN period TEXT NOT NULL DEFAULT 'daily'")
            cursor.execute("UPDATE activities SET period = 'daily' WHERE period IS NULL OR period = ''")
        conn.commit()
    finally:
        conn.close()

def insert_activity(category, sub_type, amount, co2e, logged_at, period="daily", user_id=1, db_path=None):
    """Inserts a single activity record and returns the created row dict."""
    conn = get_connection(db_path)
    try:
        cursor = conn.cursor()
        query = """
            INSERT INTO activities (user_id, category, sub_type, amount, co2e, logged_at, period)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """
        cursor.execute(query, (user_id, category, sub_type, amount, co2e, logged_at, period))
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
            "loggedAt": logged_at,
            "period": period
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
                SELECT id, user_id, category, sub_type, amount, co2e, logged_at, period
                FROM activities
                WHERE user_id = ? AND category = ?
                ORDER BY logged_at DESC, id DESC
                LIMIT ?
            """
            cursor.execute(query, (user_id, category, limit))
        else:
            query = """
                SELECT id, user_id, category, sub_type, amount, co2e, logged_at, period
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
                "loggedAt": r["logged_at"],
                "period": r["period"] if "period" in r.keys() else "daily"
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
    Spreads period='monthly' activities evenly across all days in that calendar month.
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

        # 1. Daily rows directly within the requested date window
        query_daily = """
            SELECT SUBSTR(logged_at, 1, 10) AS log_date, category, SUM(co2e) AS cat_total
            FROM activities
            WHERE user_id = ? AND (period = 'daily' OR period IS NULL)
              AND SUBSTR(logged_at, 1, 10) >= ? AND SUBSTR(logged_at, 1, 10) <= ?
            GROUP BY SUBSTR(logged_at, 1, 10), category
        """
        cursor.execute(query_daily, (user_id, date_list[0], date_list[-1]))
        daily_rows = cursor.fetchall()
        for r in daily_rows:
            log_date = r["log_date"]
            cat = r["category"]
            cat_total = float(r["cat_total"] or 0)
            if log_date in summary_map:
                if cat in summary_map[log_date]:
                    summary_map[log_date][cat] += cat_total
                else:
                    summary_map[log_date][cat] = cat_total
                summary_map[log_date]["total"] += cat_total

        # 2. Monthly rows that overlap the calendar months in the requested window
        start_month = date_list[0][:7]
        end_month = date_list[-1][:7]
        query_monthly = """
            SELECT category, co2e, logged_at
            FROM activities
            WHERE user_id = ? AND period = 'monthly'
              AND SUBSTR(logged_at, 1, 7) >= ? AND SUBSTR(logged_at, 1, 7) <= ?
        """
        cursor.execute(query_monthly, (user_id, start_month, end_month))
        monthly_rows = cursor.fetchall()
        for r in monthly_rows:
            cat = r["category"]
            co2e = float(r["co2e"] or 0)
            logged_at = r["logged_at"]
            if not logged_at or len(logged_at) < 7:
                continue
            try:
                y = int(logged_at[:4])
                m = int(logged_at[5:7])
                num_days = calendar.monthrange(y, m)[1]
            except Exception:
                continue
            if num_days <= 0:
                continue
            daily_share = co2e / num_days
            for day_idx in range(1, num_days + 1):
                day_str = f"{y:04d}-{m:02d}-{day_idx:02d}"
                if day_str in summary_map:
                    summary_map[day_str]["total"] += daily_share
                    if cat in summary_map[day_str]:
                        summary_map[day_str][cat] += daily_share
                    else:
                        summary_map[day_str][cat] = daily_share

        # Final rounding to 3 decimal places
        for d in date_list:
            summary_map[d]["total"] = round(summary_map[d]["total"], 3)
            for cat in categories:
                summary_map[d][cat] = round(summary_map[d][cat], 3)

        return [summary_map[d] for d in date_list]
    finally:
        conn.close()
