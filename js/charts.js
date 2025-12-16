// === charts.js ===
// Modul pro vykreslení grafů s Chart.js

window.ClimateApp = window.ClimateApp || {};

ClimateApp.charts = (function () {

  let chartInstance = null;
  let currentChartMode = 'aggregate'; // 'aggregate', 'monthly', 'comparison'
  let currentChartData = null; // Store data for mode switching

  /**
   * Vyrenderuje line chart pro klimatický index.
   */
  function renderResultsChart(canvasEl, results, indicatorKey, unitName, indicatorLabel) {
    if (!canvasEl) return;

    // Store data for mode switching
    currentChartData = { canvasEl, results, indicatorKey, unitName, indicatorLabel };

    // Check if there is any valid data to display
    const hasValidData = results.some(r => r.index != null && !isNaN(r.index));
    if (!hasValidData) {
      canvasEl.style.display = "none";
      return;
    }

    canvasEl.style.display = "block";

    // Create toggle controls if they don't exist
    createChartToggle(canvasEl);

    // Render based on current mode
    renderChartByMode();
  }

  /**
   * Create toggle controls for switching chart modes
   */
  function createChartToggle(canvasEl) {
    const existingToggle = document.getElementById('chart-mode-toggle');
    if (existingToggle) return; // Already exists

    const toggleContainer = document.createElement('div');
    toggleContainer.id = 'chart-mode-toggle';
    toggleContainer.style.cssText = 'display: flex; gap: 0.5rem; margin-bottom: 1rem; flex-wrap: wrap;';

    const modes = [
      { id: 'aggregate', label: 'Aggregated Values', icon: '📊' },
      { id: 'monthly', label: 'Monthly Temperatures', icon: '📅' },
      { id: 'comparison', label: 'Compare Normals', icon: '🔄' }
    ];

    modes.forEach(mode => {
      const btn = document.createElement('button');
      btn.textContent = `${mode.icon} ${mode.label}`;
      btn.style.cssText = `
        padding: 0.5rem 1rem;
        border: 1px solid rgba(148, 163, 184, 0.4);
        background: ${currentChartMode === mode.id ? 'rgba(56, 189, 248, 0.2)' : 'rgba(30, 41, 59, 0.5)'};
        color: #e5e7eb;
        border-radius: 0.375rem;
        cursor: pointer;
        font-size: 0.875rem;
        transition: all 0.2s;
      `;

      btn.addEventListener('click', () => {
        currentChartMode = mode.id;
        // Update all button styles
        toggleContainer.querySelectorAll('button').forEach((b, i) => {
          b.style.background = i === modes.findIndex(m => m.id === mode.id)
            ? 'rgba(56, 189, 248, 0.2)'
            : 'rgba(30, 41, 59, 0.5)';
        });
        renderChartByMode();
      });

      btn.addEventListener('mouseenter', () => {
        if (currentChartMode !== mode.id) {
          btn.style.background = 'rgba(56, 189, 248, 0.1)';
        }
      });

      btn.addEventListener('mouseleave', () => {
        if (currentChartMode !== mode.id) {
          btn.style.background = 'rgba(30, 41, 59, 0.5)';
        }
      });

      toggleContainer.appendChild(btn);
    });

    // Insert toggle before canvas
    canvasEl.parentNode.insertBefore(toggleContainer, canvasEl);
  }

  /**
   * Render chart based on current mode
   */
  function renderChartByMode() {
    if (!currentChartData) return;

    const { canvasEl, results, indicatorKey, unitName, indicatorLabel } = currentChartData;

    // Destroy old chart
    if (chartInstance) {
      chartInstance.destroy();
      chartInstance = null;
    }

    switch (currentChartMode) {
      case 'aggregate':
        renderAggregateChart(canvasEl, results, indicatorKey, unitName, indicatorLabel);
        break;
      case 'monthly':
        renderMonthlyChart(canvasEl, results, unitName);
        break;
      case 'comparison':
        renderComparisonChart(canvasEl, results, indicatorKey, unitName, indicatorLabel);
        break;
    }
  }

  /**
   * Render aggregate chart (original view)
   */
  function renderAggregateChart(canvasEl, results, indicatorKey, unitName, indicatorLabel) {
    const labels = results.map((r) => r.label);
    const nonNullIndexValues = results.map((r) =>
      r.index != null && !isNaN(r.index) ? Number(r.index.toFixed(2)) : null
    ).filter(value => value !== null);

    const ctx = canvasEl.getContext("2d");
    const chartTitle = `${indicatorLabel} Trends for ${unitName}`;

    let minIndex = nonNullIndexValues.length > 0 ? Math.min(...nonNullIndexValues) : 0;
    let maxIndex = nonNullIndexValues.length > 0 ? Math.max(...nonNullIndexValues) : 0;
    const padding = (maxIndex - minIndex) * 0.1;

    let suggestedMin = minIndex - padding;
    let suggestedMax = maxIndex + padding;

    if (suggestedMin === suggestedMax) {
      suggestedMin -= 0.5;
      suggestedMax += 0.5;
    }

    chartInstance = new Chart(ctx, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: indicatorLabel,
            data: results.map((r) =>
              r.index != null && !isNaN(r.index) ? Number(r.index.toFixed(2)) : null
            ),
            borderColor: 'rgba(56, 189, 248, 1)',
            borderWidth: 2,
            tension: 0.35,
            fill: false,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: chartTitle,
            color: '#e5e7eb',
            font: { size: 16 },
          },
          tooltip: {
            callbacks: {
              label: function (context) {
                const value = context.parsed.y != null ? context.parsed.y.toFixed(2) : 'N/A';
                return `${indicatorLabel}: ${value}`;
              },
              title: function(context) {
                return `Normal: ${context[0].label}`;
              }
            },
          },
          legend: {
            display: true,
            labels: {
              filter: function(legendItem, chartData) {
                return true;
              }
            }
          }
        },
        scales: {
          y: {
            beginAtZero: false,
            suggestedMin: suggestedMin,
            suggestedMax: suggestedMax,
            title: {
              display: true,
              text: indicatorLabel,
              color: '#e5e7eb',
            },
            ticks: { color: '#e5e7eb' },
            grid: {
              color: 'rgba(148, 163, 184, 0.2)',
              borderColor: 'rgba(148, 163, 184, 0.4)'
            }
          },
          x: {
            ticks: {
              color: '#e5e7eb',
              maxRotation: 0,
              minRotation: 0,
            },
            grid: {
              color: 'rgba(148, 163, 184, 0.2)',
              borderColor: 'rgba(148, 163, 184, 0.4)'
            }
          },
        },
      },
    });
  }

  /**
   * Render monthly temperature chart (12 points per normal)
   */
  function renderMonthlyChart(canvasEl, results, unitName) {
    const ctx = canvasEl.getContext("2d");
    const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    const colors = {
      'old': 'rgba(59, 130, 246, 1)',     // Blue
      'new': 'rgba(16, 185, 129, 1)',     // Green
      'future': 'rgba(239, 68, 68, 1)'    // Red
    };

    const datasets = results
      .filter(r => r.monthlyTemps && Array.isArray(r.monthlyTemps))
      .map(r => ({
        label: r.label,
        data: r.monthlyTemps,
        borderColor: colors[r.key] || 'rgba(148, 163, 184, 1)',
        backgroundColor: colors[r.key] || 'rgba(148, 163, 184, 0.5)',
        borderWidth: 2,
        tension: 0.4,
        fill: false,
        pointRadius: 4,
        pointHoverRadius: 6,
      }));

    if (datasets.length === 0) {
      console.warn('No monthly temperature data available');
      return;
    }

    // Calculate min/max for all monthly temps
    const allTemps = datasets.flatMap(d => d.data).filter(t => t != null);
    const minTemp = Math.min(...allTemps);
    const maxTemp = Math.max(...allTemps);
    const padding = (maxTemp - minTemp) * 0.1;

    chartInstance = new Chart(ctx, {
      type: "line",
      data: {
        labels: monthLabels,
        datasets: datasets,
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: `Monthly Average Temperatures - ${unitName}`,
            color: '#e5e7eb',
            font: { size: 16 },
          },
          tooltip: {
            callbacks: {
              label: function (context) {
                const value = context.parsed.y != null ? context.parsed.y.toFixed(1) : 'N/A';
                return `${context.dataset.label}: ${value}°C`;
              },
            },
          },
          legend: {
            display: true,
            position: 'top',
            labels: {
              color: '#e5e7eb',
              usePointStyle: true,
              padding: 15,
            }
          }
        },
        scales: {
          y: {
            beginAtZero: false,
            suggestedMin: minTemp - padding,
            suggestedMax: maxTemp + padding,
            title: {
              display: true,
              text: 'Temperature (°C)',
              color: '#e5e7eb',
            },
            ticks: {
              color: '#e5e7eb',
              callback: function(value) {
                return value.toFixed(1) + '°C';
              }
            },
            grid: {
              color: 'rgba(148, 163, 184, 0.2)',
              borderColor: 'rgba(148, 163, 184, 0.4)'
            }
          },
          x: {
            title: {
              display: true,
              text: 'Month',
              color: '#e5e7eb',
            },
            ticks: { color: '#e5e7eb' },
            grid: {
              color: 'rgba(148, 163, 184, 0.2)',
              borderColor: 'rgba(148, 163, 184, 0.4)'
            }
          },
        },
      },
    });
  }

  /**
   * Render comparison chart (all normals side by side)
   */
  function renderComparisonChart(canvasEl, results, indicatorKey, unitName, indicatorLabel) {
    const ctx = canvasEl.getContext("2d");

    const colors = {
      'old': 'rgba(59, 130, 246, 0.7)',
      'new': 'rgba(16, 185, 129, 0.7)',
      'future': 'rgba(239, 68, 68, 0.7)'
    };

    // Prepare data for grouped bar chart
    const metrics = ['Temperature (°C)', 'Precipitation (mm)', indicatorLabel];

    const datasets = results.map(r => ({
      label: r.label,
      data: [
        r.T != null ? r.T : null,
        r.R != null ? r.R : null,
        r.index != null ? r.index : null
      ],
      backgroundColor: colors[r.key] || 'rgba(148, 163, 184, 0.7)',
      borderColor: colors[r.key]?.replace('0.7', '1') || 'rgba(148, 163, 184, 1)',
      borderWidth: 1,
    }));

    chartInstance = new Chart(ctx, {
      type: "bar",
      data: {
        labels: metrics,
        datasets: datasets,
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: `Climate Normals Comparison - ${unitName}`,
            color: '#e5e7eb',
            font: { size: 16 },
          },
          tooltip: {
            callbacks: {
              label: function (context) {
                const value = context.parsed.y != null ? context.parsed.y.toFixed(2) : 'N/A';
                return `${context.dataset.label}: ${value}`;
              },
            },
          },
          legend: {
            display: true,
            position: 'top',
            labels: {
              color: '#e5e7eb',
              padding: 15,
            }
          }
        },
        scales: {
          y: {
            beginAtZero: false,
            title: {
              display: true,
              text: 'Value',
              color: '#e5e7eb',
            },
            ticks: { color: '#e5e7eb' },
            grid: {
              color: 'rgba(148, 163, 184, 0.2)',
              borderColor: 'rgba(148, 163, 184, 0.4)'
            }
          },
          x: {
            ticks: { color: '#e5e7eb' },
            grid: {
              color: 'rgba(148, 163, 184, 0.2)',
              borderColor: 'rgba(148, 163, 184, 0.4)'
            }
          },
        },
      },
    });
  }

  return {
    renderResultsChart,
  };
})();
