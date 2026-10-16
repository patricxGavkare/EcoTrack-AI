/**
 * EcoTrack AI: Main Application Controller (app.js)
 * ES Module Entry Point: Coordinates state, UI modules, charts, and event initialization.
 */

import { AppState, DOM, initDOM, initData } from './modules/state.js';
import {
  renderUserProfile,
  renderKPIs,
  renderAIRecommendations,
  renderBadges,
  renderChallenges,
  renderActivityTable,
  renderTodayMiniList
} from './modules/dashboard.js';
import {
  populateCategoryOptions,
  setupQLListeners,
  initMonthlyLogger
} from './modules/logger-form.js';
import { checkBackend } from './modules/modals.js';
import { setupEventListeners } from './modules/events.js';

/**
 * App Initialization
 */
function init() {
  initDOM();
  initData();

  populateCategoryOptions(AppState.activeCategory);
  setupEventListeners();
  setupQLListeners();
  initMonthlyLogger();

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

  // Initial Future Prediction Data & Charts
  if (window.AIEngine && window.CarbonCharts) {
    const initialPred = window.AIEngine.predictFutureEmissions(AppState.history, AppState.whatIfModifiers);
    if (DOM.projectedSavingsDisplay) {
      DOM.projectedSavingsDisplay.textContent = `${initialPred.projectedSavingsKg} kg`;
    }
    window.CarbonCharts.init(AppState.history, initialPred);
  }

  // Async health check for backend status
  checkBackend();
}

// Execute on DOM Ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
