/**
 * Mock Data & Initial State for 2nd Year Project Viva Demonstration
 * Provides 14 days of realistic activity logs, challenges, badges, and benchmarks.
 */

const MockData = {
  userProfile: {
    name: 'Aarav Sharma',
    role: 'Student / Eco Pioneer',
    institution: 'Dept. of Computer Science & Engineering',
    avatar: '👨‍💻',
    joinedDate: '2026-08-15',
    streakDays: 8,
    greenPoints: 460
  },

  // Global and national reference standards (kg CO2e per person per day)
  benchmarks: {
    globalParisTarget: 4.1,   // Target for 1.5°C Paris Agreement limit
    nationalAverage: 9.8,     // Slide 10: 9.7 - 9.8 kg CO2e daily average
    highEmitterThreshold: 14.5
  },

  // Pre-populated 14 days of historical logs
  history14Days: [
    { date: '2026-09-10', total: 11.4, transport: 4.8, electricity: 3.5, food: 1.8, water: 0.3, waste: 0.4, shopping: 0.0, gas: 0.6 },
    { date: '2026-09-11', total: 10.2, transport: 3.8, electricity: 3.2, food: 1.9, water: 0.2, waste: 0.3, shopping: 0.0, gas: 0.8 },
    { date: '2026-09-12', total: 12.1, transport: 5.2, electricity: 3.9, food: 2.1, water: 0.3, waste: 0.6, shopping: 0.0, gas: 0.0 },
    { date: '2026-09-13', total: 8.9,  transport: 2.1, electricity: 3.6, food: 1.7, water: 0.2, waste: 0.5, shopping: 0.0, gas: 0.8 },
    { date: '2026-09-14', total: 9.5,  transport: 2.9, electricity: 3.8, food: 1.9, water: 0.2, waste: 0.7, shopping: 0.0, gas: 0.0 },
    { date: '2026-09-15', total: 10.8, transport: 4.6, electricity: 3.4, food: 1.8, water: 0.2, waste: 0.2, shopping: 0.0, gas: 0.6 },
    { date: '2026-09-16', total: 9.7,  transport: 2.4, electricity: 3.5, food: 2.0, water: 0.3, waste: 0.5, shopping: 0.0, gas: 1.0 }, // Slide 10 exact example
    { date: '2026-09-17', total: 8.6,  transport: 1.8, electricity: 3.2, food: 1.9, water: 0.2, waste: 0.4, shopping: 0.5, gas: 0.6 },
    { date: '2026-09-18', total: 7.9,  transport: 1.2, electricity: 3.0, food: 1.8, water: 0.3, waste: 0.5, shopping: 0.0, gas: 1.1 },
    { date: '2026-09-19', total: 8.2,  transport: 1.5, electricity: 3.1, food: 1.9, water: 0.2, waste: 0.6, shopping: 0.0, gas: 0.9 },
    { date: '2026-09-20', total: 7.4,  transport: 0.9, electricity: 2.9, food: 1.8, water: 0.2, waste: 0.4, shopping: 0.0, gas: 1.2 },
    { date: '2026-09-21', total: 6.8,  transport: 0.4, electricity: 2.8, food: 1.9, water: 0.2, waste: 0.3, shopping: 0.0, gas: 1.2 },
    { date: '2026-09-22', total: 6.2,  transport: 0.4, electricity: 2.6, food: 1.7, water: 0.2, waste: 0.3, shopping: 0.0, gas: 1.0 },
    { date: '2026-09-23', total: 5.8,  transport: 0.4, electricity: 2.4, food: 1.6, water: 0.2, waste: 0.2, shopping: 0.0, gas: 1.0 }  // Today
  ],

  // Recent logged activities
  recentActivities: [
    {
      id: 'act-101',
      date: '2026-09-23',
      time: '18:30',
      category: 'transport',
      subType: 'metro_train',
      activityName: 'Metro Transit to Campus',
      amount: 14,
      unit: 'km',
      co2e: 0.49,
      pointsEarned: 15
    },
    {
      id: 'act-102',
      date: '2026-09-23',
      time: '14:15',
      category: 'food',
      subType: 'meal_vegetarian',
      activityName: 'Plant-Based Thali Lunch',
      amount: 1,
      unit: 'meal',
      co2e: 0.90,
      pointsEarned: 20
    },
    {
      id: 'act-103',
      date: '2026-09-23',
      time: '10:00',
      category: 'electricity',
      subType: 'grid_standard',
      activityName: 'Hostel Study & Fan Usage',
      amount: 3.4,
      unit: 'kWh',
      co2e: 2.41,
      pointsEarned: 10
    },
    {
      id: 'act-104',
      date: '2026-09-22',
      time: '20:10',
      category: 'gas',
      subType: 'lpg_hour_cooking',
      activityName: 'Cooking Dinner with Roommates',
      amount: 1.5,
      unit: 'hours',
      co2e: 0.98,
      pointsEarned: 5
    },
    {
      id: 'act-105',
      date: '2026-09-22',
      time: '11:00',
      category: 'waste',
      subType: 'recycled_plastic_paper',
      activityName: 'Recycled Lab Worksheets & Bottles',
      amount: 2.0,
      unit: 'kg',
      co2e: -0.30,
      pointsEarned: 30
    }
  ],

  // Gamification: Badges
  badges: [
    {
      id: 'badge-1',
      title: 'Green Commuter',
      icon: '🚇',
      description: 'Used public transit or bicycle for 5 days in a row',
      status: 'unlocked',
      dateEarned: '2026-09-18',
      category: 'transport'
    },
    {
      id: 'badge-2',
      title: 'Energy Guardian',
      icon: '⚡',
      description: 'Kept daily electricity use below 3.0 kWh for 3 days',
      status: 'unlocked',
      dateEarned: '2026-09-21',
      category: 'electricity'
    },
    {
      id: 'badge-3',
      title: 'Zero Waste Warrior',
      icon: '♻️',
      description: 'Logged recycling credits exceeding 5 kg',
      status: 'unlocked',
      dateEarned: '2026-09-22',
      category: 'waste'
    },
    {
      id: 'badge-4',
      title: 'Plant Pioneer',
      icon: '🌱',
      description: 'Adopted 10 consecutive meat-free meals',
      status: 'in_progress',
      progress: 70,
      category: 'food'
    },
    {
      id: 'badge-5',
      title: 'Carbon Neutral Pro',
      icon: '🏆',
      description: 'Maintain Green Score > 85 for 14 consecutive days',
      status: 'locked',
      progress: 45,
      category: 'all'
    },
    {
      id: 'badge-6',
      title: 'Solar Enthusiast',
      icon: '☀️',
      description: 'Log 20 kWh of clean solar electricity generation',
      status: 'locked',
      progress: 20,
      category: 'electricity'
    }
  ],

  // Active Challenges
  challenges: [
    {
      id: 'ch-1',
      title: 'Campus Metro Challenge',
      category: 'transport',
      icon: '🚆',
      goal: 'Replace 25 km of car/cab travel with Metro or Bus',
      current: 18,
      target: 25,
      unit: 'km',
      daysLeft: 2,
      rewardPoints: 100,
      co2eSaved: 2.8
    },
    {
      id: 'ch-2',
      title: 'AC Eco-Mode Week',
      category: 'electricity',
      icon: '❄️',
      goal: 'Limit air conditioning to max 2 hours per day',
      current: 4,
      target: 7,
      unit: 'days',
      daysLeft: 3,
      rewardPoints: 120,
      co2eSaved: 4.5
    },
    {
      id: 'ch-3',
      title: 'Meatless Weekdays',
      category: 'food',
      icon: '🥗',
      goal: 'Eat purely vegetarian or vegan meals Monday to Friday',
      current: 3,
      target: 5,
      unit: 'days',
      daysLeft: 2,
      rewardPoints: 80,
      co2eSaved: 3.2
    }
  ]
};

window.MockData = MockData;
