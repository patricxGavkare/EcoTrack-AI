/**
 * Logger Form Module (logger-form.js)
 * Manages the MCQ Quick Logger, step transitions, Carbon Receipt generation, and Monthly Logger.
 */

import { AppState, QL, DOM } from './state.js';
import { Storage } from './storage.js';
import {
  showToast,
  renderUserProfile,
  renderKPIs,
  renderActivityTable,
  renderTodayMiniList,
  renderAIRecommendations
} from './dashboard.js';

/**
 * Step navigation helper for MCQ Quick Logger
 */
export function qlGoToStep(n) {
  document.querySelectorAll('.ql-step').forEach(s => s.classList.remove('active'));
  const stepEl = document.getElementById(`qlStep${n}`);
  if (stepEl) stepEl.classList.add('active');

  if (n === 5) {
    const receipt = document.getElementById('qlReceipt');
    if (receipt) receipt.classList.add('active');
  }

  document.querySelectorAll('.ql-progress-step').forEach(dot => {
    const s = parseInt(dot.dataset.step, 10);
    dot.classList.remove('active', 'done');
    if (s < n) dot.classList.add('done');
    else if (s === n) dot.classList.add('active');
  });

  ['pLine1', 'pLine2', 'pLine3'].forEach((id, idx) => {
    const line = document.getElementById(id);
    if (line) line.classList.toggle('done', idx + 1 < n);
  });

  QL.step = n;
}

/**
 * Carbon Receipt Builder
 */
export function qlBuildReceipt() {
  const rawKm = QL.distance.km * QL.returnMultiplier.val;
  QL.totalTransportCO2 = parseFloat((rawKm * QL.transport.factor).toFixed(2));
  QL.totalFoodCO2 = parseFloat(QL.food.co2.toFixed(2));
  QL.grandTotal = parseFloat((QL.totalTransportCO2 + QL.totalFoodCO2).toFixed(2));

  const now = new Date();
  const dateEl = document.getElementById('receiptDate');
  if (dateEl) {
    dateEl.textContent = now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
  }

  const items = document.getElementById('receiptItems');
  if (items) {
    items.innerHTML = '';
    const lines = [
      { label: `🚗 ${QL.transport.label} — ${(rawKm).toFixed(1)} km`, val: QL.totalTransportCO2 },
      { label: `🍽️ Food: ${QL.food.label}`, val: QL.totalFoodCO2 }
    ];
    lines.forEach(l => {
      const row = document.createElement('div');
      row.className = 'receipt-item-row';
      row.innerHTML = `<span>${l.label}</span><span>${l.val.toFixed(2)} kg CO₂</span>`;
      items.appendChild(row);
    });
  }

  const totalEl = document.getElementById('receiptTotal');
  if (totalEl) totalEl.textContent = `${QL.grandTotal} kg CO₂`;

  const cmpContainer = document.getElementById('receiptComparisons');
  if (cmpContainer) {
    cmpContainer.innerHTML = '';
    const comparisons = [
      { icon: '🌳', text: `= ${(QL.grandTotal / 21.7).toFixed(2)} trees' monthly CO₂ absorption` },
      { icon: '💧', text: `= ${(QL.grandTotal * 1000).toLocaleString('en-IN')} litres of water wasted` },
      { icon: '🏭', text: `India avg is 9.8 kg/day — you're at ${QL.grandTotal < 9.8 ? '✅ below' : '⚠️ above'} average` }
    ];
    comparisons.forEach(c => {
      const row = document.createElement('div');
      row.className = 'receipt-cmp-row';
      row.innerHTML = `<span>${c.icon}</span><span>${c.text}</span>`;
      cmpContainer.appendChild(row);
    });
  }
}

/**
 * Save MCQ Log to AppState and LocalStorage
 */
