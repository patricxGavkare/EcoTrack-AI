/**
 * Dashboard & Visual Rendering Module (dashboard.js)
 * Manages KPI updates, profile displays, recommendation cards, badges, activity tables, and charts.
 * Clean, unslop-compliant rendering with tabular monospace numbers and quiet status dots.
 */

import { AppState, DOM } from './state.js';
import { API } from './api.js';
import { Storage } from './storage.js';

/**
 * Toast notification helper
 */
export function showToast(msg) {
  if (!DOM.toastContainer) return;
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `<span class="status-dot"></span> <span>${msg}</span>`;
  DOM.toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(6px)';
    toast.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
    setTimeout(() => toast.remove(), 220);
  }, 2800);
}

/**
 * Render Sidebar-Panel Profile Card Information
 */
export function renderUserProfile() {
  const p = AppState.userProfile;
  const initial = (p.name || 'P').trim().charAt(0).toUpperCase();

  if (DOM.headerAvatarCircle) DOM.headerAvatarCircle.textContent = initial;
  if (DOM.profileLargeAvatar) DOM.profileLargeAvatar.textContent = initial;
  if (DOM.modalAvatarPreview) DOM.modalAvatarPreview.textContent = initial;

  if (DOM.profileCardName) DOM.profileCardName.textContent = p.name || 'Pratik';

  if (DOM.profileCardEmail) {
    const college = p.college || 'VIT Pune';
    DOM.profileCardEmail.textContent = `Scholar • ${college}`;
  }

  if (DOM.switchProfileName1) DOM.switchProfileName1.textContent = '✓';

  if (DOM.profileStreakTag) DOM.profileStreakTag.textContent = `${p.streakDays || 0}d streak`;
  if (DOM.profilePointsTag) DOM.profilePointsTag.textContent = `${p.greenPoints || 0} pts`;

  if (DOM.userPointsValue) DOM.userPointsValue.textContent = p.greenPoints || 0;
}

/**
 * Refresh KPI Cards and Green Score
 */
export function renderKPIs() {
  if (!window.AIEngine || !DOM.todayTotalValue) return;
  const analysis = window.AIEngine.analyzeBehavior(AppState.history);
  if (!analysis) return;

  // Today's entry (last day of history)
  const today = AppState.history[AppState.history.length - 1];
  const todayTotal = today ? today.total : 0;
  DOM.todayTotalValue.textContent = todayTotal.toFixed(1);

  const nationalAvg = (AppState.config && AppState.config.benchmarks && AppState.config.benchmarks.national_average_kg_per_day)
    ? AppState.config.benchmarks.national_average_kg_per_day
    : ((window.MockData && window.MockData.benchmarks) ? window.MockData.benchmarks.nationalAverage : 9.8);

  const diffPct = Math.round(((nationalAvg - todayTotal) / nationalAvg) * 100);
  if (diffPct >= 0) {
    DOM.todayBenchmarkBadge.className = 'trend-badge positive';
    DOM.todayBenchmarkBadge.textContent = `−${diffPct}% vs avg`;
  } else {
    DOM.todayBenchmarkBadge.className = 'trend-badge negative';
    DOM.todayBenchmarkBadge.textContent = `+${Math.abs(diffPct)}% vs avg`;
  }

  // Weekly average
  DOM.weeklyAvgValue.textContent = analysis.dailyAvg.toFixed(1);
  if (analysis.trendPercent <= 0) {
    DOM.weeklyTrendBadge.className = 'trend-badge positive';
    DOM.weeklyTrendBadge.textContent = `−${Math.abs(analysis.trendPercent)}%`;
  } else {
    DOM.weeklyTrendBadge.className = 'trend-badge negative';
    DOM.weeklyTrendBadge.textContent = `+${analysis.trendPercent}%`;
  }

  // Green Score (0-100)
  const greenScore = window.AIEngine.calculateGreenScore(analysis.dailyAvg);
  DOM.scoreDisplay.textContent = greenScore.score;
  DOM.scoreRatingText.textContent = greenScore.rating;
  DOM.scoreRatingText.style.color = greenScore.color;
  DOM.scoreBadgeText.textContent = greenScore.badge;
  DOM.scoreCircle.style.setProperty('--score-pct', greenScore.score);
  DOM.scoreSummaryDesc.textContent = greenScore.description;

  // User Points & Profile
  DOM.userPointsValue.textContent = AppState.userProfile.greenPoints;
  renderUserProfile();
}

