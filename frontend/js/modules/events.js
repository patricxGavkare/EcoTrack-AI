/**
 * UI Event Listeners Module (events.js)
 * Manages tab transitions, range toggles, what-if sliders, and form event delegations.
 */

import { AppState, DOM } from './state.js';
import { Storage } from './storage.js';
import {
  showToast,
  renderKPIs,
  renderActivityTable,
  renderTodayMiniList,
  renderChallenges,
  renderAIRecommendations,
  updateFuturePredictions
} from './dashboard.js';
import {
  populateCategoryOptions,
  updateInputUnit,
  updateFormulaPreview
} from './logger-form.js';
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

/**
 * Setup All Application UI Event Listeners
 */
export function setupEventListeners() {
  // 1. Setup Modals and Profile Dropdowns
  setupModalEvents(switchTab);

  // 2. Category Nav Tabs (guarded fallback)
  if (DOM.categoryTabsNav) {
    DOM.categoryTabsNav.addEventListener('click', (e) => {
      const btn = e.target.closest('.category-tab-btn');
      if (!btn) return;
      document.querySelectorAll('.category-tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      AppState.activeCategory = btn.dataset.category;
      populateCategoryOptions(AppState.activeCategory);
    });
  }

  // 3. Form input adjustments (guarded)
  if (DOM.subTypeSelect) {
    DOM.subTypeSelect.addEventListener('change', () => {
      updateInputUnit();
      updateFormulaPreview();
    });
  }

  if (DOM.amountInput) {
    DOM.amountInput.addEventListener('input', updateFormulaPreview);
  }

  // 4. Standard Logger form submission (guarded fallback)
  if (DOM.loggerForm) {
    DOM.loggerForm.addEventListener('submit', (e) => {
      e.preventDefault();

      const cat = AppState.activeCategory;
      const subType = DOM.subTypeSelect ? DOM.subTypeSelect.value : '';
      const amt = parseFloat(DOM.amountInput ? DOM.amountInput.value : 0);

      if (!amt || amt <= 0) {
        showToast('Please enter a valid amount greater than 0');
        return;
      }

      if (!window.CarbonCalc) return;
      const calc = window.CarbonCalc.calculateItem(cat, subType, amt);
      const now = new Date();
      const timeStr = now.toTimeString().substring(0, 5);
      const todayDateStr = now.toISOString().split('T')[0];

      const newAct = {
        id: 'act-' + Date.now(),
        date: todayDateStr,
        time: timeStr,
        category: cat,
        subType: subType,
        activityName: calc.label,
        amount: amt,
        unit: calc.unit,
        co2e: calc.co2e,
        pointsEarned: 15
      };

      AppState.activities.unshift(newAct);

      const lastHistoryEntry = AppState.history[AppState.history.length - 1];
      if (lastHistoryEntry) {
        lastHistoryEntry.total = parseFloat((lastHistoryEntry.total + calc.co2e).toFixed(2));
        lastHistoryEntry[cat] = parseFloat(((lastHistoryEntry[cat] || 0) + calc.co2e).toFixed(2));
      }

      AppState.userProfile.greenPoints += 15;

      if (cat === 'transport') {
        const ch1 = AppState.challenges.find(c => c.id === 'ch-1');
        if (ch1 && (subType === 'metro_train' || subType === 'bus_public')) {
          ch1.current = Math.min(ch1.target, ch1.current + amt);
        }
      }

      Storage.set('ecotrack_history', AppState.history);
      Storage.set('ecotrack_activities', AppState.activities);

      if (DOM.amountInput) DOM.amountInput.value = '';
      updateFormulaPreview();

      renderKPIs();
      renderActivityTable();
      renderTodayMiniList();
      renderChallenges();
      renderAIRecommendations();

      if (window.CarbonCharts) {
        window.CarbonCharts.renderCategoryDonut(AppState.history);
        window.CarbonCharts.renderTrendChart(AppState.history, AppState.timeRange);
      }
      updateFuturePredictions();

      showToast(`Logged: ${calc.label} (+${calc.co2e} kg CO₂e). +15 Green Points!`);
    });
  }

  // 5. Time Range Toggle (7D / 14D)
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

  // 6. What-If Simulator Sliders
  DOM.sliderTransport?.addEventListener('input', (e) => {
    AppState.whatIfModifiers.transportReduction = parseInt(e.target.value, 10);
    if (DOM.valSliderTransport) DOM.valSliderTransport.textContent = `${AppState.whatIfModifiers.transportReduction}%`;
    updateFuturePredictions();
  });

  DOM.sliderElectricity?.addEventListener('input', (e) => {
    AppState.whatIfModifiers.electricityReduction = parseInt(e.target.value, 10);
    if (DOM.valSliderElectricity) DOM.valSliderElectricity.textContent = `${AppState.whatIfModifiers.electricityReduction}%`;
    updateFuturePredictions();
  });

  DOM.sliderDiet?.addEventListener('input', (e) => {
    AppState.whatIfModifiers.dietReduction = parseInt(e.target.value, 10);
    if (DOM.valSliderDiet) DOM.valSliderDiet.textContent = `${AppState.whatIfModifiers.dietReduction}%`;
    updateFuturePredictions();
  });

  // 7. Navigation Segments
  DOM.mainTabNav?.addEventListener('click', (e) => {
    const btn = e.target.closest('.nav-segment-btn');
    if (btn && btn.dataset.tab) {
      switchTab(btn.dataset.tab);
    }
  });

  DOM.btnQuickLogTab?.addEventListener('click', () => switchTab('logger'));
  DOM.btnViewFullHistory?.addEventListener('click', () => switchTab('history'));
}