export function qlSaveToHistory() {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const timeStr = now.toTimeString().substring(0, 5);

  if (QL.totalTransportCO2 > 0) {
    AppState.activities.unshift({
      id: 'ql-t-' + Date.now(),
      date: todayStr,
      time: timeStr,
      category: 'transport',
      subType: QL.transport.val,
      activityName: QL.transport.label,
      amount: parseFloat((QL.distance.km * QL.returnMultiplier.val).toFixed(1)),
      unit: 'km',
      co2e: QL.totalTransportCO2,
      pointsEarned: 10,
      subTypeLabel: QL.transport.label
    });
  }

  AppState.activities.unshift({
    id: 'ql-f-' + Date.now(),
    date: todayStr,
    time: timeStr,
    category: 'food',
    subType: 'daily_diet',
    activityName: QL.food.label,
    amount: 1,
    unit: 'meal',
    co2e: QL.totalFoodCO2,
    pointsEarned: 10,
    subTypeLabel: QL.food.label
  });

  const lastEntry = AppState.history[AppState.history.length - 1];
  if (lastEntry) {
    lastEntry.total = parseFloat((lastEntry.total + QL.grandTotal).toFixed(2));
    lastEntry.transport = parseFloat(((lastEntry.transport || 0) + QL.totalTransportCO2).toFixed(2));
    lastEntry.food = parseFloat(((lastEntry.food || 0) + QL.totalFoodCO2).toFixed(2));
  }

  AppState.userProfile.greenPoints += 20;
  AppState.userProfile.streakDays = (AppState.userProfile.streakDays || 0) + 1;
  Storage.set('ecotrack_user_profile', AppState.userProfile);
  Storage.set('ecotrack_history', AppState.history);
  Storage.set('ecotrack_activities', AppState.activities);

  const todayLogKey = `ql_logged_${todayStr}`;
  Storage.setRaw(todayLogKey, '1');

  renderUserProfile();
  renderKPIs();
  renderActivityTable();
  renderTodayMiniList();
  renderAIRecommendations();

  if (window.CarbonCharts) {
    window.CarbonCharts.renderCategoryDonut(AppState.history);
    window.CarbonCharts.renderTrendChart(AppState.history, AppState.timeRange);
  }

  const streakNum = document.getElementById('loggerStreakNum');
  if (streakNum) streakNum.textContent = AppState.userProfile.streakDays || 0;

  showToast(`✅ Logged! +20 pts · ${QL.grandTotal} kg CO₂ today`);
}

/**
 * Monthly Logger access window check (1st-5th of each month)
 */
export function initMonthlyLogger() {
  const today = new Date();
  const day = today.getDate();
  const monthKey = `monthly_${today.getFullYear()}_${today.getMonth() + 1}`;
  const alreadyLogged = Storage.getRaw(monthKey);
  const isOpen = day >= 1 && day <= 5;

  const badge = document.getElementById('monthlyAccessBadge');
  const lockedDiv = document.getElementById('monthlyLockedState');
  const unlockedDiv = document.getElementById('monthlyUnlockedState');
  const lockSub = document.getElementById('monthlyLockSub');
  const lastLogged = document.getElementById('monthlyLastLogged');

  if (alreadyLogged) {
    if (badge) { badge.textContent = '✅ Done'; badge.classList.add('open'); }
    if (lockedDiv) lockedDiv.classList.remove('hidden');
    if (unlockedDiv) unlockedDiv.classList.add('hidden');
    if (lockSub) lockSub.textContent = 'Already logged for this month ✓';
    if (lastLogged) lastLogged.textContent = `Logged on: ${alreadyLogged}`;
  } else if (isOpen) {
    if (badge) { badge.textContent = '🔓 Open Now!'; badge.classList.add('open'); }
    if (lockedDiv) lockedDiv.classList.add('hidden');
    if (unlockedDiv) unlockedDiv.classList.remove('hidden');
  } else {
    const nextFirst = new Date(today.getFullYear(), today.getMonth() + (day > 5 ? 1 : 0), 1);
    const daysLeft = Math.ceil((nextFirst - today) / (1000 * 60 * 60 * 24));
    if (badge) badge.textContent = '🔒 Locked';
    if (lockSub) lockSub.textContent = `Opens in ${daysLeft} day${daysLeft !== 1 ? 's' : ''} · Available 1st–5th`;
    if (lockedDiv) lockedDiv.classList.remove('hidden');
    if (unlockedDiv) unlockedDiv.classList.add('hidden');
  }
}

/**
 * Setup MCQ Quick Logger & Monthly form event listeners
 */
