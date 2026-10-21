/**
 * Logger Form Module (logger-form.js)
 * Manages the MCQ Quick Logger, step transitions, Carbon Receipt generation, Monthly Logger, and offline sync.
 */

import { AppState, QL, DOM } from './state.js';
import { Storage } from './storage.js';
import { API } from './api.js';
import {
  showToast,
  renderUserProfile,
  renderKPIs,
  renderActivityTable,
  renderTodayMiniList,
  renderAIRecommendations,
  refreshSummaryAndCharts
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

  const natAvg = (AppState.config && AppState.config.benchmarks && AppState.config.benchmarks.national_average_kg_per_day)
    ? AppState.config.benchmarks.national_average_kg_per_day
    : 9.8;

  const cmpContainer = document.getElementById('receiptComparisons');
  if (cmpContainer) {
    cmpContainer.innerHTML = '';
    const comparisons = [
      { icon: '🌳', text: `= ${(QL.grandTotal / 21.7).toFixed(2)} trees' monthly CO₂ absorption` },
      { icon: '💧', text: `= ${(QL.grandTotal * 1000).toLocaleString('en-IN')} litres of water wasted` },
      { icon: '🏭', text: `India avg is ${natAvg} kg/day — you're at ${QL.grandTotal < natAvg ? '✅ below' : '⚠️ above'} average` }
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
 * Save MCQ Log to AppState, Backend (/api/activities), and LocalStorage
 */
export async function qlSaveToHistory() {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const timeStr = now.toTimeString().substring(0, 5);
  const isoLoggedAt = now.toISOString();

  const rawKm = parseFloat((QL.distance.km * QL.returnMultiplier.val).toFixed(1));
  const entriesToSave = [];

  if (QL.transport.key && (rawKm > 0 || QL.totalTransportCO2 > 0)) {
    entriesToSave.push({
      category: 'transport',
      subType: QL.transport.key,
      activityName: QL.transport.label,
      amount: rawKm,
      unit: 'km',
      co2e: QL.totalTransportCO2,
      pointsEarned: 10,
      subTypeLabel: QL.transport.label
    });
  }

  if (QL.food.key) {
    entriesToSave.push({
      category: 'food',
      subType: QL.food.key,
      activityName: QL.food.label,
      amount: 1,
      unit: 'meal',
      co2e: QL.totalFoodCO2,
      pointsEarned: 10,
      subTypeLabel: QL.food.label
    });
  }

  for (const entry of entriesToSave) {
    let savedRow = null;
    if (AppState.isOnline) {
      try {
        savedRow = await API.saveActivity({
          category: entry.category,
          subType: entry.subType,
          amount: entry.amount,
          loggedAt: isoLoggedAt
        });
      } catch (err) {
        console.warn('POST /api/activities failed, storing with pending sync:', err);
      }
    }

    const activityRecord = {
      id: (savedRow && savedRow.id) ? savedRow.id : `local-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      date: todayStr,
      time: timeStr,
      loggedAt: (savedRow && savedRow.logged_at) ? savedRow.logged_at : isoLoggedAt,
      category: entry.category,
      subType: entry.subType,
      activityName: entry.activityName,
      amount: entry.amount,
      unit: entry.unit,
      co2e: (savedRow && typeof savedRow.co2e === 'number') ? savedRow.co2e : entry.co2e,
      pointsEarned: entry.pointsEarned,
      subTypeLabel: entry.subTypeLabel,
      syncPending: !savedRow
    };

    AppState.activities.unshift(activityRecord);
  }

  // Update history & user profile
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

  if (AppState.isOnline) {
    await refreshSummaryAndCharts();
  } else {
    renderUserProfile();
    renderKPIs();
    renderActivityTable();
    renderTodayMiniList();
    renderAIRecommendations();
    if (window.CarbonCharts) {
      window.CarbonCharts.renderCategoryDonut(AppState.history);
      window.CarbonCharts.renderTrendChart(AppState.history, AppState.timeRange);
    }
  }

  const streakNum = document.getElementById('loggerStreakNum');
  if (streakNum) streakNum.textContent = AppState.userProfile.streakDays || 0;

  showToast(`✅ Logged! +20 pts · ${QL.grandTotal} kg CO₂ today`);
}

/**
 * Monthly Logger access window check (reads config.monthly_logger; always open if enforce_window is false)
 */
export function initMonthlyLogger() {
  const today = new Date();
  const day = today.getDate();
  const monthKey = `monthly_${today.getFullYear()}_${today.getMonth() + 1}`;
  const alreadyLogged = Storage.getRaw(monthKey);

  const mConfig = (AppState.config && AppState.config.monthly_logger)
    ? AppState.config.monthly_logger
    : { enforce_window: false, open_from_day: 1, open_to_day: 5 };

  let isOpen = true;
  if (mConfig.enforce_window) {
    const fromDay = mConfig.open_from_day || 1;
    const toDay = mConfig.open_to_day || 5;
    isOpen = day >= fromDay && day <= toDay;
  } else {
    // When enforce_window is false, logger is always open
    isOpen = true;
  }

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
    const toDay = mConfig.open_to_day || 5;
    const nextFirst = new Date(today.getFullYear(), today.getMonth() + (day > toDay ? 1 : 0), mConfig.open_from_day || 1);
    const daysLeft = Math.ceil((nextFirst - today) / (1000 * 60 * 60 * 24));
    if (badge) badge.textContent = '🔒 Locked';
    if (lockSub) lockSub.textContent = `Opens in ${daysLeft} day${daysLeft !== 1 ? 's' : ''} · Available ${mConfig.open_from_day || 1}st–${toDay}th`;
    if (lockedDiv) lockedDiv.classList.remove('hidden');
    if (unlockedDiv) unlockedDiv.classList.add('hidden');
  }
}

/**
 * Idempotent sync of pending activities once reconnected
 */
let isSyncing = false;
export async function syncPendingActivities() {
  if (isSyncing || !AppState.isOnline) return;
  const pending = AppState.activities.filter(a => a.syncPending === true);
  if (pending.length === 0) return;

  isSyncing = true;
  let syncedCount = 0;
  for (const act of pending) {
    try {
      const payload = {
        category: act.category,
        subType: act.subType,
        amount: act.amount,
        loggedAt: act.loggedAt || (act.date ? `${act.date}T12:00:00` : undefined)
      };
      const res = await API.saveActivity(payload);
      if (res && res.id) {
        act.id = res.id;
        delete act.syncPending;
        syncedCount++;
      }
    } catch (err) {
      console.warn('Sync activity failed for:', act, err);
    }
  }
  Storage.set('ecotrack_activities', AppState.activities);
  isSyncing = false;

  if (syncedCount > 0) {
    showToast(`🔄 Synced ${syncedCount} offline activit${syncedCount === 1 ? 'y' : 'ies'} to database!`);
    await refreshSummaryAndCharts();
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

      const key = btn.dataset.key || btn.dataset.val;
      const factors = AppState.factors || (window.CarbonCalc ? window.CarbonCalc.factors : {});
      const factorObj = factors.transport ? factors.transport[key] : null;
      const factorVal = factorObj ? (typeof factorObj === 'object' ? factorObj.factor : factorObj) : 0;

      QL.transport = {
        key: key,
        val: key,
        factor: factorVal,
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

      const key = btn.dataset.key || btn.dataset.val;
      const factors = AppState.factors || (window.CarbonCalc ? window.CarbonCalc.factors : {});
      const factorObj = factors.food ? factors.food[key] : null;
      const factorVal = factorObj ? (typeof factorObj === 'object' ? factorObj.factor : factorObj) : 0;

      QL.food = {
        key: key,
        val: key,
        co2: factorVal,
        label: btn.dataset.label
      };
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
      transport: { key: null, val: null, factor: 0, label: '' },
      distance: { km: 0, label: '' },
      returnMultiplier: { val: 1, label: '' },
      food: { key: null, val: null, co2: 0, label: '' }
    });
    document.querySelectorAll('.ql-mcq-btn').forEach(b => b.classList.remove('selected'));
    const n1 = document.getElementById('qlNext1'); if (n1) n1.disabled = true;
    const s = document.getElementById('qlSubmit'); if (s) s.disabled = true;
    qlGoToStep(1);
  });

  document.getElementById('qlSaveToHistory')?.addEventListener('click', () => {
    qlSaveToHistory();
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
  document.getElementById('btnMonthlySubmit')?.addEventListener('click', async () => {
    const today = new Date();
    const monthKey = `monthly_${today.getFullYear()}_${today.getMonth() + 1}`;
    const dateStr = today.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
    const todayStr = today.toISOString().split('T')[0];
    const isoLoggedAt = today.toISOString();

    const elec = document.querySelector('#mq1 .mq-btn.selected')?.dataset.val
      || document.getElementById('mqElecUnits')?.value || '300';
    const lpg = document.querySelector('#mq2 .mq-btn.selected')?.dataset.val || '1';
    const water = document.querySelector('#mq3 .mq-btn.selected')?.dataset.val || '6000';
    const shop = document.querySelector('#mq4 .mq-btn.selected')?.dataset.val || '2000';
    const waste = document.querySelector('#mq5 .mq-btn.selected')?.dataset.val || '25';

    // Factors lookup (online / fallback)
    const factors = AppState.factors || (window.CarbonCalc ? window.CarbonCalc.factors : {});
    const elecFactor = factors.electricity?.grid_standard?.factor || 0.71;
    const lpgFactor = factors.gas?.lpg_kg?.factor || 2.98;
    const waterFactor = factors.water?.tap_water?.factor || 0.0003;
    const wasteFactor = factors.waste?.landfill_mixed?.factor || 0.58;

    // Config lookups
    const cfg = AppState.config || {};
    const cylinderKg = cfg.lpg?.cylinder_kg || 14.2;
    const shopSpendRate = cfg.shopping?.spend_kg_per_inr || 0.004;

    // Read LPG input label/unit
    const lpgGroup = document.getElementById('mq2');
    const lpgLabel = lpgGroup?.closest('.mq-group')?.querySelector('.mq-label')?.textContent || '';
    const isCylinders = lpgLabel.toLowerCase().includes('cylinder');

    const elecUnits = parseFloat(elec) || 0;
    const lpgUnits = parseFloat(lpg) || 0;
    const waterUnits = parseFloat(water) || 0;
    const shopSpend = parseFloat(shop) || 0;
    const wasteUnits = parseFloat(waste) || 0;

    const electricCO2 = parseFloat((elecUnits * elecFactor).toFixed(1));
    const lpgKg = isCylinders ? (lpgUnits * cylinderKg) : lpgUnits;
    const lpgCO2 = parseFloat((lpgKg * lpgFactor).toFixed(1));
    const waterCO2 = parseFloat((waterUnits * waterFactor).toFixed(2));
    const shopCO2 = parseFloat((shopSpend * shopSpendRate).toFixed(1));
    const wasteCO2 = parseFloat((wasteUnits * wasteFactor).toFixed(1));
    const monthlyTotal = parseFloat((electricCO2 + lpgCO2 + waterCO2 + shopCO2 + wasteCO2).toFixed(1));

    const monthData = { electricCO2, lpgCO2, waterCO2, shopCO2, wasteCO2, total: monthlyTotal, date: dateStr };
    Storage.setRaw(monthKey, dateStr);
    Storage.set(`${monthKey}_data`, monthData);

    // Save individual activities to backend / pending sync
    const monthlyItems = [
      { category: 'electricity', subType: 'grid_standard', amount: elecUnits, co2e: electricCO2, label: `Electricity: ${elecUnits} kWh` },
      { category: 'gas', subType: 'lpg_kg', amount: lpgKg, co2e: lpgCO2, label: `LPG: ${lpgUnits} ${isCylinders ? 'cylinders' : 'kg'}` },
      { category: 'water', subType: 'tap_water', amount: waterUnits, co2e: waterCO2, label: `Water: ${waterUnits} L` },
      { category: 'waste', subType: 'landfill_mixed', amount: wasteUnits, co2e: wasteCO2, label: `Waste: ${wasteUnits} kg` }
    ];

    for (const item of monthlyItems) {
      if (item.amount <= 0) continue;
      let savedRow = null;
      if (AppState.isOnline) {
        try {
          savedRow = await API.saveActivity({
            category: item.category,
            subType: item.subType,
            amount: item.amount,
            loggedAt: isoLoggedAt
          });
        } catch (err) {
          console.warn('Monthly activity POST failed:', err);
        }
      }

      AppState.activities.unshift({
        id: (savedRow && savedRow.id) ? savedRow.id : `local-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        date: todayStr,
        time: '12:00',
        loggedAt: (savedRow && savedRow.logged_at) ? savedRow.logged_at : isoLoggedAt,
        category: item.category,
        subType: item.subType,
        activityName: item.label,
        amount: item.amount,
        unit: item.category === 'electricity' ? 'kWh' : item.category === 'gas' ? 'kg' : item.category === 'water' ? 'liters' : 'kg',
        co2e: (savedRow && typeof savedRow.co2e === 'number') ? savedRow.co2e : item.co2e,
        pointsEarned: 15,
        subTypeLabel: item.label,
        syncPending: !savedRow
      });
    }

    AppState.userProfile.greenPoints += 50;
    Storage.set('ecotrack_user_profile', AppState.userProfile);
    Storage.set('ecotrack_activities', AppState.activities);
    renderUserProfile();

    initMonthlyLogger();
    showToast(`📅 Monthly report saved! ${monthlyTotal} kg CO₂ from utilities. +50 pts!`);

    if (AppState.isOnline) {
      await refreshSummaryAndCharts();
    } else {
      renderKPIs();
      renderActivityTable();
      renderTodayMiniList();
    }
  });
}
