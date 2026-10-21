/**
 * EcoTrack AI: Main Application Controller (app.js)
 * ES Module Entry Point: Coordinates state, UI modules, charts, event initialization,
 * and seamless asynchronous Flask backend integration with offline fallback.
 */

import { AppState, DOM, initDOM, initData } from './modules/state.js';
import { API } from './modules/api.js';
import {
  renderUserProfile,
  renderKPIs,
  renderAIRecommendations,
  renderBadges,
  renderChallenges,
  renderActivityTable,
  renderTodayMiniList,
  updateFuturePredictions,
  refreshSummaryAndCharts
} from './modules/dashboard.js';
import {
  setupQLListeners,
  initMonthlyLogger,
  syncPendingActivities
} from './modules/logger-form.js';
import { setupEventListeners } from './modules/events.js';

/**
 * Update connection status badge in header and dropdown
 */
function updateConnectionUI(online) {
  AppState.isOnline = online;

  const headerBadge = DOM.headerStatusBadge || document.getElementById('headerStatusBadge');
  const headerDot = DOM.headerStatusDot || document.getElementById('headerStatusDot');
  const headerText = DOM.headerStatusText || document.getElementById('headerStatusText');
  const apiStatusText = DOM.apiStatusText || document.getElementById('apiStatusText');
  const statusDot = DOM.statusDot || document.getElementById('statusDot');

  if (online) {
    if (headerBadge) headerBadge.classList.remove('offline');
    if (headerDot) headerDot.style.background = '#10b981';
    if (headerText) headerText.textContent = 'Connected';
    if (apiStatusText) apiStatusText.textContent = 'Connected (Flask API)';
    if (statusDot) {
      statusDot.style.background = '#10b981';
      statusDot.style.boxShadow = '0 0 8px #10b981';
    }
  } else {
    if (headerBadge) headerBadge.classList.add('offline');
    if (headerDot) headerDot.style.background = '#f59e0b';
    if (headerText) headerText.textContent = 'Offline mode';
    if (apiStatusText) apiStatusText.textContent = 'Offline mode (Local Engine)';
    if (statusDot) {
      statusDot.style.background = '#f59e0b';
      statusDot.style.boxShadow = '0 0 8px #f59e0b';
    }
  }
}

/**
 * App Initialization
 */
async function init() {
  initDOM();
  initData();

  setupEventListeners();
  setupQLListeners();
  initMonthlyLogger();

  // Instant render with local data so UI never blocks
  renderUserProfile();
  renderKPIs();
  renderAIRecommendations();
  renderBadges();
  renderChallenges();
  renderActivityTable();
  renderTodayMiniList();

  const streakNum = document.getElementById('loggerStreakNum');
  if (streakNum) {
    streakNum.textContent = AppState.userProfile.streakDays || 0;
  }

  // Initialize charts with local prediction fallback
  if (window.AIEngine && window.CarbonCharts) {
    const initialPred = window.AIEngine.predictFutureEmissions(AppState.history, AppState.whatIfModifiers);
    if (DOM.projectedSavingsDisplay) {
      DOM.projectedSavingsDisplay.textContent = `${initialPred.projectedSavingsKg} kg`;
    }
    window.CarbonCharts.init(AppState.history, initialPred);
  }

  // Asynchronous Backend Hydration & Sync
  try {
    // 1. Health check
    await API.health();
    updateConnectionUI(true);

    // 2. Fetch scientific factors from Flask backend
    const factorsData = await API.getFactors();
    if (factorsData && factorsData.categories) {
      AppState.factors = factorsData.categories;
      if (window.CarbonCalc) {
        window.CarbonCalc.factors = factorsData.categories;
      }
    }

    // 3. Fetch configuration & operational benchmarks
    const configData = await API.getConfig();
    if (configData) {
      AppState.config = configData;
      if (window.MockData && configData.benchmarks) {
        window.MockData.benchmarks.globalParisTarget = configData.benchmarks.paris_target_kg_per_day;
        window.MockData.benchmarks.nationalAverage = configData.benchmarks.national_average_kg_per_day;
        window.MockData.benchmarks.highEmitterThreshold = configData.benchmarks.high_emitter_threshold;
      }
      initMonthlyLogger();
    }

    // 4. Sync any activities logged while offline
    await syncPendingActivities();

    // 5. Hydrate 14-day history from continuous summary
    await refreshSummaryAndCharts();

  } catch (err) {
    console.warn('Backend unavailable or network error. Using local offline engines.', err);
    updateConnectionUI(false);
    initMonthlyLogger();
  }
}

// Execute on DOM Ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