export function setupQLListeners() {
  // Step 1: Transport Mode
  document.querySelectorAll('#transportModeGrid .ql-mcq-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#transportModeGrid .ql-mcq-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      QL.transport = {
        val: btn.dataset.val,
        factor: parseFloat(btn.dataset.factor),
        label: btn.dataset.label
      };
      const next1 = document.getElementById('qlNext1');
      if (next1) next1.disabled = false;

      const distHint = document.getElementById('qlDistanceHint');
      if (distHint) {
        distHint.textContent = QL.transport.factor === 0
          ? '(Walked/cycled — still log distance for health tracking)'
          : 'Select the distance range for your trip';
      }
    });
  });

  const btnShowTCust = document.getElementById('btnShowTransportCustom');
  if (btnShowTCust) {
    btnShowTCust.addEventListener('click', () => {
      const wrap = document.getElementById('transportCustomWrap');
      if (wrap) wrap.classList.toggle('hidden');
    });
  }

  document.getElementById('qlNext1')?.addEventListener('click', () => qlGoToStep(2));

  // Step 2: Distance
  document.querySelectorAll('#distanceGrid .distance-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#distanceGrid .distance-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      QL.distance = { km: parseFloat(btn.dataset.km), label: btn.dataset.label };
      const next2 = document.getElementById('qlNext2');
      if (next2) next2.disabled = false;
    });
  });

  const btnShowDCust = document.getElementById('btnShowDistCustom');
  if (btnShowDCust) {
    btnShowDCust.addEventListener('click', () => {
      const wrap = document.getElementById('distCustomWrap');
      if (wrap) wrap.classList.toggle('hidden');
    });
  }

  document.getElementById('distCustomKm')?.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    if (val > 0) {
      QL.distance = { km: val, label: `${val} km (custom)` };
      const next2 = document.getElementById('qlNext2');
      if (next2) next2.disabled = false;
    }
  });

  document.getElementById('qlBack2')?.addEventListener('click', () => qlGoToStep(1));
  document.getElementById('qlNext2')?.addEventListener('click', () => qlGoToStep(3));

  // Step 3: Return Trip
  document.querySelectorAll('#returnGrid .return-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#returnGrid .return-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      QL.returnMultiplier = {
        val: parseFloat(btn.dataset.multiplier),
        label: btn.dataset.label
      };
      const next3 = document.getElementById('qlNext3');
      if (next3) next3.disabled = false;
    });
  });

  document.getElementById('qlBack3')?.addEventListener('click', () => qlGoToStep(2));
  document.getElementById('qlNext3')?.addEventListener('click', () => qlGoToStep(4));

  // Step 4: Food
  document.querySelectorAll('#foodGrid .food-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#foodGrid .food-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      QL.food = { co2: parseFloat(btn.dataset.co2), label: btn.dataset.label };
      const submit = document.getElementById('qlSubmit');
      if (submit) submit.disabled = false;
    });
  });

  document.getElementById('qlBack4')?.addEventListener('click', () => qlGoToStep(3));

  document.getElementById('qlSubmit')?.addEventListener('click', () => {
    qlBuildReceipt();
    qlGoToStep(5);
  });

  // Receipt Actions
  document.getElementById('qlLogAgain')?.addEventListener('click', () => {
    Object.assign(QL, {
      step: 1,
      transport: { val: null, factor: 0, label: '' },
      distance: { km: 0, label: '' },
      returnMultiplier: { val: 1, label: '' },
      food: { co2: 0, label: '' }
    });
    document.querySelectorAll('.ql-mcq-btn').forEach(b => b.classList.remove('selected'));
    const n1 = document.getElementById('qlNext1'); if (n1) n1.disabled = true;
    const s = document.getElementById('qlSubmit'); if (s) s.disabled = true;
    qlGoToStep(1);
  });

  document.getElementById('qlSaveToHistory')?.addEventListener('click', () => {
    qlSaveToHistory();
    showToast('📊 Logged to your history & dashboard!');
    setTimeout(() => {
      document.querySelectorAll('.ql-mcq-btn').forEach(b => b.classList.remove('selected'));
      const n1 = document.getElementById('qlNext1'); if (n1) n1.disabled = true;
      const s = document.getElementById('qlSubmit'); if (s) s.disabled = true;
      qlGoToStep(1);
    }, 1200);
  });

  // Monthly Logger MCQ Options
  ['mq1', 'mq2', 'mq3', 'mq4', 'mq5'].forEach(groupId => {
    const group = document.getElementById(groupId);
    if (!group) return;
    group.querySelectorAll('.mq-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        group.querySelectorAll('.mq-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
      });
    });
  });

  // Monthly Submit
  document.getElementById('btnMonthlySubmit')?.addEventListener('click', () => {
    const today = new Date();
    const monthKey = `monthly_${today.getFullYear()}_${today.getMonth() + 1}`;
    const dateStr = today.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

    const elec = document.querySelector('#mq1 .mq-btn.selected')?.dataset.val
      || document.getElementById('mqElecUnits')?.value || '300';
    const lpg = document.querySelector('#mq2 .mq-btn.selected')?.dataset.val || '1';
    const water = document.querySelector('#mq3 .mq-btn.selected')?.dataset.val || '6000';
    const shop = document.querySelector('#mq4 .mq-btn.selected')?.dataset.val || '2000';
    const waste = document.querySelector('#mq5 .mq-btn.selected')?.dataset.val || '25';

    const electricCO2 = parseFloat((parseFloat(elec) * 0.71).toFixed(1));
    const lpgCO2 = parseFloat((parseFloat(lpg) * 14.2).toFixed(1));
    const waterCO2 = parseFloat((parseFloat(water) * 0.000298).toFixed(2));
    const shopCO2 = parseFloat((parseFloat(shop) * 0.004).toFixed(1));
    const wasteCO2 = parseFloat((parseFloat(waste) * 0.5).toFixed(1));
    const monthlyTotal = parseFloat((electricCO2 + lpgCO2 + waterCO2 + shopCO2 + wasteCO2).toFixed(1));

    const monthData = { electricCO2, lpgCO2, waterCO2, shopCO2, wasteCO2, total: monthlyTotal, date: dateStr };
    Storage.setRaw(monthKey, dateStr);
    Storage.set(`${monthKey}_data`, monthData);

    AppState.userProfile.greenPoints += 50;
    Storage.set('ecotrack_user_profile', AppState.userProfile);
    renderUserProfile();

    initMonthlyLogger();
    showToast(`📅 Monthly report saved! ${monthlyTotal} kg CO₂ from utilities. +50 pts!`);
  });
}

