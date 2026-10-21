/**
 * Dashboard & Visual Rendering Module (dashboard.js)
 * Manages KPI updates, profile displays, recommendations cards, badges, activity tables, and charts.
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
  toast.innerHTML = `<span>🌿</span> <span>${msg}</span>`;
  DOM.toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3200);
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
    DOM.profileCardEmail.textContent = `🌱 Eco Scholar • ${college}`;
  }

  if (DOM.switchProfileName1) DOM.switchProfileName1.textContent = '✓';

  if (DOM.profileStreakTag) DOM.profileStreakTag.textContent = `🔥 ${p.streakDays || 0} Day Streak`;
  if (DOM.profilePointsTag) DOM.profilePointsTag.textContent = `⭐ ${p.greenPoints || 0} Pts`;

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
    DOM.todayBenchmarkBadge.textContent = `↓ ${diffPct}% below avg`;
  } else {
    DOM.todayBenchmarkBadge.className = 'trend-badge negative';
    DOM.todayBenchmarkBadge.textContent = `↑ ${Math.abs(diffPct)}% above avg`;
  }

  // Weekly average
  DOM.weeklyAvgValue.textContent = analysis.dailyAvg.toFixed(1);
  if (analysis.trendPercent <= 0) {
    DOM.weeklyTrendBadge.className = 'trend-badge positive';
    DOM.weeklyTrendBadge.textContent = `↓ ${Math.abs(analysis.trendPercent)}%`;
  } else {
    DOM.weeklyTrendBadge.className = 'trend-badge negative';
    DOM.weeklyTrendBadge.textContent = `↑ ${analysis.trendPercent}%`;
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
    : { name: 'Transportation', icon: '🚗' };

  if (DOM.aiBehaviorSummary) {
    DOM.aiBehaviorSummary.textContent = `Behavior Insight: Dominant source is ${dominantCatMeta ? dominantCatMeta.name : 'Transportation'} (${analysis.dominantCategoryPercentage || 0}%). Weekly footprint is ${analysis.isImproving ? 'improving' : 'steady'}.`;
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
          icon: dominantCatMeta?.icon || '🌱',
          actionLabel: 'Adopt Habit'
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
        <div class="rec-icon">${rec.icon}</div>
        <h4 class="rec-title">${rec.title}</h4>
        <p class="rec-desc">${rec.description}</p>
      </div>
      <div>
        <div class="rec-savings-bar">
          <span style="font-size: 0.75rem; color: var(--text-muted);">Projected Benefit:</span>
          <span class="rec-savings-val">-${rec.co2eMonthlySaving} kg/mo</span>
        </div>
        <button class="btn-adopt-rec" data-rec-id="${rec.id}">
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
      b.innerHTML = '✓ Habit Adopted (+30 pts)';
      b.disabled = true;

      // Reward points
      AppState.userProfile.greenPoints += 30;
      if (DOM.userPointsValue) DOM.userPointsValue.textContent = AppState.userProfile.greenPoints;

      // Automatically boost simulator sliders slightly
      AppState.whatIfModifiers.transportReduction = Math.min(100, AppState.whatIfModifiers.transportReduction + 15);
      if (DOM.sliderTransport) DOM.sliderTransport.value = AppState.whatIfModifiers.transportReduction;
      if (DOM.valSliderTransport) DOM.valSliderTransport.textContent = `${AppState.whatIfModifiers.transportReduction}%`;
      updateFuturePredictions();

      showToast('🌱 Habit Adopted! Earned 30 Green Points & updated future trajectory.');
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
      <div class="badge-icon">${b.icon}</div>
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
          <span>${ch.icon}</span>
          <span>${ch.title}</span>
        </div>
        <span class="challenge-reward">+${ch.rewardPoints} pts</span>
      </div>
      <div class="progress-track">
        <div class="progress-bar-fill" style="width: ${pct}%"></div>
      </div>
      <div class="challenge-footer">
        <span>${ch.current} / ${ch.target} ${ch.unit} completed (${pct}%)</span>
        <span style="color: var(--accent-mint); font-weight: 500;">${ch.daysLeft} days remaining</span>
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
      ? window.CarbonCalc.categoriesMeta[act.category] || { name: act.category, icon: '•' }
      : { name: act.category, icon: '•' };

    const syncBadge = act.syncPending
      ? `<span class="trend-badge" style="background: rgba(245, 158, 11, 0.2); color: #f59e0b; font-size: 0.65rem; padding: 2px 6px; margin-left: 6px;">pending sync</span>`
      : '';

    const co2Val = typeof act.co2e === 'number' ? act.co2e : (parseFloat(act.co2e) || 0);

    tr.innerHTML = `
      <td>${act.date || ''} <span style="color: var(--text-muted); font-size: 0.75rem;">${act.time || ''}</span></td>
      <td>
        <span class="cat-pill ${act.category}">
          <span>${catMeta.icon}</span> ${catMeta.name}
        </span>
      </td>
      <td style="font-weight: 500; color: #ffffff;">${act.activityName || act.subTypeLabel || act.subType || ''}${syncBadge}</td>
      <td>${act.amount} ${act.unit || ''}</td>
      <td style="font-family: var(--font-heading); font-weight: 700; color: ${co2Val <= 0 ? 'var(--accent-mint)' : '#ffffff'};">
        ${co2Val > 0 ? '+' : ''}${co2Val.toFixed(2)} kg
      </td>
      <td style="color: var(--accent-amber); font-weight: 600;">+${act.pointsEarned || 10}</td>
      <td>
        <button class="btn-delete-activity" data-id="${act.id}" title="Delete activity" style="background: none; border: none; cursor: pointer; color: #ef4444; font-size: 0.95rem; padding: 4px 8px; border-radius: 4px;">🗑️</button>
      </td>
    `;
    DOM.activityTableBody.appendChild(tr);
  });
}

/**
 * Render Today's Mini Activities List in the Logger Tab
 */
