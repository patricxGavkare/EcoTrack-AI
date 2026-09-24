/**
 * =============================================================================
 * 🌿 Carbon Calculation Engine (carbon-calc.js)
 * =============================================================================
 * What this file does:
 * 1. Stores standard emission factors for 7 categories (IPCC & DEFRA standards).
 * 2. Calculates carbon footprint using the core formula:
 *    Emission (kg CO2e) = Activity Amount × Emission Factor
 * 3. Formats equations so users can see the exact math behind every entry.
 * =============================================================================
 */

const CarbonCalc = {
  // The 7 emission categories with real-world conversion multipliers
  factors: {
    // 1. Transportation (kg CO2e per km or passenger-km)
    transport: {
      car_petrol: { label: 'Petrol Car', factor: 0.192, unit: 'km', note: 'Standard compact petrol car (DEFRA)' },
      car_diesel: { label: 'Diesel Car', factor: 0.171, unit: 'km', note: 'Standard diesel car (DEFRA)' },
      car_electric: { label: 'Electric Car (EV)', factor: 0.053, unit: 'km', note: 'Based on average grid recharging mix' },
      bike_petrol: { label: 'Motorcycle / Scooter', factor: 0.103, unit: 'km', note: 'Average 125-150cc 2-wheeler' },
      bus_public: { label: 'City Bus', factor: 0.089, unit: 'km', note: 'Average bus passenger-km' },
      metro_train: { label: 'Metro / Local Train', factor: 0.035, unit: 'km', note: 'Electric urban rail passenger-km' },
      flight_domestic: { label: 'Domestic Flight', factor: 0.255, unit: 'km', note: 'Economy short haul including radiative forcing' },
      bicycle_walk: { label: 'Bicycle / Walking', factor: 0.000, unit: 'km', note: 'Zero tailpipe emissions' }
    },

    // 2. Electricity (kg CO2e per kWh)
    electricity: {
      grid_standard: { label: 'Grid Electricity', factor: 0.710, unit: 'kWh', note: 'Average national grid carbon intensity (CEA / IPCC)' },
      solar_rooftop: { label: 'Solar Rooftop Power', factor: 0.041, unit: 'kWh', note: 'Lifecycle footprint of PV panels' },
      // Appliance estimation multipliers (hours to kWh equivalent)
      ac_hour: { label: 'Air Conditioner (1.5 Ton)', factor: 1.50 * 0.710, unit: 'hours', note: '~1.5 kWh/hour at grid factor' },
      pc_hour: { label: 'Desktop / Gaming PC', factor: 0.25 * 0.710, unit: 'hours', note: '~250W consumption per hour' },
      tv_hour: { label: 'Smart LED TV', factor: 0.10 * 0.710, unit: 'hours', note: '~100W consumption per hour' }
    },

    // 3. Food Consumption (kg CO2e per meal or diet portion)
    food: {
      diet_heavy_meat: { label: 'Meat-Heavy Diet (Daily)', factor: 7.20, unit: 'day', note: 'High beef/mutton daily intake' },
      diet_medium_meat: { label: 'Balanced Omnivore (Daily)', factor: 5.60, unit: 'day', note: 'Moderate poultry/fish intake' },
      diet_pescatarian: { label: 'Pescatarian Diet (Daily)', factor: 3.90, unit: 'day', note: 'Fish and plant-based foods' },
      diet_vegetarian: { label: 'Vegetarian Diet (Daily)', factor: 3.80, unit: 'day', note: 'Plant-based with dairy products' },
      diet_vegan: { label: 'Vegan Diet (Daily)', factor: 2.90, unit: 'day', note: '100% plant-based meal plan' },
      meal_meat: { label: 'Single Red Meat Meal', factor: 3.30, unit: 'meal', note: 'Beef/Lamb meal portion' },
      meal_chicken: { label: 'Single Chicken/Poultry Meal', factor: 1.30, unit: 'meal', note: 'Poultry meal portion' },
      meal_vegetarian: { label: 'Single Vegetarian Meal', factor: 0.90, unit: 'meal', note: 'Grain, lentils & dairy meal' }
    },

    // 4. Water Usage (kg CO2e per liter or habit duration)
    water: {
      tap_water: { label: 'Municipal Tap Water', factor: 0.0003, unit: 'liters', note: 'Pumping, purification & distribution' },
      shower_hot: { label: 'Hot Shower (10 mins)', factor: 0.850, unit: 'showers', note: 'Water + electric water heating' },
      shower_cold: { label: 'Quick / Cold Shower', factor: 0.050, unit: 'showers', note: 'Only pumping energy' },
      laundry_load: { label: 'Washing Machine Load', factor: 0.600, unit: 'loads', note: 'Warm cycle water + electricity' }
    },

    // 5. Waste Management (kg CO2e per kg)
    waste: {
      landfill_mixed: { label: 'Landfill Waste (Mixed)', factor: 0.580, unit: 'kg', note: 'Mixed municipal garbage' },
      landfill_organic: { label: 'Food / Organic Waste to Landfill', factor: 1.250, unit: 'kg', note: 'Generates methane under anaerobic breakdown' },
      composted_organic: { label: 'Composted Organic Waste', factor: 0.080, unit: 'kg', note: 'Aerobic decomposition' },
      recycled_plastic_paper: { label: 'Recycled Plastic/Paper', factor: -0.150, unit: 'kg', note: 'Carbon credit offset for recycled material' }
    },

    // 6. Shopping & Goods (kg CO2e per item/purchase)
    shopping: {
      clothing_fast_fashion: { label: 'Fast Fashion Garment (Shirt/Jeans)', factor: 9.50, unit: 'items', note: 'Textile production, water & synthetic fibers' },
      electronics_accessory: { label: 'Small Electronics (Charger/Headphones)', factor: 4.20, unit: 'items', note: 'Semiconductor supply chain' },
      electronics_device: { label: 'Smartphone / Tablet (Prorated)', factor: 25.00, unit: 'purchases', note: 'Embodied carbon in rare metals & assembly' },
      packaged_goods: { label: 'Packaged Retail Items', factor: 1.10, unit: 'items', note: 'Plastic packaging & transport logistics' }
    },

    // 7. Cooking / Household Gas (kg CO2e per kg or usage)
    gas: {
      lpg_kg: { label: 'LPG (Liquefied Petroleum Gas)', factor: 2.98, unit: 'kg', note: '2.98 kg CO2e per 1 kg LPG burned' },
      lpg_hour_cooking: { label: 'LPG Stove Cooking (1 hour)', factor: 0.65, unit: 'hours', note: 'Standard medium burner at ~220g/hr' },
      png_m3: { label: 'Piped Natural Gas (PNG)', factor: 2.05, unit: 'm³', note: 'Methane combustion' },
      electric_induction: { label: 'Induction Cooktop (1 hour)', factor: 0.85, unit: 'hours', note: '~1.2 kWh at grid emission factor' }
    }
  },

  // Metadata for the 7 categories
  categoriesMeta: {
    transport: { name: 'Transportation', icon: '🚗', color: '#10b981', defaultUnit: 'km' },
    electricity: { name: 'Electricity', icon: '⚡', color: '#f59e0b', defaultUnit: 'kWh' },
    food: { name: 'Food & Diet', icon: '🥗', color: '#3b82f6', defaultUnit: 'day/meals' },
    water: { name: 'Water Usage', icon: '💧', color: '#06b6d4', defaultUnit: 'liters' },
    waste: { name: 'Waste Management', icon: '🗑️', color: '#8b5cf6', defaultUnit: 'kg' },
    shopping: { name: 'Shopping & Goods', icon: '🛍️', color: '#ec4899', defaultUnit: 'items' },
    gas: { name: 'Cooking & Gas', icon: '🔥', color: '#ef4444', defaultUnit: 'kg/hours' }
  },

  /**
   * Calculate CO2e for a single activity
   * Formula: Activity Amount * Emission Factor
   * @param {string} category - One of the 7 categories
   * @param {string} subType - Sub-activity key
   * @param {number} amount - Numerical value logged by user
   * @returns {Object} result with co2e, formula, details
   */
  calculateItem(category, subType, amount) {
    const catData = this.factors[category];
    if (!catData || !catData[subType]) {
      return { co2e: 0, formula: 'Invalid item', factor: 0 };
    }

    const item = catData[subType];
    const numericAmount = Math.max(0, parseFloat(amount) || 0);
    const co2e = parseFloat((numericAmount * item.factor).toFixed(3));

    return {
      category,
      categoryName: this.categoriesMeta[category].name,
      subType,
      label: item.label,
      amount: numericAmount,
      unit: item.unit,
      factor: item.factor,
      co2e: co2e,
      note: item.note,
      formula: `${numericAmount} ${item.unit} × ${item.factor} kg CO₂e/${item.unit} = ${co2e.toFixed(2)} kg CO₂e`
    };
  },

  /**
   * Sum up an array of activity items
   */
  calculateBatch(items) {
    let total = 0;
    const categoryTotals = {
      transport: 0,
      electricity: 0,
      food: 0,
      water: 0,
      waste: 0,
      shopping: 0,
      gas: 0
    };

    items.forEach(item => {
      const res = this.calculateItem(item.category, item.subType, item.amount);
      total += res.co2e;
      if (categoryTotals[item.category] !== undefined) {
        categoryTotals[item.category] += res.co2e;
      }
    });

    // Round values
    total = parseFloat(total.toFixed(2));
    Object.keys(categoryTotals).forEach(cat => {
      categoryTotals[cat] = parseFloat(categoryTotals[cat].toFixed(2));
    });

    return {
      totalCo2e: total,
      categoryTotals
    };
  }
};

window.CarbonCalc = CarbonCalc;
