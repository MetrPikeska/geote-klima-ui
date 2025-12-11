// === charts.js ===
// Modul pro vykreslení grafů s Chart.js

window.ClimateApp = window.ClimateApp || {};

ClimateApp.charts = (function () {

  let chartInstance = null;

  /**
   * Vyrenderuje line chart pro klimatický index.
   */
  function renderResultsChart(canvasEl, results, indicatorKey, unitName, indicatorLabel) {
    if (!canvasEl) return;

    // Smazání starého grafu
    if (chartInstance) {
      chartInstance.destroy();
      chartInstance = null;
    }

    // Check if there is any valid data to display
    const hasValidData = results.some(r => r.index != null && !isNaN(r.index));
    if (!hasValidData) {
      canvasEl.style.display = "none"; // Hide canvas
      // Optionally display a message instead
      // canvasEl.parentNode.querySelector(".chart-message").textContent = "Pro tento výběr nejsou dostupná data pro zobrazení grafu.";
      return;
    }

    canvasEl.style.display = "block"; // Ensure canvas is visible if data is present

    const labels = results.map((r) => r.label);
    const nonNullIndexValues = results.map((r) =>
      r.index != null && !isNaN(r.index) ? Number(r.index.toFixed(2)) : null
    ).filter(value => value !== null);

    const ctx = canvasEl.getContext("2d");

    const chartTitle = `Vývoj ${indicatorLabel} pro ${unitName}`;

    // Calculate min and max for padding
    let minIndex = nonNullIndexValues.length > 0 ? Math.min(...nonNullIndexValues) : 0;
    let maxIndex = nonNullIndexValues.length > 0 ? Math.max(...nonNullIndexValues) : 0;
    const padding = (maxIndex - minIndex) * 0.1; // 10% padding

    let suggestedMin = minIndex - padding;
    let suggestedMax = maxIndex + padding;

    // Ensure min and max are sensible even for small ranges or single values
    if (suggestedMin === suggestedMax) {
      suggestedMin -= 0.5; // Arbitrary small range
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
            font: {
              size: 16,
            },
          },
          tooltip: {
            callbacks: {
              label: function (context) {
                const value = context.parsed.y != null ? context.parsed.y.toFixed(2) : 'N/A';
                return `${indicatorLabel}: ${value}`;
              },
              title: function(context) {
                return `Normál: ${context[0].label}`;
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
            ticks: {
              color: '#e5e7eb',
            },
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

  return {
    renderResultsChart,
  };
})();
