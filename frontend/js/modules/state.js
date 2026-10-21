/**
 * Application State Module (state.js)
 * Manages global application state, DOM references, and initial data hydration.
 */

import { Storage } from './storage.js';

export const AppState = {
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
  },
  factors: null,
  config: null,
  isOnline: false,
  isSampleData: false
};

export const QL = {
  step: 1,
  transport: { key: null, val: null, factor: 0, label: '' },
  distance: { km: 0, label: '' },
  returnMultiplier: { val: 1, label: '' },
  food: { key: null, val: null, co2: 0, label: '' },
  totalTransportCO2: 0,
  totalFoodCO2: 0,
  grandTotal: 0
};

export const DOM = {};

export function initDOM() {
  const elements = {
    // Profile Elements
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

    // Global & Academic Viva & Status Badges
    headerStatusBadge: document.getElementById('headerStatusBadge'),
    headerStatusDot: document.getElementById('headerStatusDot'),
    headerStatusText: document.getElementById('headerStatusText'),
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

    // Trend & AI & Predictions
    trendChartSubtitle: document.getElementById('trendChartSubtitle'),
    predictionModelBadge: document.getElementById('predictionModelBadge'),
    predictionModelSubtitle: document.getElementById('predictionModelSubtitle'),
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

  Object.assign(DOM, elements);
}

export function initData() {
  const mock = window.MockData || { history14Days: [], recentActivities: [], badges: [], challenges: [] };

  AppState.history = Storage.get('ecotrack_history', [...mock.history14Days]);
  AppState.activities = Storage.get('ecotrack_activities', [...mock.recentActivities]);
  AppState.badges = [...mock.badges];
  AppState.challenges = [...mock.challenges];

  const defaultProfile = {
    name: 'Pratik',
    email: 'pratikgavkare28@gmail.com',
    college: 'VIT Pune',
    streakDays: 8,
    greenPoints: 460
  };

  AppState.userProfile = Storage.get('ecotrack_user_profile', defaultProfile);
}