/**
 * Render AI Recommendations Cards (calls /api/recommendations when online)
 */
export async function renderAIRecommendations() {
  if (!DOM.aiRecommendationsGrid) return;
  const analysis = window.AIEngine
    ? window.AIEngine.analyzeBehavior(AppState.history)
    : { dominantCategory: 'transport', dominantCategoryPercentage: 0, isImproving: true };

  const dominantCat = analysis.dominantCategory || 'transport';
  const dominantCatMeta = (window.CarbonCalc && window.CarbonCalc.categoriesMeta)
    ? window.CarbonCalc.categoriesMeta[dominantCat]
    : { name: 'Transportation' };

  if (DOM.aiBehaviorSummary) {
    DOM.aiBehaviorSummary.textContent = `Behavior insight: Dominant source is ${dominantCatMeta ? dominantCatMeta.name : 'Transportation'} (${analysis.dominantCategoryPercentage || 0}%). Trend is ${analysis.isImproving ? 'improving' : 'stable'}.`;
  }

  let recs = [];
  if (AppState.isOnline) {
    try {
      const res = await API.getRecommendations(dominantCat);
      if (res && Array.isArray(res.recommendations) && res.recommendations.length > 0) {
        recs = res.recommendations.map(r => ({
          id: r.id,
          title: r.title,
          description: r.description,
          co2eMonthlySaving: typeof r.saving_kg_per_month === 'number' ? r.saving_kg_per_month : (parseFloat(r.saving) || 15.0),
          impactScore: r.difficulty || 'High Impact',
          impactClass: (r.difficulty === 'Easy' || r.difficulty === 'Zero Cost') ? 'easy' : 'medium',
          category: dominantCat,
          actionLabel: 'Adopt habit'
        }));
      }
    } catch (err) {
      console.warn('API recommendations failed, falling back to local engine:', err);
    }
  }

  // Fallback to local heuristic recommendations if offline or empty
  if (recs.length === 0 && window.AIEngine) {
    recs = window.AIEngine.generateRecommendations(analysis);
  }

  DOM.aiRecommendationsGrid.innerHTML = '';
  recs.slice(0, 3).forEach(rec => {
    const card = document.createElement('div');
    card.className = 'rec-card';
    card.innerHTML = `
      <div class="rec-badge ${rec.impactClass}">${rec.impactScore}</div>
      <div>
        <h4 class="rec-title">${rec.title}</h4>
        <p class="rec-desc">${rec.description}</p>
      </div>
      <div>
        <div class="rec-savings-bar">
          <span style="font-size: 0.72rem; color: var(--text-muted); font-family: var(--font-mono);">Reduction:</span>
          <span class="rec-savings-val tabular-num">−${rec.co2eMonthlySaving} kg/mo</span>
        </div>
        <button class="btn-secondary btn-adopt-rec" data-rec-id="${rec.id}">
          + ${rec.actionLabel}
        </button>
      </div>
    `;
    DOM.aiRecommendationsGrid.appendChild(card);
  });

  // Attach click events to Adopt buttons
  document.querySelectorAll('.btn-adopt-rec').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const b = e.currentTarget;
      b.classList.add('adopted');
      b.innerHTML = '✓ Habit adopted (+30 pts)';
      b.disabled = true;

      // Reward points
      AppState.userProfile.greenPoints += 30;
      if (DOM.userPointsValue) DOM.userPointsValue.textContent = AppState.userProfile.greenPoints;

      // Automatically boost simulator sliders slightly
      AppState.whatIfModifiers.transportReduction = Math.min(100, AppState.whatIfModifiers.transportReduction + 15);
      if (DOM.sliderTransport) DOM.sliderTransport.value = AppState.whatIfModifiers.transportReduction;
      if (DOM.valSliderTransport) DOM.valSliderTransport.textContent = `${AppState.whatIfModifiers.transportReduction}%`;
      updateFuturePredictions();

      showToast('Habit adopted. +30 green points earned.');
    });
  });
}