/**
 * Backward compatibility helpers for standard logger forms
 */
export function populateCategoryOptions(categoryKey) {
  if (!DOM.subTypeSelect || !window.CarbonCalc) return;
  const catData = window.CarbonCalc.factors[categoryKey];
  if (!catData) return;

  DOM.subTypeSelect.innerHTML = '';
  const keys = Object.keys(catData);
  keys.forEach((key, idx) => {
    const item = catData[key];
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = `${item.label} (${item.factor} kg CO₂e/${item.unit})`;
    if (idx === 0) opt.selected = true;
    DOM.subTypeSelect.appendChild(opt);
  });

  updateInputUnit();
  updateFormulaPreview();
}

export function updateInputUnit() {
  if (!DOM.subTypeSelect || !window.CarbonCalc) return;
  const cat = AppState.activeCategory;
  const subType = DOM.subTypeSelect.value;
  const item = window.CarbonCalc.factors[cat]?.[subType];

  if (item) {
    if (DOM.unitLabel) DOM.unitLabel.textContent = item.unit;
    if (DOM.factorNote) DOM.factorNote.textContent = item.note;
    if (DOM.amountLabel) DOM.amountLabel.textContent = `Amount in ${item.unit}`;
  }
}

export function updateFormulaPreview() {
  if (!DOM.subTypeSelect || !DOM.amountInput || !window.CarbonCalc) return;
  const cat = AppState.activeCategory;
  const subType = DOM.subTypeSelect.value;
  const amt = parseFloat(DOM.amountInput.value) || 0;
  const calc = window.CarbonCalc.calculateItem(cat, subType, amt);

  if (DOM.formulaEquation) DOM.formulaEquation.textContent = `${calc.amount} ${calc.unit} × ${calc.factor} kg CO₂e/${calc.unit}`;
  if (DOM.formulaResult) DOM.formulaResult.textContent = `${calc.co2e.toFixed(2)} kg CO₂e`;
}
