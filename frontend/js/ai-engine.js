/**
 * AI/ML Behavior, Prediction & Green Score Engine
 * Implements Slide 2, 4, 7, 8 requirements:
 * 1. Unified Green Score calculation (0-100)
 * 2. Behavior pattern detection & anomaly recognition
 * 3. Personalized AI recommendations with CO2e reduction impact
 * 4. ML Linear & Moving Average Prediction Engine (simulating Scikit-Learn regression)
 * 5. Flask API integration adapter with automated offline fallback
 */

const AIEngine = {
  flaskApiBase: (typeof window !== 'undefined' && window.location && (window.location.protocol === 'http:' || window.location.protocol === 'https:'))
    ? '/api'
    : 'http://127.0.0.1:5000/api',
  isBackendConnected: false,

  /**
   * 1. Calculate Unified Green Score (0 to 100)
   * Formula:
   * Target: Paris agreement 1.5°C threshold ~ 4.0 kg CO2e/day
   * National average ~ 9.8 kg CO2e/day
   * Score = 100 - ((dailyCo2e - Target) / (NationalAvg - Target)) * 40
   * Normalized strictly between 0 and 100
   */
  calculateGreenScore(dailyAvgCo2e) {
    const target = MockData.benchmarks.globalParisTarget; // 4.1 kg
    const national = MockData.benchmarks.nationalAverage; // 9.8 kg

    let score = 0;
    if (dailyAvgCo2e <= target) {
      // 90 to 100
      const ratio = dailyAvgCo2e / target;
      score = 90 + (1 - ratio) * 10;
    } else if (dailyAvgCo2e <= national) {
      // 60 to 89
      const fraction = (dailyAvgCo2e - target) / (national - target);
      score = 89 - (fraction * 29);
    } else {
      // Under 60 down to 10
      const excess = dailyAvgCo2e - national;
      score = Math.max(12, 60 - (excess * 8));
    }

    const rounded = Math.round(Math.min(100, Math.max(0, score)));

    let status = {
      score: rounded,
      rating: '',
      color: '',
      badge: '',
      description: '',
      class: ''
    };

    if (rounded >= 85) {
      status.rating = 'Eco Champion';
      status.color = '#10b981'; // Emerald
      status.badge = '🌿 Outstanding';
      status.description = 'Your daily emissions are within sustainable global climate limits!';
      status.class = 'tier-champion';
    } else if (rounded >= 70) {
      status.rating = 'Low Impact';
      status.color = '#34d399'; // Mint
      status.badge = '🌱 Good Standing';
      status.description = 'Below national average. Minor lifestyle tweaks can make you carbon neutral.';
      status.class = 'tier-good';
    } else if (rounded >= 50) {
      status.rating = 'Moderate Impact';
      status.color = '#f59e0b'; // Amber
      status.badge = '⚖️ Average';
      status.description = 'Close to regional averages. Focus on high-impact transport and AC usage.';
      status.class = 'tier-moderate';
    } else if (rounded >= 30) {
      status.rating = 'High Footprint';
      status.color = '#f97316'; // Orange
      status.badge = '⚠️ Needs Attention';
      status.description = 'Significant emissions detected. Review AI recommendations to cut footprint.';
      status.class = 'tier-warning';
    } else {
      status.rating = 'Critical Level';
      status.color = '#ef4444'; // Red
      status.badge = '🚨 Immediate Action';
      status.description = 'Heavy carbon emission habits. High potential for rapid energy and travel reduction.';
      status.class = 'tier-critical';
    }

    return status;
  },

  /**
   * 2. Analyze user behavior patterns across historical logs
   */
  analyzeBehavior(history) {
    if (!history || history.length === 0) return null;

    const totalDays = history.length;
    let sumTotal = 0;
    const catSums = {
      transport: 0,
      electricity: 0,
      food: 0,
      water: 0,
      waste: 0,
      shopping: 0,
      gas: 0
    };

    const dailyValues = [];

    history.forEach(day => {
      sumTotal += day.total;
      dailyValues.push(day.total);
      Object.keys(catSums).forEach(cat => {
        catSums[cat] += (day[cat] || 0);
      });
    });

    const dailyAvg = parseFloat((sumTotal / totalDays).toFixed(2));

    // Calculate category percentages & per-day averages
    const categoryPercentages = {};
    const categoryDailyAvgs = {};
    let dominantCategory = 'transport';
    let maxCatVal = 0;

    Object.keys(catSums).forEach(cat => {
      const pct = sumTotal > 0 ? (catSums[cat] / sumTotal) * 100 : 0;
      categoryPercentages[cat] = parseFloat(pct.toFixed(1));
      categoryDailyAvgs[cat] = parseFloat((catSums[cat] / totalDays).toFixed(2));
      if (catSums[cat] > maxCatVal) {
        maxCatVal = catSums[cat];
        dominantCategory = cat;
      }
    });

    // Statistical anomaly detection: Mean + 1.25 * Standard Deviation
    const mean = sumTotal / totalDays;
    const variance = dailyValues.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / totalDays;
    const stdDev = Math.sqrt(variance);
    const spikeThreshold = mean + (1.25 * stdDev);

    const anomalies = history
      .filter(day => day.total > spikeThreshold)
      .map(day => ({
        date: day.date,
        total: day.total,
        excess: parseFloat((day.total - mean).toFixed(1))
      }));

    // Weekly trend comparison: Last 7 days vs previous 7 days (using end of array)
    let recent7Avg = dailyAvg;
    let previous7Avg = dailyAvg;
    let trendPercent = 0;

    if (history.length >= 14) {
      const prev7 = history.slice(-14, -7).reduce((acc, d) => acc + d.total, 0) / 7;
      const recent7 = history.slice(-7).reduce((acc, d) => acc + d.total, 0) / 7;
      previous7Avg = parseFloat(prev7.toFixed(2));
      recent7Avg = parseFloat(recent7.toFixed(2));
      trendPercent = previous7Avg > 0
        ? parseFloat((((recent7Avg - previous7Avg) / previous7Avg) * 100).toFixed(1))
        : 0;
    }

    return {
      totalDays,
      dailyAvg,
      totalEmissions: parseFloat(sumTotal.toFixed(2)),
      dominantCategory,
      dominantCategoryPercentage: categoryPercentages[dominantCategory],
      categoryPercentages,
      categoryDailyAvgs,
      categorySums: catSums,
      anomalies,
      trendPercent, // Negative means improvement (reduction)!
      isImproving: trendPercent < 0
    };
  },

  /**
   * 3. AI Personalized Recommendation Generator
   * Maps identified behavioral bottlenecks using per-day averages (catSums[cat] / totalDays)
   */
  generateRecommendations(analysis) {
    if (!analysis) return [];

    const recs = [];
    const totalDays = analysis.totalDays || 1;
    const catSums = analysis.categorySums || {};
    const catPct = analysis.categoryPercentages || {};

    const transportPerDay = (catSums.transport || 0) / totalDays;
    const electricityPerDay = (catSums.electricity || 0) / totalDays;
    const gasPerDay = (catSums.gas || 0) / totalDays;

    // Transport insights (fires if transport is >30% or per-day average > 2.5 kg)
    if (catPct.transport > 30 || transportPerDay > 2.5) {
      recs.push({
        id: 'rec-transport-metro',
        category: 'transport',
        title: 'Switch 2 Weekly Commutes to Metro/Bus',
        impactScore: 'High Impact',
        impactClass: 'impact-high',
        co2eMonthlySaving: 18.4,
        treesEquivalent: 1,
        difficulty: 'Easy',
        description: `Transportation accounts for ${catPct.transport || 0}% of your total footprint (~${transportPerDay.toFixed(1)} kg/day). Replacing two car trips with public transit saves ~4.2 kg CO₂e weekly.`,
        actionLabel: 'Pledge Transit Commute',
        icon: '🚇'
      });
    }

    // Electricity insights (fires if electricity is >35% or per-day average > 3.0 kg)
    if (catPct.electricity > 35 || electricityPerDay > 3.0) {
      recs.push({
        id: 'rec-electricity-ac',
        category: 'electricity',
        title: 'Optimize Air Conditioner to 24°C',
        impactScore: 'High Impact',
        impactClass: 'impact-high',
        co2eMonthlySaving: 14.8,
        treesEquivalent: 1,
        difficulty: 'Zero Cost',
        description: 'Every 1°C increase in AC temperature reduces compressor workload by 6%, saving ~0.5 kWh per hour of cooling.',
        actionLabel: 'Adopt 24°C Rule',
        icon: '❄️'
      });
    }

    // Waste & Recycling
    recs.push({
      id: 'rec-waste-recycle',
      category: 'waste',
      title: 'Segregate Paper & Plastics for Recycling',
      impactScore: 'Steady Benefit',
      impactClass: 'impact-low',
      co2eMonthlySaving: 4.5,
      treesEquivalent: 0.3,
      difficulty: 'Easy',
      description: 'Recycling aluminum and paper credits negative CO₂e by avoiding primary extraction and landfill methane.',
      actionLabel: 'Log Recycling',
      icon: '♻️'
    });

    // Cooking & Gas (fires if gas is >10% or per-day average > 0.6 kg)
    if (catPct.gas > 10 || gasPerDay > 0.6) {
      recs.push({
        id: 'rec-gas-induction',
        category: 'gas',
        title: 'Use Pressure Cooker & Covered Pans',
        impactScore: 'Medium Impact',
        impactClass: 'impact-medium',
        co2eMonthlySaving: 6.8,
        treesEquivalent: 0.4,
        difficulty: 'Easy',
        description: 'Using lids and pressure cookers cuts cooking gas fuel consumption by up to 30%.',
        actionLabel: 'Adopt Cooking Habit',
        icon: '🍳'
      });
    }

    return recs;
  },

  /**
   * 4. Machine Learning Emission Predictor
   * Fits historical sequence using Ordinary Least Squares (OLS) Linear Regression: y = mx + c.
   * Computes genuine R² coefficient of determination and forecasts next 7 days.
   */
  predictFutureEmissions(history, whatIfModifiers = { transportReduction: 0, electricityReduction: 0, dietReduction: 0 }) {
    if (!history || history.length === 0) return { labels: [], baseline: [], optimized: [] };

    const n = history.length;
    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumXX = 0;

    for (let i = 0; i < n; i++) {
      const x = i + 1;
      const y = history[i].total;
      sumX += x;
      sumY += y;
      sumXY += (x * y);
      sumXX += (x * x);
    }

    // Ordinary Least Squares (OLS) formula:
    // Slope m = (n*sumXY - sumX*sumY) / (n*sumXX - sumX^2)
    // Intercept c = (sumY - m*sumX) / n
    const slopeDenominator = (n * sumXX - sumX * sumX);
    const m = slopeDenominator !== 0 ? (n * sumXY - sumX * sumY) / slopeDenominator : 0;
    const c = (sumY - m * sumX) / n;

    // Compute genuine R² (Coefficient of Determination: R² = 1 - SS_res / SS_tot, 2 decimals, 0 if SS_tot is 0)
    const yMean = sumY / n;
    let ssTot = 0;
    let ssRes = 0;
    for (let i = 0; i < n; i++) {
      const x = i + 1;
      const y = history[i].total;
      const yPred = (m * x) + c;
      ssTot += Math.pow(y - yMean, 2);
      ssRes += Math.pow(y - yPred, 2);
    }
    const rSquared = ssTot > 0 ? Math.max(0, parseFloat((1 - (ssRes / ssTot)).toFixed(2))) : 0;

    // Forecast next 7 days
    const forecastDays = 7;
    const forecastLabels = [];
    const baselineForecast = [];
    const optimizedForecast = [];

    // Calculate reduction factor from What-If sliders (percentages 0 to 100)
    const tRed = (whatIfModifiers.transportReduction || 0) / 100;
    const eRed = (whatIfModifiers.electricityReduction || 0) / 100;
    const dRed = (whatIfModifiers.dietReduction || 0) / 100;

    // Calculate actual category weights from historical shares
    let tShare = 0.30, eShare = 0.40, dShare = 0.20;
    if (sumY > 0) {
      let tSum = 0, eSum = 0, dSum = 0;
      history.forEach(h => {
        tSum += (h.transport || 0);
        eSum += (h.electricity || 0);
        dSum += (h.food || 0);
      });
      tShare = tSum / sumY;
      eShare = eSum / sumY;
      dShare = dSum / sumY;
    }

    const totalReductionFactor = (tRed * tShare) + (eRed * eShare) + (dRed * dShare);

    const lastDate = new Date(history[history.length - 1].date);

    for (let j = 1; j <= forecastDays; j++) {
      const nextDayIndex = n + j;
      const projectedRaw = (m * nextDayIndex) + c;
      const baselineVal = parseFloat(Math.max(1.5, projectedRaw).toFixed(2));

      // With user AI habit adoption:
      const optimizedVal = parseFloat(Math.max(1.0, baselineVal * (1 - totalReductionFactor)).toFixed(2));

      const nextDate = new Date(lastDate);
      nextDate.setDate(lastDate.getDate() + j);
      const label = nextDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

      forecastLabels.push(label);
      baselineForecast.push(baselineVal);
      optimizedForecast.push(optimizedVal);
    }

    // Calculate cumulative savings over the forecast period
    const totalBaseline = baselineForecast.reduce((a, b) => a + b, 0);
    const totalOptimized = optimizedForecast.reduce((a, b) => a + b, 0);
    const projectedSavingsKg = parseFloat((totalBaseline - totalOptimized).toFixed(1));

    return {
      forecastLabels,
      baselineForecast,
      optimizedForecast,
      regressionSlope: parseFloat(m.toFixed(4)),
      regressionIntercept: parseFloat(c.toFixed(2)),
      projectedSavingsKg,
      modelType: 'Linear Regression (OLS, browser)',
      rSquared: rSquared
    };
  },

  /**
   * 5. Flask API Bridge & Async Predictor
   */
  async testBackendConnection() {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1200);
      const response = await fetch(`${this.flaskApiBase}/health`, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (response.ok) {
        this.isBackendConnected = true;
        return { connected: true, message: 'Flask + Scikit-Learn Backend Active' };
      }
    } catch (e) {
      this.isBackendConnected = false;
    }
    return { connected: false, message: 'Local AI Engine (Browser OLS)' };
  }
};

window.AIEngine = AIEngine;