export function renderTodayMiniList() {
  if (!DOM.todayLogsMiniList) return;
  DOM.todayLogsMiniList.innerHTML = '';

  const todayStr = new Date().toISOString().split('T')[0];
  const todayActs = AppState.activities.filter(a => a.date === todayStr);

  if (todayActs.length === 0) {
    DOM.todayLogsMiniList.innerHTML = `
      <div style="text-align: center; padding: 2.5rem 1rem; color: var(--text-muted); font-size: 0.85rem;">
        <span style="font-size: 1.75rem;">🌱</span><br><br>
        No entries logged today yet.<br>Use the form on the left to add your first activity!
      </div>
    `;
    return;
  }

  todayActs.forEach(act => {
    const catMeta = (window.CarbonCalc && window.CarbonCalc.categoriesMeta)
      ? window.CarbonCalc.categoriesMeta[act.category] || { icon: '🌿', color: '#10b981' }
      : { icon: '🌿', color: '#10b981' };

    const co2Val = typeof act.co2e === 'number' ? act.co2e : (parseFloat(act.co2e) || 0);

    const itemEl = document.createElement('div');
    itemEl.className = 'today-log-item';
    itemEl.innerHTML = `
      <div class="today-log-item-left">
        <span style="font-size: 1.1rem;">${catMeta.icon}</span>
        <div>
          <div style="font-weight: 500; color: #ffffff;">${act.subTypeLabel || act.activityName || act.subType}</div>
          <div style="font-size: 0.72rem; color: var(--text-muted);">${act.amount} ${act.unit || ''} • ${act.time || ''}</div>
        </div>
      </div>
      <div class="today-log-co2">+${co2Val.toFixed(2)} kg</div>
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
        ? 'Status Quo vs AI-Optimized Lifestyle (Scikit-Learn OLS)'
        : 'Status Quo vs AI-Optimized Lifestyle (Local OLS fallback)';
    }
    window.CarbonCharts.updatePrediction(predResult);
  }
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
          // If database is empty, keep sample mock data and label it
          AppState.history = Storage.get('ecotrack_history', [...(window.MockData ? window.MockData.history14Days : [])]);
          AppState.isSampleData = true;
        }
      }
    } catch (err) {
      console.warn('API getSummary failed, keeping local history:', err);
    }
  }

  // Update trend chart subtitle/badge based on sample vs real data
  const sub = DOM.trendChartSubtitle || document.getElementById('trendChartSubtitle');
  if (sub) {
    if (AppState.isSampleData) {
      sub.innerHTML = `Sample data · Log activities in Daily Logger to see real trends`;
    } else {
      sub.innerHTML = `Real logs · Continuous 14-day history from SQLite`;
    }
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
