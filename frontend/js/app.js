/**
 * EcoTrack AI: Main Application Controller
 * Manages state, UI events, dynamic rendering, and local persistence.
 */

document.addEventListener('DOMContentLoaded', () => {
  // Application State
  const AppState = {
    activeCategory: 'transport',
    timeRange: 7,
    history: [],
    activities: [],
    badges: [],
    challenges: [],
    userProfile: {},
    whatIfModifiers: {
      transportReduction: 0,
      electricityReduction: 0,
      dietReduction: 0
    }
  };

  // Initialize Data from LocalStorage or Mock Defaults
  function initData() {
    const savedHistory = localStorage.getItem('ecotrack_history');
    AppState.history = savedHistory ? JSON.parse(savedHistory) : [...MockData.history14Days];

    const savedActs = localStorage.getItem('ecotrack_activities');
    AppState.activities = savedActs ? JSON.parse(savedActs) : [...MockData.recentActivities];

    AppState.badges = [...MockData.badges];
    AppState.challenges = [...MockData.challenges];
    
    // User Profile with Pratik as default, saved in localStorage
    const savedProfile = localStorage.getItem('ecotrack_user_profile');
    if (savedProfile) {
      AppState.userProfile = JSON.parse(savedProfile);
    } else {
      AppState.userProfile = {
        name: 'Pratik',
        email: 'pratikgavkare28@gmail.com',
        college: 'VIT Pune',
        streakDays: 8,
        greenPoints: 460
      };
    }
  }

  // DOM Elements
  const DOM = {
    // Chrome-Style Circular Profile Header Elements
    btnProfileMenu: document.getElementById('btnProfileMenu'),
    headerAvatarCircle: document.getElementById('headerAvatarCircle'),
    profileDropdownCard: document.getElementById('profileDropdownCard'),
    profileLargeAvatar: document.getElementById('profileLargeAvatar'),
    profileCardName: document.getElementById('profileCardName'),
    profileCardEmail: document.getElementById('profileCardEmail'),
    profileStreakTag: document.getElementById('profileStreakTag'),
    profilePointsTag: document.getElementById('profilePointsTag'),
    btnProfileViva: document.getElementById('btnProfileViva'),
    btnEditProfile: document.getElementById('btnEditProfile'),
    btnOpenLoginModal: document.getElementById('btnOpenLoginModal'),
    btnSignOut: document.getElementById('btnSignOut'),
    itemProfilePersonal: document.getElementById('itemProfilePersonal'),
    itemProfileCollege: document.getElementById('itemProfileCollege'),
    switchProfileName1: document.getElementById('switchProfileName1'),
    loginModalOverlay: document.getElementById('loginModalOverlay'),
    btnCloseLogin: document.getElementById('btnCloseLogin'),
    loginForm: document.getElementById('loginForm'),
    modalAvatarPreview: document.getElementById('modalAvatarPreview'),
    inputProfileName: document.getElementById('inputProfileName'),
    inputProfileEmail: document.getElementById('inputProfileEmail'),
    inputProfileCollege: document.getElementById('inputProfileCollege'),

    // Global & Academic Viva
    apiStatusText: document.getElementById('apiStatusText'),
    statusDot: document.getElementById('statusDot'),
    btnCloseViva: document.getElementById('btnCloseViva'),
    vivaModalOverlay: document.getElementById('vivaModalOverlay'),

    // KPI Cards
    scoreCircle: document.getElementById('scoreCircle'),
    scoreDisplay: document.getElementById('scoreDisplay'),
    scoreRatingText: document.getElementById('scoreRatingText'),
    scoreBadgeText: document.getElementById('scoreBadgeText'),
    scoreSummaryDesc: document.getElementById('scoreSummaryDesc'),
    todayTotalValue: document.getElementById('todayTotalValue'),
    todayBenchmarkBadge: document.getElementById('todayBenchmarkBadge'),
    weeklyAvgValue: document.getElementById('weeklyAvgValue'),
    weeklyTrendBadge: document.getElementById('weeklyTrendBadge'),
    userPointsValue: document.getElementById('userPointsValue'),

    // Activity Logger
    categoryTabsNav: document.getElementById('categoryTabsNav'),
    loggerForm: document.getElementById('loggerForm'),
    subTypeSelect: document.getElementById('subTypeSelect'),
    amountInput: document.getElementById('amountInput'),
    amountLabel: document.getElementById('amountLabel'),
    unitLabel: document.getElementById('unitLabel'),
    factorNote: document.getElementById('factorNote'),
    formulaEquation: document.getElementById('formulaEquation'),
    formulaResult: document.getElementById('formulaResult'),

    // AI & Predictions
    aiBehaviorSummary: document.getElementById('aiBehaviorSummary'),
    aiRecommendationsGrid: document.getElementById('aiRecommendationsGrid'),
    sliderTransport: document.getElementById('sliderTransport'),
    sliderElectricity: document.getElementById('sliderElectricity'),
    sliderDiet: document.getElementById('sliderDiet'),
    valSliderTransport: document.getElementById('valSliderTransport'),
    valSliderElectricity: document.getElementById('valSliderElectricity'),
    valSliderDiet: document.getElementById('valSliderDiet'),
    projectedSavingsDisplay: document.getElementById('projectedSavingsDisplay'),

    // Gamification & Logs
    badgesContainer: document.getElementById('badgesContainer'),
    challengesContainer: document.getElementById('challengesContainer'),
    activityTableBody: document.getElementById('activityTableBody'),
    toastContainer: document.getElementById('toastContainer'),

    // Apple Tab Navigation Elements
    mainTabNav: document.getElementById('mainTabNav'),
    tabDashboard: document.getElementById('tabDashboard'),
    tabLogger: document.getElementById('tabLogger'),
    tabAiSimulator: document.getElementById('tabAiSimulator'),
    tabHistory: document.getElementById('tabHistory'),
    btnQuickLogTab: document.getElementById('btnQuickLogTab'),
    btnViewFullHistory: document.getElementById('btnViewFullHistory'),
    todayLogsMiniList: document.getElementById('todayLogsMiniList')
  };

  // ============================================================
  //  MCQ QUICK LOGGER STATE
  // ============================================================
  const QL = {
    step: 1,
    transport: { val: null, factor: 0, label: '' },
    distance: { km: 0, label: '' },
    returnMultiplier: { val: 1, label: '' },
    food: { co2: 0, label: '' },
    totalTransportCO2: 0,
    totalFoodCO2: 0,
    grandTotal: 0
  };

  // ── Step navigation helper ──
  function qlGoToStep(n) {
    // Hide all steps
    document.querySelectorAll('.ql-step').forEach(s => s.classList.remove('active'));
    // Show target
    const stepEl = document.getElementById(`qlStep${n}`);
    if (stepEl) stepEl.classList.add('active');
    // Handle receipt step
    if (n === 5) {
      document.getElementById('qlReceipt').classList.add('active');
    }
    // Update progress circles
    document.querySelectorAll('.ql-progress-step').forEach(dot => {
      const s = parseInt(dot.dataset.step);
      dot.classList.remove('active', 'done');
      if (s < n) dot.classList.add('done');
      else if (s === n) dot.classList.add('active');
    });
    // Update progress lines
    ['pLine1','pLine2','pLine3'].forEach((id, idx) => {
      const line = document.getElementById(id);
      if (line) line.classList.toggle('done', idx + 1 < n);
    });
    QL.step = n;
  }

  // ── Carbon Receipt builder ──
  function qlBuildReceipt() {
    // Transport CO2
    const rawKm = QL.distance.km * QL.returnMultiplier.val;
    QL.totalTransportCO2 = parseFloat((rawKm * QL.transport.factor).toFixed(2));
    QL.totalFoodCO2 = parseFloat(QL.food.co2.toFixed(2));
    QL.grandTotal = parseFloat((QL.totalTransportCO2 + QL.totalFoodCO2).toFixed(2));

    // Date
    const now = new Date();
    document.getElementById('receiptDate').textContent =
      now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });

    // Line items
    const items = document.getElementById('receiptItems');
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

    // Total
    document.getElementById('receiptTotal').textContent = `${QL.grandTotal} kg CO₂`;

    // Comparisons
    const cmpContainer = document.getElementById('receiptComparisons');
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

  // ── Save MCQ log to history ──
  function qlSaveToHistory() {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const timeStr = now.toTimeString().substring(0, 5);

    // Add transport activity
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

    // Add food activity
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

    // Update today's history entry
    const lastEntry = AppState.history[AppState.history.length - 1];
    if (lastEntry) {
      lastEntry.total = parseFloat((lastEntry.total + QL.grandTotal).toFixed(2));
      lastEntry.transport = parseFloat(((lastEntry.transport || 0) + QL.totalTransportCO2).toFixed(2));
      lastEntry.food = parseFloat(((lastEntry.food || 0) + QL.totalFoodCO2).toFixed(2));
    }

    // Points
    AppState.userProfile.greenPoints += 20;
    AppState.userProfile.streakDays = (AppState.userProfile.streakDays || 0) + 1;
    localStorage.setItem('ecotrack_user_profile', JSON.stringify(AppState.userProfile));
    localStorage.setItem('ecotrack_history', JSON.stringify(AppState.history));
    localStorage.setItem('ecotrack_activities', JSON.stringify(AppState.activities));

    // Mark today as logged
    const todayLogKey = `ql_logged_${todayStr}`;
    localStorage.setItem(todayLogKey, '1');

    renderUserProfile();
    renderKPIs();
    renderActivityTable();
    renderTodayMiniList();
    renderAIRecommendations();
    if (window.CarbonCharts) {
      CarbonCharts.renderCategoryDonut(AppState.history);
      CarbonCharts.renderTrendChart(AppState.history, AppState.timeRange);
    }

    // Update streak chip
    const streakNum = document.getElementById('loggerStreakNum');
    if (streakNum) streakNum.textContent = AppState.userProfile.streakDays || 0;

    showToast(`✅ Logged! +20 pts · ${QL.grandTotal} kg CO₂ today`);
  }

  // ── Monthly Logger: check date window ──
  function initMonthlyLogger() {
    const today = new Date();
    const day = today.getDate();
    const monthKey = `monthly_${today.getFullYear()}_${today.getMonth() + 1}`;
    const alreadyLogged = localStorage.getItem(monthKey);
    const isOpen = day >= 1 && day <= 5;

    const badge = document.getElementById('monthlyAccessBadge');
    const lockedDiv = document.getElementById('monthlyLockedState');
    const unlockedDiv = document.getElementById('monthlyUnlockedState');
    const lockSub = document.getElementById('monthlyLockSub');
    const lastLogged = document.getElementById('monthlyLastLogged');

    if (alreadyLogged) {
      // Already logged this month
      if (badge) { badge.textContent = '✅ Done'; badge.classList.add('open'); }
      if (lockedDiv) lockedDiv.classList.remove('hidden');
      if (unlockedDiv) unlockedDiv.classList.add('hidden');
      if (lockSub) lockSub.textContent = 'Already logged for this month ✓';
      if (lastLogged) lastLogged.textContent = `Logged on: ${alreadyLogged}`;
    } else if (isOpen) {
      // Window open
      if (badge) { badge.textContent = '🔓 Open Now!'; badge.classList.add('open'); }
      if (lockedDiv) lockedDiv.classList.add('hidden');
      if (unlockedDiv) unlockedDiv.classList.remove('hidden');
    } else {
      // Locked
      const nextFirst = new Date(today.getFullYear(), today.getMonth() + (day > 5 ? 1 : 0), 1);
      const daysLeft = Math.ceil((nextFirst - today) / (1000 * 60 * 60 * 24));
      if (badge) badge.textContent = '🔒 Locked';
      if (lockSub) lockSub.textContent = `Opens in ${daysLeft} day${daysLeft !== 1 ? 's' : ''} · Available 1st–5th`;
      if (lockedDiv) lockedDiv.classList.remove('hidden');
      if (unlockedDiv) unlockedDiv.classList.add('hidden');
    }
  }

  // ── Setup MCQ Logger Event Listeners ──
  function setupQLListeners() {
    // ── STEP 1: Transport Mode ──
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

        // If walked/cycled, skip distance & return → show distance anyway but hint it
        const distHint = document.getElementById('qlDistanceHint');
        if (distHint) {
          distHint.textContent = QL.transport.factor === 0
            ? '(Walked/cycled — still log distance for health tracking)'
            : 'Select the distance range for your trip';
        }
      });
    });

    // Custom transport km input
    const btnShowTCust = document.getElementById('btnShowTransportCustom');
    if (btnShowTCust) {
      btnShowTCust.addEventListener('click', () => {
        const wrap = document.getElementById('transportCustomWrap');
        if (wrap) wrap.classList.toggle('hidden');
      });
    }

    document.getElementById('qlNext1')?.addEventListener('click', () => qlGoToStep(2));

    // ── STEP 2: Distance ──
    document.querySelectorAll('#distanceGrid .distance-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#distanceGrid .distance-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        QL.distance = { km: parseFloat(btn.dataset.km), label: btn.dataset.label };
        const next2 = document.getElementById('qlNext2');
        if (next2) next2.disabled = false;
      });
    });

    // Custom distance input
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

    // ── STEP 3: Return Trip ──
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

    // ── STEP 4: Food ──
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

    // ── Receipt Actions ──
    document.getElementById('qlLogAgain')?.addEventListener('click', () => {
      // Reset state
      Object.assign(QL, { step: 1, transport: { val: null, factor: 0, label: '' }, distance: { km: 0, label: '' }, returnMultiplier: { val: 1, label: '' }, food: { co2: 0, label: '' } });
      document.querySelectorAll('.ql-mcq-btn').forEach(b => b.classList.remove('selected'));
      const n1 = document.getElementById('qlNext1'); if (n1) n1.disabled = true;
      const s = document.getElementById('qlSubmit'); if (s) s.disabled = true;
      qlGoToStep(1);
    });

    document.getElementById('qlSaveToHistory')?.addEventListener('click', () => {
      qlSaveToHistory();
      showToast('📊 Logged to your history & dashboard!');
      // Go back to fresh logger
      setTimeout(() => {
        document.querySelectorAll('.ql-mcq-btn').forEach(b => b.classList.remove('selected'));
        const n1 = document.getElementById('qlNext1'); if (n1) n1.disabled = true;
        const s = document.getElementById('qlSubmit'); if (s) s.disabled = true;
        qlGoToStep(1);
      }, 1200);
    });

    // ── Monthly Logger MCQ buttons ──
    ['mq1','mq2','mq3','mq4','mq5'].forEach(groupId => {
      const group = document.getElementById(groupId);
      if (!group) return;
      group.querySelectorAll('.mq-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          group.querySelectorAll('.mq-btn').forEach(b => b.classList.remove('selected'));
          btn.classList.add('selected');
        });
      });
    });

    // ── Monthly Submit ──
    document.getElementById('btnMonthlySubmit')?.addEventListener('click', () => {
      const today = new Date();
      const monthKey = `monthly_${today.getFullYear()}_${today.getMonth() + 1}`;
      const dateStr = today.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

      // Gather selections
      const elec = document.querySelector('#mq1 .mq-btn.selected')?.dataset.val
        || document.getElementById('mqElecUnits')?.value || '300';
      const lpg = document.querySelector('#mq2 .mq-btn.selected')?.dataset.val || '1';
      const water = document.querySelector('#mq3 .mq-btn.selected')?.dataset.val || '6000';
      const shop = document.querySelector('#mq4 .mq-btn.selected')?.dataset.val || '2000';
      const waste = document.querySelector('#mq5 .mq-btn.selected')?.dataset.val || '25';

      // Simple CO2 estimates
      const electricCO2 = parseFloat((parseFloat(elec) * 0.71).toFixed(1));
      const lpgCO2 = parseFloat((parseFloat(lpg) * 14.2).toFixed(1));
      const waterCO2 = parseFloat((parseFloat(water) * 0.000298).toFixed(2));
      const shopCO2 = parseFloat((parseFloat(shop) * 0.004).toFixed(1));
      const wasteCO2 = parseFloat((parseFloat(waste) * 0.5).toFixed(1));
      const monthlyTotal = parseFloat((electricCO2 + lpgCO2 + waterCO2 + shopCO2 + wasteCO2).toFixed(1));

      const monthData = { electricCO2, lpgCO2, waterCO2, shopCO2, wasteCO2, total: monthlyTotal, date: dateStr };
      localStorage.setItem(monthKey, dateStr);
      localStorage.setItem(`${monthKey}_data`, JSON.stringify(monthData));

      AppState.userProfile.greenPoints += 50;
      localStorage.setItem('ecotrack_user_profile', JSON.stringify(AppState.userProfile));
      renderUserProfile();

      initMonthlyLogger(); // Refresh lock state
      showToast(`📅 Monthly report saved! ${monthlyTotal} kg CO₂ from utilities. +50 pts!`);
    });
  }

  /**
   * Populate Activity Type Dropdown for selected Category (old form — guarded)
   */
  function populateCategoryOptions(categoryKey) {
    if (!DOM.subTypeSelect) return; // old form removed

    const catData = CarbonCalc.factors[categoryKey];
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

  /**
   * Update Input labels & unit suffix based on active selection
   */
  function updateInputUnit() {
    if (!DOM.subTypeSelect) return;
    const cat = AppState.activeCategory;
    const subType = DOM.subTypeSelect.value;
    const item = CarbonCalc.factors[cat]?.[subType];

    if (item) {
      if (DOM.unitLabel) DOM.unitLabel.textContent = item.unit;
      if (DOM.factorNote) DOM.factorNote.textContent = item.note;
      if (DOM.amountLabel) DOM.amountLabel.textContent = `Amount in ${item.unit}`;
    }
  }

  /**
   * Live preview of Slide 10 formula: Emission = Amount * Factor
   */
  function updateFormulaPreview() {
    if (!DOM.subTypeSelect || !DOM.amountInput) return;
    const cat = AppState.activeCategory;
    const subType = DOM.subTypeSelect.value;
    const amt = parseFloat(DOM.amountInput.value) || 0;
    const calc = CarbonCalc.calculateItem(cat, subType, amt);

    if (DOM.formulaEquation) DOM.formulaEquation.textContent = `${calc.amount} ${calc.unit} × ${calc.factor} kg CO₂e/${calc.unit}`;
    if (DOM.formulaResult) DOM.formulaResult.textContent = `${calc.co2e.toFixed(2)} kg CO₂e`;
  }


  /**
   * Refresh KPI Cards and Green Score
   */
  function renderKPIs() {
    const analysis = AIEngine.analyzeBehavior(AppState.history);
    if (!analysis) return;

    // Today's entry (last day of history)
    const today = AppState.history[AppState.history.length - 1];
    const todayTotal = today ? today.total : 0;
    DOM.todayTotalValue.textContent = todayTotal.toFixed(1);

    const nationalAvg = MockData.benchmarks.nationalAverage;
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
    const greenScore = AIEngine.calculateGreenScore(analysis.dailyAvg);
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
   * Render Sidebar-Panel Profile Card Information (new pdc-* design)
   */
  function renderUserProfile() {
    const p = AppState.userProfile;
    const initial = (p.name || 'P').trim().charAt(0).toUpperCase();

    // Avatar initial letter
    if (DOM.headerAvatarCircle) DOM.headerAvatarCircle.textContent = initial;
    if (DOM.profileLargeAvatar) DOM.profileLargeAvatar.textContent = initial;
    if (DOM.modalAvatarPreview) DOM.modalAvatarPreview.textContent = initial;

    // Username (bold white heading)
    if (DOM.profileCardName) DOM.profileCardName.textContent = p.name || 'Pratik';

    // Amber tagline (reuses profileCardEmail id) — show role + level, not raw email
    if (DOM.profileCardEmail) {
      const college = p.college || 'VIT Pune';
      DOM.profileCardEmail.textContent = `🌱 Eco Scholar • ${college}`;
    }

    // Personal profile check-mark text
    if (DOM.switchProfileName1) DOM.switchProfileName1.textContent = '✓';

    // Streak & Points badges
    if (DOM.profileStreakTag) DOM.profileStreakTag.textContent = `🔥 ${p.streakDays || 0} Day Streak`;
    if (DOM.profilePointsTag) DOM.profilePointsTag.textContent = `⭐ ${p.greenPoints || 0} Pts`;

    // Dashboard KPI Points counter
    if (DOM.userPointsValue) DOM.userPointsValue.textContent = p.greenPoints || 0;
  }


  /**
   * Render AI Recommendations Cards (Slide 2, 4, 7)
   */
  function renderAIRecommendations() {
    const analysis = AIEngine.analyzeBehavior(AppState.history);
    const recs = AIEngine.generateRecommendations(analysis);

    const dominantCatMeta = CarbonCalc.categoriesMeta[analysis.dominantCategory];
    DOM.aiBehaviorSummary.textContent = `Behavior Insight: Dominant source is ${dominantCatMeta ? dominantCatMeta.name : 'Transportation'} (${analysis.dominantCategoryPercentage}%). Weekly footprint is ${analysis.isImproving ? 'improving' : 'steady'}.`;

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
        DOM.userPointsValue.textContent = AppState.userProfile.greenPoints;

        // Automatically boost simulator sliders slightly to show dynamic impact!
        AppState.whatIfModifiers.transportReduction = Math.min(100, AppState.whatIfModifiers.transportReduction + 15);
        DOM.sliderTransport.value = AppState.whatIfModifiers.transportReduction;
        DOM.valSliderTransport.textContent = `${AppState.whatIfModifiers.transportReduction}%`;
        updateFuturePredictions();

        showToast('🌱 Habit Adopted! Earned 30 Green Points & updated future trajectory.');
      });
    });
  }

  /**
   * Render Gamification Badges (Slide 2, 8)
   */
  function renderBadges() {
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
   * Render Active Challenges (Slide 2, 8)
   */
  function renderChallenges() {
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
  function renderActivityTable() {
    DOM.activityTableBody.innerHTML = '';
    AppState.activities.slice(0, 8).forEach(act => {
      const tr = document.createElement('tr');
      const catMeta = CarbonCalc.categoriesMeta[act.category] || { name: act.category, icon: '•' };
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
   * Update Machine Learning Future Predictions (Slide 2, 4, 7)
   */
  function updateFuturePredictions() {
    const pred = AIEngine.predictFutureEmissions(AppState.history, AppState.whatIfModifiers);
    DOM.projectedSavingsDisplay.textContent = `${pred.projectedSavingsKg} kg`;
    CarbonCharts.updatePrediction(pred);
  }

  /**
   * Toast notification helper
   */
  function showToast(msg) {
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
   * Apple-Style Tab Switcher (Solves the Visually Vast Problem)
   */
  function switchTab(tabKey) {
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

    // 2. Hide all tabs, show the active one with smooth fade
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
   * Render Today's Mini Activities List in the Logger Tab
   */
  function renderTodayMiniList() {
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
      const catMeta = CarbonCalc.categoriesMeta[act.category] || { icon: '🌿', color: '#10b981' };
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
   * Event Listeners Setup
   */
  function setupEventListeners() {
    // 1. Category Nav Tabs (old form — guarded, elements removed in new logger)
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

    // 2. Old form inputs — guarded
    if (DOM.subTypeSelect) {
      DOM.subTypeSelect.addEventListener('change', () => {
        updateInputUnit();
        updateFormulaPreview();
      });
    }

    if (DOM.amountInput) {
      DOM.amountInput.addEventListener('input', updateFormulaPreview);
    }

    // 3. Old form submission — guarded
    if (DOM.loggerForm) {
      DOM.loggerForm.addEventListener('submit', (e) => {
        e.preventDefault();

        const cat = AppState.activeCategory;
        const subType = DOM.subTypeSelect.value;
        const amt = parseFloat(DOM.amountInput.value);

        if (!amt || amt <= 0) {
          showToast('Please enter a valid amount greater than 0');
          return;
        }

        const calc = CarbonCalc.calculateItem(cat, subType, amt);
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

        localStorage.setItem('ecotrack_history', JSON.stringify(AppState.history));
        localStorage.setItem('ecotrack_activities', JSON.stringify(AppState.activities));

        DOM.amountInput.value = '';
        updateFormulaPreview();

        renderKPIs();
        renderActivityTable();
        renderTodayMiniList();
        renderChallenges();
        renderAIRecommendations();

        CarbonCharts.renderCategoryDonut(AppState.history);
        CarbonCharts.renderTrendChart(AppState.history, AppState.timeRange);
        updateFuturePredictions();

        showToast(`Logged: ${calc.label} (+${calc.co2e} kg CO₂e). +15 Green Points!`);
      });
    }


    // 4. Time Range Toggle (7D / 14D)
    document.querySelectorAll('.btn-range-toggle').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.btn-range-toggle').forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        AppState.timeRange = parseInt(e.currentTarget.dataset.range, 10);
        CarbonCharts.renderTrendChart(AppState.history, AppState.timeRange);
      });
    });

    // 5. What-If Simulator Sliders (Slide 2, 4, 7)
    DOM.sliderTransport.addEventListener('input', (e) => {
      AppState.whatIfModifiers.transportReduction = parseInt(e.target.value, 10);
      DOM.valSliderTransport.textContent = `${AppState.whatIfModifiers.transportReduction}%`;
      updateFuturePredictions();
    });

    DOM.sliderElectricity.addEventListener('input', (e) => {
      AppState.whatIfModifiers.electricityReduction = parseInt(e.target.value, 10);
      DOM.valSliderElectricity.textContent = `${AppState.whatIfModifiers.electricityReduction}%`;
      updateFuturePredictions();
    });

    DOM.sliderDiet.addEventListener('input', (e) => {
      AppState.whatIfModifiers.dietReduction = parseInt(e.target.value, 10);
      DOM.valSliderDiet.textContent = `${AppState.whatIfModifiers.dietReduction}%`;
      updateFuturePredictions();
    });

    // 6. Apple Segmented Navigation Bar Handlers
    if (DOM.mainTabNav) {
      DOM.mainTabNav.addEventListener('click', (e) => {
        const btn = e.target.closest('.nav-segment-btn');
        if (btn && btn.dataset.tab) {
          switchTab(btn.dataset.tab);
        }
      });
    }

    if (DOM.btnQuickLogTab) {
      DOM.btnQuickLogTab.addEventListener('click', () => {
        switchTab('logger');
      });
    }

    if (DOM.btnViewFullHistory) {
      DOM.btnViewFullHistory.addEventListener('click', () => {
        switchTab('history');
      });
    }

    // 7. Sidebar Profile Panel — Open/Close Toggle
    if (DOM.btnProfileMenu) {
      DOM.btnProfileMenu.addEventListener('click', (e) => {
        e.stopPropagation();
        DOM.profileDropdownCard.classList.toggle('active');
      });
    }

    // Close profile dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (DOM.profileDropdownCard && DOM.profileDropdownCard.classList.contains('active')) {
        if (!DOM.profileDropdownCard.contains(e.target) && !DOM.btnProfileMenu.contains(e.target)) {
          DOM.profileDropdownCard.classList.remove('active');
        }
      }
    });

    // Icon Grid: Navigate to tab and close panel
    document.querySelectorAll('.pdc-icon-box').forEach(box => {
      box.addEventListener('click', () => {
        const tab = box.dataset.tabTarget;
        if (tab) {
          DOM.profileDropdownCard.classList.remove('active');
          switchTab(tab);
        }
      });
    });

    // Open Viva Guide Modal from Profile Menu
    if (DOM.btnProfileViva) {
      DOM.btnProfileViva.addEventListener('click', () => {
        DOM.profileDropdownCard.classList.remove('active');
        DOM.vivaModalOverlay.classList.add('active');
      });
    }

    // Open Login / Customise Profile Modal
    if (DOM.btnEditProfile) {
      DOM.btnEditProfile.addEventListener('click', () => {
        DOM.profileDropdownCard.classList.remove('active');
        DOM.inputProfileName.value = AppState.userProfile.name;
        DOM.inputProfileEmail.value = AppState.userProfile.email;
        DOM.inputProfileCollege.value = AppState.userProfile.college || '';
        DOM.loginModalOverlay.classList.add('active');
      });
    }

    if (DOM.btnOpenLoginModal) {
      DOM.btnOpenLoginModal.addEventListener('click', () => {
        DOM.profileDropdownCard.classList.remove('active');
        DOM.inputProfileName.value = '';
        DOM.inputProfileEmail.value = '';
        DOM.inputProfileCollege.value = '';
        DOM.loginModalOverlay.classList.add('active');
      });
    }

    if (DOM.btnCloseLogin) {
      DOM.btnCloseLogin.addEventListener('click', () => {
        DOM.loginModalOverlay.classList.remove('active');
      });
    }

    if (DOM.loginModalOverlay) {
      DOM.loginModalOverlay.addEventListener('click', (e) => {
        if (e.target === DOM.loginModalOverlay) {
          DOM.loginModalOverlay.classList.remove('active');
        }
      });
    }

    // Dynamic initial update in modal avatar circle
    if (DOM.inputProfileName) {
      DOM.inputProfileName.addEventListener('input', (e) => {
        const val = e.target.value.trim();
        DOM.modalAvatarPreview.textContent = val ? val.charAt(0).toUpperCase() : 'P';
      });
    }

    // Save Profile / Sign In Submission
    if (DOM.loginForm) {
      DOM.loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        AppState.userProfile.name = DOM.inputProfileName.value.trim();
        AppState.userProfile.email = DOM.inputProfileEmail.value.trim();
        AppState.userProfile.college = DOM.inputProfileCollege.value.trim();
        localStorage.setItem('ecotrack_user_profile', JSON.stringify(AppState.userProfile));

        renderUserProfile();
        DOM.loginModalOverlay.classList.remove('active');
        showToast(`👤 Signed in as ${AppState.userProfile.name}!`);
      });
    }

    // Switch between Personal & College Profiles
    if (DOM.itemProfileCollege) {
      DOM.itemProfileCollege.addEventListener('click', () => {
        AppState.userProfile.name = 'PRATIK';
        AppState.userProfile.email = 'pratik@vit.edu';
        AppState.userProfile.college = 'VIT Pune';
        AppState.userProfile.streakDays = 0;
        localStorage.setItem('ecotrack_user_profile', JSON.stringify(AppState.userProfile));
        renderUserProfile();
        // Show checkmark on College item, hide from Personal
        if (DOM.switchProfileName1) DOM.switchProfileName1.style.display = 'none';
        const collegeCheck = DOM.itemProfileCollege.querySelector('.pdc-menu-arrow');
        if (collegeCheck) { collegeCheck.textContent = '✓'; collegeCheck.style.color = 'var(--accent-mint)'; }
        DOM.profileDropdownCard.classList.remove('active');
        showToast('🎓 Switched to PRATIK (vit.edu) College Profile!');
      });
    }

    if (DOM.itemProfilePersonal) {
      DOM.itemProfilePersonal.addEventListener('click', () => {
        AppState.userProfile.name = 'Pratik';
        AppState.userProfile.email = 'pratikgavkare28@gmail.com';
        AppState.userProfile.college = 'VIT Pune';
        AppState.userProfile.streakDays = 8;
        localStorage.setItem('ecotrack_user_profile', JSON.stringify(AppState.userProfile));
        renderUserProfile();
        // Show checkmark on Personal item, reset College item arrow
        if (DOM.switchProfileName1) DOM.switchProfileName1.style.display = '';
        const collegeCheck = DOM.itemProfileCollege ? DOM.itemProfileCollege.querySelector('.pdc-menu-arrow') : null;
        if (collegeCheck) { collegeCheck.textContent = '›'; collegeCheck.style.color = ''; }
        DOM.profileDropdownCard.classList.remove('active');
        showToast('👤 Switched to Pratik (Personal) Profile!');
      });
    }


    // Sign out to Guest Mode
    if (DOM.btnSignOut) {
      DOM.btnSignOut.addEventListener('click', () => {
        AppState.userProfile.name = 'Guest Student';
        AppState.userProfile.email = 'guest@ecotrack.local';
        AppState.userProfile.college = 'Guest Campus';
        renderUserProfile();
        DOM.profileDropdownCard.classList.remove('active');
        showToast('🚪 Logged out to Guest Student Profile.');
      });
    }

    // 8. Academic Viva Guide Modal Handlers
    DOM.btnCloseViva.addEventListener('click', () => {
      DOM.vivaModalOverlay.classList.remove('active');
    });

    DOM.vivaModalOverlay.addEventListener('click', (e) => {
      if (e.target === DOM.vivaModalOverlay) {
        DOM.vivaModalOverlay.classList.remove('active');
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (DOM.vivaModalOverlay.classList.contains('active')) DOM.vivaModalOverlay.classList.remove('active');
        if (DOM.loginModalOverlay.classList.contains('active')) DOM.loginModalOverlay.classList.remove('active');
        if (DOM.profileDropdownCard && DOM.profileDropdownCard.classList.contains('active')) DOM.profileDropdownCard.classList.remove('active');
      }
    });
  }

  /**
   * Check backend connection status
   */
  async function checkBackend() {
    const status = await AIEngine.testBackendConnection();
    DOM.apiStatusText.textContent = status.message;
    if (status.connected) {
      DOM.statusDot.style.background = '#10b981';
      DOM.statusDot.style.boxShadow = '0 0 8px #10b981';
    } else {
      DOM.statusDot.style.background = '#f59e0b';
      DOM.statusDot.style.boxShadow = '0 0 8px #f59e0b';
    }
  }

  /**
   * App Initialization Entry Point
   */
  function init() {
    initData();
    populateCategoryOptions(AppState.activeCategory);
    setupEventListeners();
    setupQLListeners();       // MCQ Quick Logger
    initMonthlyLogger();      // Monthly Logger lock/unlock

    renderUserProfile();
    renderKPIs();
    renderAIRecommendations();
    renderBadges();
    renderChallenges();
    renderActivityTable();
    renderTodayMiniList();

    // Streak chip
    const streakNum = document.getElementById('loggerStreakNum');
    if (streakNum) streakNum.textContent = AppState.userProfile.streakDays || 0;

    // Initial Future Prediction Data
    const initialPred = AIEngine.predictFutureEmissions(AppState.history, AppState.whatIfModifiers);
    DOM.projectedSavingsDisplay.textContent = `${initialPred.projectedSavingsKg} kg`;

    // Initialize Chart.js
    CarbonCharts.init(AppState.history, initialPred);

    // Test backend connection in background
    checkBackend();
  }

  // Run app
  init();
});
