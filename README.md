# 🌿 EcoTrack AI — Personal Carbon Footprint & Green Impact Tracker

> **2nd Year Engineering Project (EDI / Course Project)**  
> **Team Size:** 4 Members  
> **Tech Stack:** HTML5, CSS3, JavaScript (ES6+), Chart.js, Python (Flask + Scikit-Learn)

---

## 📁 Project Folder Structure

This repository is split into two clean parts: **Frontend** (what the user sees) and **Backend** (Python AI/ML and API).

```text
Website/
├── frontend/                  # User Interface (HTML, CSS, JavaScript)
│   ├── index.html             # Main dashboard page
│   ├── css/
│   │   └── styles.css         # Styling, dark eco-theme, and layout
│   └── js/
│       ├── app.js             # Main controller and user interactions
│       ├── carbon-calc.js     # Scientific formulas (IPCC/DEFRA emission factors)
│       ├── ai-engine.js       # Green score calculation and recommendations
│       ├── charts.js          # Interactive charts using Chart.js
│       └── mock-data.js       # Sample 14-day history data for demos
│
├── backend/                   # Python API & Machine Learning
│   ├── app.py                 # Flask server with Scikit-learn Linear Regression
│   ├── requirements.txt       # List of Python packages needed
│   └── models/                # Saved trained ML models (.pkl or .joblib)
│
├── .gitignore                 # Files that Git should ignore (caches, virtualenvs, etc.)
└── README.md                  # This file (Guide for all team members)
```

---

## 👥 How Our Team of 4 Will Work Together

1. **Member 1 (Frontend UI/UX)**:
   * Works in `frontend/index.html` and `frontend/css/styles.css`.
   * Improves colors, button layout, spacing, and makes the page clean and mobile-friendly.

2. **Member 2 (Frontend Logic & Charts)**:
   * Works in `frontend/js/app.js` and `frontend/js/charts.js`.
   * Handles user inputs, connects sliders, and customizes Chart.js graphs.

3. **Member 3 (Backend API & Database)**:
   * Works in `backend/app.py`.
   * Connects database (SQLite or MySQL) to save user logins and daily activity logs permanently.

4. **Member 4 (Machine Learning & AI Logic)**:
   * Works in `backend/` and `frontend/js/carbon-calc.js`.
   * Refines the regression/prediction algorithms, calculates carbon savings, and trains models.

---

## 🚀 How to Run the Project on Your Computer

> **Note:** The frontend uses modern JavaScript ES modules (`import`/`export`), which require serving over HTTP/HTTPS. Do not double-click `index.html` directly from the filesystem (`file:///`), as browsers block ES modules due to CORS policy. The Flask backend serves both the API and the frontend dashboard seamlessly.

```bash
# 1. Activate your Python virtual environment (e.g. C:\venvs\ecotrack)
C:\venvs\ecotrack\Scripts\activate

# 2. Navigate to the backend folder
cd backend

# 3. Install required packages (first time only)
pip install -r requirements.txt

# 4. Start the Flask server
python app.py
```

Open your browser and navigate to **`http://127.0.0.1:5000`** to view the application.

---

## 🌿 Core Features Built in This Project
1. **7 Emission Categories**: Transport, Electricity, Food, Water, Waste, Shopping, and Cooking Gas.
2. **Scientific Calculations**: Live formula calculation (`Activity × Emission Factor`) based on IPCC and DEFRA guidelines.
3. **Unified Green Score (0–100)**: Evaluates whether your daily footprint is below the global Paris Climate Agreement limit.
4. **"What-If" Behavioral Simulator**: Sliders to test how much carbon you save by switching to public transit or plant-based meals.
5. **Gamification**: Streaks, badges, and eco-points to motivate everyday sustainable habits.
6. **Viva Defense Mode**: Built-in examiner reference popup for presentation reviews.

---

## 📌 Rules for Git Collaboration (Important!)
* **Always pull first** before making changes: `git pull origin main`
* **Test your code** in your browser before committing: `git status`
* **Write clear commit messages**: e.g. `git commit -m "Updated transport emission factors in carbon-calc.js"`
* **Never commit large zip files or python caches** (`.gitignore` takes care of this).
