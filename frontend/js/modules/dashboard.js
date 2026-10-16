/**
 * Dashboard & Visual Rendering Module (dashboard.js)
 * Manages KPI updates, profile displays, recommendations cards, badges, activity tables, and charts.
 */

import { AppState, DOM } from './state.js';

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

  const nationalAvg = (window.MockData && window.MockData.benchmarks) ? window.MockData.benchmarks.nationalAverage : 9.8;
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
 * Render AI Recommendations Cards
 */
export function renderAIRecommendations() {
  if (!window.AIEngine || !DOM.aiRecommendationsGrid) return;
  const analysis = window.AIEngine.analyzeBehavior(AppState.history);
  const recs = window.AIEngine.generateRecommendations(analysis);

  const dominantCatMeta = (window.CarbonCalc && window.CarbonCalc.categoriesMeta)
    ? window.CarbonCalc.categoriesMeta[analysis.dominantCategory]
    : { name: 'Transportation' };

  if (DOM.aiBehaviorSummary) {
    DOM.aiBehaviorSummary.textContent = `Behavior Insight: Dominant source is ${dominantCatMeta ? dominantCatMeta.name : 'Transportation'} (${analysis.dominantCategoryPercentage}%). Weekly footprint is ${analysis.isImproving ? 'improving' : 'steady'}.`;
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
 * Render History Activity Table
 */
export function renderActivityTable() {
  if (!DOM.activityTableBody) return;
  DOM.activityTableBody.innerHTML = '';
  AppState.activities.slice(0, 8).forEach(act => {
    const tr = document.createElement('tr');
    const catMeta = (window.CarbonCalc && window.CarbonCalc.categoriesMeta)
      ? window.CarbonCalc.categoriesMeta[act.category] || { name: act.category, icon: '•' }
      : { name: act.category, icon: '•' };

    tr.innerHTML = `
      <td>${act.date} <span style="color: var(--text-muted); font-size: 0.75rem;">${act.time}</span></td>
      <td>
        <span class="cat-pill ${act.category}">
          <span>${catMeta.icon}</span> ${catMeta.name}
        </span>
      </td>
      <td style="font-weight: 500; color: #ffffff;">${act.activityName}</td>
      <td>${act.amount} ${act.unit}</td>
      <td style="font-family: var(--font-heading); font-weight: 700; color: ${act.co2e <= 0 ? 'var(--accent-mint)' : '#ffffff'};">
        ${act.co2e > 0 ? '+' : ''}${act.co2e.toFixed(2)} kg
      </td>
      <td style="color: var(--accent-amber); font-weight: 600;">+${act.pointsEarned}</td>
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

    const itemEl = document.createElement('div');
    itemEl.className = 'today-log-item';
    itemEl.innerHTML = `
      <div class="today-log-item-left">
        <span style="font-size: 1.1rem;">${catMeta.icon}</span>
        <div>
          <div style="font-weight: 500; color: #ffffff;">${act.subTypeLabel || act.subType}</div>
          <div style="font-size: 0.72rem; color: var(--text-muted);">${act.amount} ${act.unit || ''} • ${act.time || ''}</div>
        </div>
      </div>
      <div class="today-log-co2">+${act.co2e.toFixed(2)} kg</div>
    `;
    DOM.todayLogsMiniList.appendChild(itemEl);
  });
}

/**
 * Update Machine Learning Future Predictions
 */
export function updateFuturePredictions() {
  if (!window.AIEngine || !window.CarbonCharts) return;
  const pred = window.AIEngine.predictFutureEmissions(AppState.history, AppState.whatIfModifiers);
  if (DOM.projectedSavingsDisplay) {
    DOM.projectedSavingsDisplay.textContent = `${pred.projectedSavingsKg} kg`;
  }
  window.CarbonCharts.updatePrediction(pred);
}