/**
 * Render Gamification Badges
 */
export function renderBadges() {
  if (!DOM.badgesContainer) return;
  DOM.badgesContainer.innerHTML = '';
  AppState.badges.forEach(b => {
    const card = document.createElement('div');
    card.className = `badge-card ${b.status}`;
    card.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: space-between;">
        <span class="cat-dot ${b.category || 'transport'}"></span>
        <span style="font-size: 0.68rem; font-family: var(--font-mono); color: var(--text-muted);">${b.status === 'unlocked' ? 'Unlocked' : 'In Progress'}</span>
      </div>
      <div class="badge-name">${b.title}</div>
      <div class="badge-desc">${b.description}</div>
    `;
    DOM.badgesContainer.appendChild(card);
  });
}

/**
 * Render Active Challenges
 */
export function renderChallenges() {
  if (!DOM.challengesContainer) return;
  DOM.challengesContainer.innerHTML = '';
  AppState.challenges.forEach(ch => {
    const pct = Math.min(100, Math.round((ch.current / ch.target) * 100));
    const card = document.createElement('div');
    card.className = 'challenge-card';
    card.innerHTML = `
      <div class="challenge-top">
        <div class="challenge-title-wrap">
          <span class="cat-dot ${ch.category || 'transport'}"></span>
          <span>${ch.title}</span>
        </div>
        <span class="challenge-reward">+${ch.rewardPoints} pts</span>
      </div>
      <div class="progress-track">
        <div class="progress-bar-fill" style="width: ${pct}%"></div>
      </div>
      <div class="challenge-footer">
        <span>${ch.current} / ${ch.target} ${ch.unit} completed (${pct}%)</span>
        <span style="color: var(--accent-mint); font-weight: 500;">${ch.daysLeft}d left</span>
      </div>
    `;
    DOM.challengesContainer.appendChild(card);
  });
}

/**
 * Render History Activity Table with Delete button
 */
export function renderActivityTable() {
  if (!DOM.activityTableBody) return;
  DOM.activityTableBody.innerHTML = '';

  AppState.activities.slice(0, 10).forEach(act => {
    const tr = document.createElement('tr');

    const catMeta = (window.CarbonCalc && window.CarbonCalc.categoriesMeta)
      ? window.CarbonCalc.categoriesMeta[act.category] || { name: act.category }
      : { name: act.category };

    const monthlyBadge = act.period === 'monthly'
      ? `<span class="trend-badge" style="font-size: 0.65rem; padding: 1px 5px; margin-left: 6px;">monthly</span>`
      : '';

    const syncBadge = act.syncPending
      ? `<span class="trend-badge" style="color: var(--accent-amber); font-size: 0.65rem; padding: 1px 5px; margin-left: 6px;">pending sync</span>`
      : '';

    const co2Val = typeof act.co2e === 'number' ? act.co2e : (parseFloat(act.co2e) || 0);

    tr.innerHTML = `
      <td>${act.date || ''} <span style="color: var(--text-muted); font-size: 0.72rem;">${act.time || ''}</span></td>
      <td>
        <span class="cat-pill">
          <span class="cat-dot ${act.category}"></span>
          <span>${catMeta.name}</span>
        </span>
      </td>
      <td style="font-weight: 500; color: var(--text-primary);">${act.activityName || act.subTypeLabel || act.subType || ''}${monthlyBadge}${syncBadge}</td>
      <td>${act.amount} ${act.unit || ''}</td>
      <td style="color: ${co2Val <= 0 ? 'var(--accent-mint)' : 'var(--text-primary)'}; font-weight: 500;">
        ${co2Val > 0 ? '+' : ''}${co2Val.toFixed(2)} kg
      </td>
      <td style="color: var(--text-secondary); font-weight: 500;">+${act.pointsEarned || 10}</td>
      <td>
        <button class="btn-delete-activity" data-id="${act.id}" title="Delete activity">Delete</button>
      </td>
    `;
    DOM.activityTableBody.appendChild(tr);
  });
}

/**
 * Render Today's Mini Activities List in the Logger Tab (Daily activities only)
 */
export function renderTodayMiniList() {
  if (!DOM.todayLogsMiniList) return;
  DOM.todayLogsMiniList.innerHTML = '';

  const todayStr = new Date().toISOString().split('T')[0];
  // Show only period === 'daily' (exclude monthly entries)
  const todayActs = AppState.activities.filter(a => a.date === todayStr && (a.period === 'daily' || !a.period));

  const panelSubtitle = DOM.todayLogsMiniList.closest('.today-logs-card')?.querySelector('.panel-subtitle');
  if (panelSubtitle) {
    const dailyRunningTotal = todayActs.reduce((sum, a) => sum + (typeof a.co2e === 'number' ? a.co2e : (parseFloat(a.co2e) || 0)), 0);
    panelSubtitle.textContent = `Running total for today: ${dailyRunningTotal.toFixed(2)} kg CO₂`;
  }

  if (todayActs.length === 0) {
    DOM.todayLogsMiniList.innerHTML = `
      <div style="text-align: center; padding: 2rem 1rem; color: var(--text-muted); font-size: 0.8rem;">
        No entries logged today yet.<br>Use the form on the left to add your first activity.
      </div>
    `;
    return;
  }

  todayActs.forEach(act => {
    const co2Val = typeof act.co2e === 'number' ? act.co2e : (parseFloat(act.co2e) || 0);

    const itemEl = document.createElement('div');
    itemEl.className = 'today-log-item';
    itemEl.innerHTML = `
      <div class="today-log-item-left">
        <span class="cat-dot ${act.category}"></span>
        <div>
          <div style="font-weight: 500; color: var(--text-primary); font-size: 0.82rem;">${act.subTypeLabel || act.activityName || act.subType}</div>
          <div style="font-size: 0.7rem; color: var(--text-muted); font-family: var(--font-mono);">${act.amount} ${act.unit || ''} • ${act.time || ''}</div>
        </div>
      </div>
      <div class="today-log-co2 tabular-num">+${co2Val.toFixed(2)} kg</div>
    `;
    DOM.todayLogsMiniList.appendChild(itemEl);
  });
}

/**
 * Update Machine Learning Future Predictions (calls /api/predict when online)
 */
export async function updateFuturePredictions() {
  if (!window.CarbonCharts) return;
  const history = AppState.history || [];
  const modifiers = {
    transport: AppState.whatIfModifiers.transportReduction || 0,
    electricity: AppState.whatIfModifiers.electricityReduction || 0,
    diet: AppState.whatIfModifiers.dietReduction || 0
  };

  const modelBadge = DOM.predictionModelBadge || document.getElementById('predictionModelBadge');
  const modelSub = DOM.predictionModelSubtitle || document.getElementById('predictionModelSubtitle');

  let predResult = null;
  let source = 'Local fallback';

  if (AppState.isOnline) {
    try {
      const res = await API.predict(history, modifiers);
      if (res && res.baselineForecast && res.optimizedForecast) {
        const lastDate = (history.length > 0 && history[history.length - 1].date)
          ? new Date(history[history.length - 1].date)
          : new Date();

        const forecastLabels = [];
        for (let j = 1; j <= res.baselineForecast.length; j++) {
          const nextDate = new Date(lastDate);
          nextDate.setDate(lastDate.getDate() + j);
          forecastLabels.push(nextDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
        }

        predResult = {
          forecastLabels,
          baselineForecast: res.baselineForecast,
          optimizedForecast: res.optimizedForecast,
          regressionSlope: res.slope,
          regressionIntercept: res.intercept,
          projectedSavingsKg: res.projectedWeeklySavingsKg,
          modelType: res.model || 'Scikit-Learn LinearRegression (Flask)',
          rSquared: res.rSquared
        };
        source = 'Flask model';
      }
    } catch (err) {
      console.warn('API predict failed, falling back to local OLS regressor:', err);
    }
  }

  // Fallback to client-side local OLS regressor if offline or predict failed
  if (!predResult && window.AIEngine) {
    predResult = window.AIEngine.predictFutureEmissions(history, AppState.whatIfModifiers);
    source = 'Local fallback';
  }

  if (predResult) {
    if (DOM.projectedSavingsDisplay) {
      DOM.projectedSavingsDisplay.textContent = `${predResult.projectedSavingsKg} kg`;
    }
    if (modelBadge) {
      modelBadge.textContent = source;
      modelBadge.className = source === 'Flask model' ? 'trend-badge positive' : 'trend-badge';
    }
    if (modelSub) {
      modelSub.textContent = source === 'Flask model'
        ? 'Status Quo vs Optimized Scenario (Scikit-Learn OLS)'
        : 'Status Quo vs Optimized Scenario (Local OLS fallback)';
    }
    window.CarbonCharts.updatePrediction(predResult);
  }
}

/**
 * Build continuous local 14-day history spreading monthly entries across calendar month
 */
export function buildLocalHistory(days = 14) {
  const today = new Date();
  const dateList = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    dateList.push(d.toISOString().split('T')[0]);
  }

  const categories = ['transport', 'electricity', 'food', 'water', 'waste', 'shopping', 'gas'];
  const summaryMap = {};
  dateList.forEach(d => {
    const entry = { date: d, total: 0 };
    categories.forEach(cat => { entry[cat] = 0; });
    summaryMap[d] = entry;
  });

  const acts = AppState.activities || [];
  let hasRealData = false;

  acts.forEach(act => {
    const actDate = act.date || (act.loggedAt ? act.loggedAt.substring(0, 10) : null);
    const co2Val = typeof act.co2e === 'number' ? act.co2e : (parseFloat(act.co2e) || 0);
    if (!actDate || co2Val <= 0) return;

    if (act.period === 'monthly') {
      const y = parseInt(actDate.substring(0, 4), 10);
      const m = parseInt(actDate.substring(5, 7), 10);
      const daysInMonth = new Date(y, m, 0).getDate();
      const dailyShare = co2Val / daysInMonth;

      for (let dayNum = 1; dayNum <= daysInMonth; dayNum++) {
        const dStr = `${y}-${String(m).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
        if (summaryMap[dStr]) {
          summaryMap[dStr].total += dailyShare;
          if (summaryMap[dStr][act.category] !== undefined) {
            summaryMap[dStr][act.category] += dailyShare;
          }
          hasRealData = true;
        }
      }
    } else {
      if (summaryMap[actDate]) {
        summaryMap[actDate].total += co2Val;
        if (summaryMap[actDate][act.category] !== undefined) {
          summaryMap[actDate][act.category] += co2Val;
        }
        hasRealData = true;
      }
    }
  });

  if (!hasRealData) {
    return {
      history: Storage.get('ecotrack_history', [...(window.MockData ? window.MockData.history14Days : [])]),
      isSampleData: true
    };
  }

  const history = dateList.map(d => {
    const item = summaryMap[d];
    item.total = parseFloat(item.total.toFixed(3));
    categories.forEach(cat => {
      item[cat] = parseFloat(item[cat].toFixed(3));
    });
    return item;
  });
  return { history, isSampleData: false };
}

