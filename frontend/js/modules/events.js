/**
 * UI Event Listeners Module (events.js)
 * Manages tab transitions, range toggles, what-if sliders, and activity deletions.
 */

import { AppState, DOM } from './state.js';
import { Storage } from './storage.js';
import { API } from './api.js';
import {
  showToast,
  renderKPIs,
  renderActivityTable,
  renderTodayMiniList,
  updateFuturePredictions,
  refreshSummaryAndCharts
} from './dashboard.js';
import { setupModalEvents } from './modals.js';

/**
 * Apple-Style Tab Switcher
 */
export function switchTab(tabKey) {
  const tabMap = {
    'dashboard': DOM.tabDashboard,
    'logger': DOM.tabLogger,
    'ai-simulator': DOM.tabAiSimulator,
    'history': DOM.tabHistory
  };

  if (!tabMap[tabKey]) return;

  // 1. Update Segmented Nav Buttons
  document.querySelectorAll('.nav-segment-btn').forEach(btn => {
    if (btn.dataset.tab === tabKey) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  // 2. Hide all tabs, show active with smooth fade
  document.querySelectorAll('.tab-view').forEach(view => {
    view.classList.remove('active');
  });
  tabMap[tabKey].classList.add('active');

  // 3. Smooth scroll to top
  window.scrollTo({ top: 0, behavior: 'smooth' });

  // 4. Force Chart.js to recalculate dimensions cleanly
  if (window.CarbonCharts && typeof window.CarbonCharts.resizeAll === 'function') {
    window.CarbonCharts.resizeAll();
  }
}

// 300ms Debouncer for simulator slider events
let debounceTimer = null;
function debouncedUpdatePredictions() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    updateFuturePredictions();
  }, 300);
}

/**
 * Setup All Application UI Event Listeners
 */
export function setupEventListeners() {
  // 1. Setup Modals and Profile Dropdowns
  setupModalEvents(switchTab);

  // 2. Time Range Toggle (7D / 14D)
  document.querySelectorAll('.btn-range-toggle').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.btn-range-toggle').forEach(b => b.classList.remove('active'));
      e.currentTarget.classList.add('active');
      AppState.timeRange = parseInt(e.currentTarget.dataset.range, 10);
      if (window.CarbonCharts) {
        window.CarbonCharts.renderTrendChart(AppState.history, AppState.timeRange);
      }
    });
  });

  // 3. What-If Simulator Sliders (Debounced ~300ms)
  DOM.sliderTransport?.addEventListener('input', (e) => {
    AppState.whatIfModifiers.transportReduction = parseInt(e.target.value, 10);
    if (DOM.valSliderTransport) DOM.valSliderTransport.textContent = `${AppState.whatIfModifiers.transportReduction}%`;
    debouncedUpdatePredictions();
  });

  DOM.sliderElectricity?.addEventListener('input', (e) => {
    AppState.whatIfModifiers.electricityReduction = parseInt(e.target.value, 10);
    if (DOM.valSliderElectricity) DOM.valSliderElectricity.textContent = `${AppState.whatIfModifiers.electricityReduction}%`;
    debouncedUpdatePredictions();
  });

  DOM.sliderDiet?.addEventListener('input', (e) => {
    AppState.whatIfModifiers.dietReduction = parseInt(e.target.value, 10);
    if (DOM.valSliderDiet) DOM.valSliderDiet.textContent = `${AppState.whatIfModifiers.dietReduction}%`;
    debouncedUpdatePredictions();
  });

  // 4. Navigation Segments
  DOM.mainTabNav?.addEventListener('click', (e) => {
    const btn = e.target.closest('.nav-segment-btn');
    if (btn && btn.dataset.tab) {
      switchTab(btn.dataset.tab);
    }
  });

  DOM.btnQuickLogTab?.addEventListener('click', () => switchTab('logger'));
  DOM.btnViewFullHistory?.addEventListener('click', () => switchTab('history'));

  // 5. Activity Table Deletion Delegation
  DOM.activityTableBody?.addEventListener('click', async (e) => {
    const btn = e.target.closest('.btn-delete-activity');
    if (!btn) return;
    const rawId = btn.dataset.id;
    if (!rawId) return;

    btn.disabled = true;
    const numId = parseInt(rawId, 10);
    const isServerId = !isNaN(numId) && String(numId) === rawId.trim();

    if (isServerId && AppState.isOnline) {
      try {
        await API.deleteActivity(numId);
        showToast(`🗑️ Activity #${numId} deleted from server.`);
      } catch (err) {
        console.warn('Server deletion failed:', err);
        showToast(`⚠️ Could not delete on server: ${err.message}`);
        btn.disabled = false;
        return;
      }
    } else {
      showToast('🗑️ Activity removed from local history.');
    }

    AppState.activities = AppState.activities.filter(a => String(a.id) !== String(rawId));
    Storage.set('ecotrack_activities', AppState.activities);

    if (AppState.isOnline) {
      await refreshSummaryAndCharts();
    } else {
      renderKPIs();
      renderActivityTable();
      renderTodayMiniList();
    }
  });
}
