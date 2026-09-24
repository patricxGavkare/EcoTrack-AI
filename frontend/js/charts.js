/**
 * Chart.js Visualizations Controller
 * Fulfills Slide 2 & 6: Interactive Dashboard & Graphs using Chart.js
 * Visual breakdown of emissions over time and future prediction curves.
 */

const CarbonCharts = {
  categoryDonut: null,
  trendChart: null,
  predictionChart: null,

  // Color tokens
  colors: {
    transport: '#10b981',    // Emerald
    electricity: '#f59e0b',  // Amber
    food: '#3b82f6',         // Blue
    water: '#06b6d4',        // Cyan
    waste: '#8b5cf6',        // Purple
    shopping: '#ec4899',     // Pink
    gas: '#ef4444',          // Red
    targetLine: '#34d399',   // Light Mint
    nationalLine: '#f97316', // Orange
    textPrimary: '#e2e8f0',
    textMuted: '#94a3b8',
    gridLines: 'rgba(255, 255, 255, 0.08)'
  },

  /**
   * Initialize all 3 Chart.js instances
   */
  init(history, predictionData) {
    this.renderCategoryDonut(history);
    this.renderTrendChart(history);
    this.renderPredictionChart(predictionData);
  },

  /**
   * 1. Donut Chart: 7-Category Breakdown
   */
  renderCategoryDonut(history) {
    const ctx = document.getElementById('categoryDonutCanvas');
    if (!ctx) return;

    // Aggregate category totals from recent history (last 7 days)
    const recent7 = history.slice(-7);
    const totals = {
      transport: 0,
      electricity: 0,
      food: 0,
      water: 0,
      waste: 0,
      shopping: 0,
      gas: 0
    };

    recent7.forEach(day => {
      Object.keys(totals).forEach(cat => {
        totals[cat] += (day[cat] || 0);
      });
    });

    const labels = [
      'Transportation',
      'Electricity',
      'Food & Diet',
      'Water Usage',
      'Waste Mgmt',
      'Shopping',
      'Cooking / Gas'
    ];

    const dataValues = [
      parseFloat(totals.transport.toFixed(1)),
      parseFloat(totals.electricity.toFixed(1)),
      parseFloat(totals.food.toFixed(1)),
      parseFloat(totals.water.toFixed(1)),
      parseFloat(Math.max(0, totals.waste).toFixed(1)),
      parseFloat(totals.shopping.toFixed(1)),
      parseFloat(totals.gas.toFixed(1))
    ];

    const bgColors = [
      this.colors.transport,
      this.colors.electricity,
      this.colors.food,
      this.colors.water,
      this.colors.waste,
      this.colors.shopping,
      this.colors.gas
    ];

    if (this.categoryDonut) {
      this.categoryDonut.destroy();
    }

    this.categoryDonut = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: dataValues,
          backgroundColor: bgColors,
          borderColor: '#0b1912',
          borderWidth: 3,
          hoverOffset: 8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'right',
            labels: {
              color: this.colors.textPrimary,
              font: {
                family: "'Inter', sans-serif",
                size: 11
              },
              boxWidth: 12,
              padding: 12
            }
          },
          tooltip: {
            backgroundColor: '#0f291c',
            titleColor: '#34d399',
            bodyColor: '#ffffff',
            borderColor: 'rgba(52, 211, 153, 0.3)',
            borderWidth: 1,
            padding: 10,
            callbacks: {
              label: function(context) {
                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                const val = context.parsed;
                const pct = total > 0 ? ((val / total) * 100).toFixed(1) : 0;
                return ` ${context.label}: ${val} kg CO₂e (${pct}%)`;
              }
            }
          }
        },
        cutout: '68%'
      }
    });
  },

  /**
   * 2. Weekly & Monthly Emission Trend (Bar + Baseline Reference lines)
   */
  renderTrendChart(history, timeRange = 7) {
    const ctx = document.getElementById('trendChartCanvas');
    if (!ctx) return;

    const slice = history.slice(-timeRange);
    const labels = slice.map(d => {
      const parts = d.date.split('-');
      return `${parts[1]}/${parts[2]}`;
    });

    const values = slice.map(d => d.total);
    const targetValues = slice.map(() => MockData.benchmarks.globalParisTarget);
    const nationalValues = slice.map(() => MockData.benchmarks.nationalAverage);

    // Dynamic bar colors based on intensity
    const barColors = values.map(val => {
      if (val <= MockData.benchmarks.globalParisTarget) return 'rgba(16, 185, 129, 0.85)'; // Emerald
      if (val <= MockData.benchmarks.nationalAverage) return 'rgba(245, 158, 11, 0.85)';   // Amber
      return 'rgba(239, 68, 68, 0.85)';                                                  // Red
    });

    if (this.trendChart) {
      this.trendChart.destroy();
    }

    this.trendChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Daily Footprint (kg CO₂e)',
            data: values,
            backgroundColor: barColors,
            borderRadius: 6,
            order: 2
          },
          {
            type: 'line',
            label: `Paris 1.5°C Limit (${MockData.benchmarks.globalParisTarget} kg)`,
            data: targetValues,
            borderColor: this.colors.targetLine,
            borderWidth: 2,
            borderDash: [5, 5],
            pointRadius: 0,
            fill: false,
            order: 1
          },
          {
            type: 'line',
            label: `National Average (${MockData.benchmarks.nationalAverage} kg)`,
            data: nationalValues,
            borderColor: this.colors.nationalLine,
            borderWidth: 1.5,
            borderDash: [3, 3],
            pointRadius: 0,
            fill: false,
            order: 1
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            grid: { color: this.colors.gridLines },
            ticks: { color: this.colors.textMuted }
          },
          y: {
            grid: { color: this.colors.gridLines },
            ticks: {
              color: this.colors.textMuted,
              callback: val => `${val} kg`
            },
            suggestedMax: 14
          }
        },
        plugins: {
          legend: {
            position: 'top',
            labels: {
              color: this.colors.textPrimary,
              boxWidth: 14,
              font: { family: "'Inter', sans-serif", size: 11 }
            }
          },
          tooltip: {
            backgroundColor: '#0f291c',
            titleColor: '#34d399',
            borderColor: 'rgba(52, 211, 153, 0.3)',
            borderWidth: 1,
            callbacks: {
              label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y} kg CO₂e`
            }
          }
        }
      }
    });
  },

  /**
   * 3. ML Future Prediction Chart (Slide 2, 4, 7)
   * Shows Baseline Business-As-Usual vs AI-Optimized trajectory
   */
  renderPredictionChart(predData) {
    const ctx = document.getElementById('predictionChartCanvas');
    if (!ctx) return;

    if (this.predictionChart) {
      this.predictionChart.destroy();
    }

    this.predictionChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: predData.forecastLabels,
        datasets: [
          {
            label: 'Projected (Current Habits)',
            data: predData.baselineForecast,
            borderColor: '#f59e0b',
            backgroundColor: 'rgba(245, 158, 11, 0.08)',
            borderWidth: 2,
            borderDash: [6, 4],
            pointBackgroundColor: '#f59e0b',
            pointRadius: 4,
            fill: true,
            tension: 0.3
          },
          {
            label: 'AI-Guided Forecast (With Habits Adopted)',
            data: predData.optimizedForecast,
            borderColor: '#10b981',
            backgroundColor: 'rgba(16, 185, 129, 0.22)',
            borderWidth: 3,
            pointBackgroundColor: '#10b981',
            pointHoverRadius: 6,
            pointRadius: 4,
            fill: true,
            tension: 0.3
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            grid: { color: this.colors.gridLines },
            ticks: { color: this.colors.textMuted }
          },
          y: {
            grid: { color: this.colors.gridLines },
            ticks: {
              color: this.colors.textMuted,
              callback: val => `${val} kg`
            },
            suggestedMin: 1.0,
            suggestedMax: 10.0
          }
        },
        plugins: {
          legend: {
            position: 'top',
            labels: {
              color: this.colors.textPrimary,
              boxWidth: 14,
              font: { family: "'Inter', sans-serif", size: 11 }
            }
          },
          tooltip: {
            backgroundColor: '#0f291c',
            titleColor: '#34d399',
            borderColor: 'rgba(52, 211, 153, 0.3)',
            borderWidth: 1,
            callbacks: {
              label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y} kg CO₂e/day`
            }
          }
        }
      }
    });
  },

  /**
   * Update future prediction chart in real time when user tweaks What-If sliders
   */
  updatePrediction(predData) {
    if (!this.predictionChart) {
      this.renderPredictionChart(predData);
      return;
    }
    this.predictionChart.data.labels = predData.forecastLabels;
    this.predictionChart.data.datasets[0].data = predData.baselineForecast;
    this.predictionChart.data.datasets[1].data = predData.optimizedForecast;
    this.predictionChart.update();
  },

  /**
   * Resize all charts cleanly when tab views switch
   */
  resizeAll() {
    setTimeout(() => {
      if (this.categoryDonut) this.categoryDonut.resize();
      if (this.trendChart) this.trendChart.resize();
      if (this.predictionChart) this.predictionChart.resize();
    }, 50);
  }
};

window.CarbonCharts = CarbonCharts;