/**
 * Refresh continuous 14-day summary from /api/summary, update charts & KPIs
 */
export async function refreshSummaryAndCharts() {
  if (AppState.isOnline) {
    try {
      const summaryDays = await API.getSummary(14);
      if (Array.isArray(summaryDays) && summaryDays.length > 0) {
        const hasRealData = summaryDays.some(d => d.total > 0);
        if (hasRealData) {
          AppState.history = summaryDays;
          AppState.isSampleData = false;
        } else {
          AppState.history = Storage.get('ecotrack_history', [...(window.MockData ? window.MockData.history14Days : [])]);
          AppState.isSampleData = true;
        }
      }
    } catch (err) {
      console.warn('API getSummary failed, using local history spreading fallback:', err);
      const local = buildLocalHistory(14);
      AppState.history = local.history;
      AppState.isSampleData = local.isSampleData;
    }
  } else {
    const local = buildLocalHistory(14);
    AppState.history = local.history;
    AppState.isSampleData = local.isSampleData;
  }

  renderUserProfile();
  renderKPIs();
  renderActivityTable();
  renderTodayMiniList();
  renderAIRecommendations();

  if (window.CarbonCharts) {
    window.CarbonCharts.renderCategoryDonut(AppState.history);
    window.CarbonCharts.renderTrendChart(AppState.history, AppState.timeRange);
  }
  updateFuturePredictions();
}
