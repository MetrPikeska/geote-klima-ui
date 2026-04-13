// === charts.js ===
// Modul pro vykreslení grafů s Chart.js

window.ClimateApp = window.ClimateApp || {};

ClimateApp.charts = (function () {

  let chartInstance = null;
  let currentChartMode = 'climatogram';
  let currentChartData = null;

  const MONTH_LABELS = ['Led', 'Úno', 'Bře', 'Dub', 'Kvě', 'Čer', 'Čvc', 'Srp', 'Zář', 'Říj', 'Lis', 'Pro'];

  const PALETTE = {
    old:    { line: 'rgba(59, 130, 246, 1)',   fill: 'rgba(59, 130, 246, 0.15)',  bar: 'rgba(59, 130, 246, 0.4)'  },
    new:    { line: 'rgba(16, 185, 129, 1)',   fill: 'rgba(16, 185, 129, 0.15)',  bar: 'rgba(16, 185, 129, 0.4)'  },
    future: { line: 'rgba(239, 68, 68, 1)',    fill: 'rgba(239, 68, 68, 0.15)',   bar: 'rgba(239, 68, 68, 0.4)'   },
  };

  const GRID  = 'rgba(148, 163, 184, 0.15)';
  const TICK  = '#94a3b8';
  const TITLE_COLOR = '#e5e7eb';

  function baseScaleY(title, position = 'left') {
    return {
      type: 'linear',
      position,
      title: { display: true, text: title, color: TITLE_COLOR, font: { size: 11 } },
      ticks: { color: TICK },
      grid: { color: position === 'left' ? GRID : 'transparent' },
    };
  }

  function baseScaleX() {
    return {
      ticks: { color: TICK },
      grid: { color: GRID },
    };
  }

  function baseOptions(titleText) {
    return {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        title: { display: true, text: titleText, color: TITLE_COLOR, font: { size: 15 } },
        legend: {
          display: true,
          position: 'top',
          labels: { color: TITLE_COLOR, usePointStyle: true, padding: 14, font: { size: 11 } },
        },
      },
    };
  }

  // ============================================================
  //   Klimatogram (Walter-Lieth style) — T lines + SRA bars
  // ============================================================
  function renderClimatogramChart(canvasEl, results, unitName) {
    const ctx = canvasEl.getContext('2d');
    const datasets = [];

    results.forEach(r => {
      const c = PALETTE[r.key] || PALETTE.new;

      // Precipitation bars (yPrecip axis)
      if (r.monthlySRA && r.monthlySRA.length === 12) {
        datasets.push({
          type: 'bar',
          label: `${r.label} — Srážky`,
          data: r.monthlySRA.map(v => v != null ? +v.toFixed(1) : null),
          backgroundColor: c.bar,
          borderColor: c.line,
          borderWidth: 1,
          yAxisID: 'yPrecip',
          order: 2,
        });
      }

      // Temperature line (yTemp axis)
      if (r.monthlyTemps && r.monthlyTemps.length === 12) {
        datasets.push({
          type: 'line',
          label: `${r.label} — T`,
          data: r.monthlyTemps.map(v => v != null ? +v.toFixed(1) : null),
          borderColor: c.line,
          backgroundColor: c.fill,
          fill: false,
          borderWidth: 2.5,
          tension: 0.4,
          pointRadius: 3,
          pointHoverRadius: 6,
          yAxisID: 'yTemp',
          order: 1,
        });
      }
    });

    if (datasets.length === 0) return;

    const opts = baseOptions(`Klimatogram — ${unitName}`);
    opts.plugins.tooltip = {
      callbacks: {
        label: ctx => {
          const v = ctx.parsed.y;
          if (v == null) return null;
          const isTemp = ctx.dataset.yAxisID === 'yTemp';
          return `${ctx.dataset.label}: ${v.toFixed(1)}${isTemp ? ' °C' : ' mm'}`;
        },
      },
    };
    opts.scales = {
      yTemp: { ...baseScaleY('Teplota (°C)', 'left'), ticks: { color: TICK, callback: v => v.toFixed(0) + '°C' } },
      yPrecip: { ...baseScaleY('Srážky (mm)', 'right'), grid: { display: false }, ticks: { color: TICK, callback: v => v.toFixed(0) + ' mm' } },
      x: { ...baseScaleX(), labels: MONTH_LABELS },
    };

    chartInstance = new Chart(ctx, { type: 'bar', data: { labels: MONTH_LABELS, datasets }, options: opts });
  }

  // ============================================================
  //   Měsíční teploty — vylepšená verze s fill oblastmi
  // ============================================================
  function renderMonthlyChart(canvasEl, results, unitName) {
    const ctx = canvasEl.getContext('2d');

    const datasets = results
      .filter(r => r.monthlyTemps && r.monthlyTemps.length === 12)
      .map(r => {
        const c = PALETTE[r.key] || PALETTE.new;
        return {
          label: r.label,
          data: r.monthlyTemps.map(v => v != null ? +v.toFixed(1) : null),
          borderColor: c.line,
          backgroundColor: c.fill,
          fill: 'origin',
          borderWidth: 2,
          tension: 0.4,
          pointRadius: 4,
          pointHoverRadius: 7,
        };
      });

    if (datasets.length === 0) return;

    const allTemps = datasets.flatMap(d => d.data).filter(t => t != null);
    const minT = Math.min(...allTemps);
    const maxT = Math.max(...allTemps);
    const pad  = (maxT - minT) * 0.12;

    const opts = baseOptions(`Průměrné měsíční teploty — ${unitName}`);
    opts.plugins.tooltip = {
      callbacks: {
        label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y.toFixed(1)} °C`,
      },
    };
    opts.scales = {
      y: {
        ...baseScaleY('Teplota (°C)'),
        suggestedMin: minT - pad,
        suggestedMax: maxT + pad,
        ticks: { color: TICK, callback: v => v.toFixed(0) + '°C' },
      },
      x: { ...baseScaleX(), title: { display: true, text: 'Měsíc', color: TITLE_COLOR } },
    };

    chartInstance = new Chart(ctx, { type: 'line', data: { labels: MONTH_LABELS, datasets }, options: opts });
  }

  // ============================================================
  //   Srážky po měsících
  // ============================================================
  function renderMonthlyPrecipChart(canvasEl, results, unitName) {
    const ctx = canvasEl.getContext('2d');

    const datasets = results
      .filter(r => r.monthlySRA && r.monthlySRA.length === 12)
      .map(r => {
        const c = PALETTE[r.key] || PALETTE.new;
        return {
          label: r.label,
          data: r.monthlySRA.map(v => v != null ? +v.toFixed(1) : null),
          backgroundColor: c.bar,
          borderColor: c.line,
          borderWidth: 1,
        };
      });

    if (datasets.length === 0) return;

    const opts = baseOptions(`Měsíční srážky — ${unitName}`);
    opts.plugins.tooltip = {
      callbacks: {
        label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y.toFixed(1)} mm`,
      },
    };
    opts.scales = {
      y: {
        ...baseScaleY('Srážky (mm)'),
        beginAtZero: true,
        ticks: { color: TICK, callback: v => v.toFixed(0) + ' mm' },
      },
      x: { ...baseScaleX(), title: { display: true, text: 'Měsíc', color: TITLE_COLOR } },
    };

    chartInstance = new Chart(ctx, { type: 'bar', data: { labels: MONTH_LABELS, datasets }, options: opts });
  }

  // ============================================================
  //   Přehledový graf — index trend přes normály
  // ============================================================
  function renderAggregateChart(canvasEl, results, indicatorKey, unitName, indicatorLabel) {
    const ctx = canvasEl.getContext('2d');
    const labels = results.map(r => r.label);

    const indexVals = results.map(r => r.index != null && !isNaN(r.index) ? +r.index.toFixed(2) : null);
    const Tvals     = results.map(r => r.T  != null ? +r.T.toFixed(2)  : null);
    const Rvals     = results.map(r => r.R  != null ? +r.R.toFixed(1)  : null);

    const nonNull = v => v.filter(x => x != null);
    const yMin = Math.min(...nonNull(indexVals));
    const yMax = Math.max(...nonNull(indexVals));
    const pad  = (yMax - yMin) * 0.15 || 0.5;

    const opts = baseOptions(`${indicatorLabel} — ${unitName}`);
    opts.plugins.tooltip = {
      callbacks: {
        label: ctx => {
          const v = ctx.parsed.y;
          if (v == null) return null;
          if (ctx.dataset.yAxisID === 'yR') return `Srážky: ${v.toFixed(0)} mm`;
          if (ctx.dataset.label === 'Teplota') return `Teplota: ${v.toFixed(1)} °C`;
          return `${indicatorLabel}: ${v.toFixed(2)}`;
        },
      },
    };
    opts.scales = {
      y: {
        ...baseScaleY(indicatorLabel),
        suggestedMin: yMin - pad,
        suggestedMax: yMax + pad,
        ticks: { color: TICK, callback: v => v.toFixed(2) },
      },
      yR: {
        ...baseScaleY('Srážky (mm)', 'right'),
        grid: { display: false },
        ticks: { color: TICK, callback: v => v.toFixed(0) + ' mm' },
      },
      x: baseScaleX(),
    };

    chartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: indicatorLabel,
            data: indexVals,
            borderColor: 'rgba(56, 189, 248, 1)',
            backgroundColor: 'rgba(56, 189, 248, 0.12)',
            fill: true,
            borderWidth: 2.5,
            tension: 0.3,
            pointRadius: 5,
            pointHoverRadius: 8,
            yAxisID: 'y',
          },
          {
            label: 'Teplota',
            data: Tvals,
            borderColor: 'rgba(251, 191, 36, 0.85)',
            borderDash: [5, 3],
            borderWidth: 1.5,
            tension: 0.3,
            pointRadius: 4,
            fill: false,
            yAxisID: 'y',
          },
          {
            label: 'Srážky',
            type: 'bar',
            data: Rvals,
            backgroundColor: 'rgba(99, 179, 237, 0.25)',
            borderColor: 'rgba(99, 179, 237, 0.6)',
            borderWidth: 1,
            yAxisID: 'yR',
          },
        ],
      },
      options: opts,
    });
  }

  // ============================================================
  //   Porovnání normálů — delta od starého normálu
  // ============================================================
  function renderComparisonChart(canvasEl, results, indicatorKey, unitName, indicatorLabel) {
    const ctx = canvasEl.getContext('2d');
    const old = results.find(r => r.key === 'old');

    if (!old) {
      renderAggregateChart(canvasEl, results, indicatorKey, unitName, indicatorLabel);
      return;
    }

    const compared = results.filter(r => r.key !== 'old');
    if (compared.length === 0) return;

    const metrics = ['ΔT (°C)', 'ΔSrážky (mm)', `Δ${indicatorLabel}`];
    const datasets = compared.map(r => {
      const c = PALETTE[r.key] || PALETTE.new;
      return {
        label: `${r.label} vs. Starý normál`,
        data: [
          r.T  != null && old.T  != null ? +(r.T  - old.T).toFixed(2)  : null,
          r.R  != null && old.R  != null ? +(r.R  - old.R).toFixed(1)  : null,
          r.index != null && old.index != null ? +(r.index - old.index).toFixed(3) : null,
        ],
        backgroundColor: c.bar,
        borderColor: c.line,
        borderWidth: 2,
      };
    });

    const allVals = datasets.flatMap(d => d.data).filter(v => v != null);
    const absMax  = Math.max(...allVals.map(Math.abs), 0.1);

    const opts = baseOptions(`Změny oproti starému normálu — ${unitName}`);
    opts.plugins.tooltip = {
      callbacks: {
        label: ctx => {
          const v = ctx.parsed.y;
          if (v == null) return null;
          const sign = v >= 0 ? '+' : '';
          return `${ctx.dataset.label}: ${sign}${v}`;
        },
      },
    };
    opts.scales = {
      y: {
        ...baseScaleY('Změna (Δ)'),
        suggestedMin: -absMax * 1.2,
        suggestedMax:  absMax * 1.2,
        ticks: { color: TICK, callback: v => (v >= 0 ? '+' : '') + v.toFixed(2) },
        grid: { color: GRID },
      },
      x: baseScaleX(),
    };

    // Zero line plugin
    opts.plugins.annotation = undefined; // no annotation plugin needed — zero visible via grid

    chartInstance = new Chart(ctx, { type: 'bar', data: { labels: metrics, datasets }, options: opts });
  }

  // ============================================================
  //   Přepínač módů
  // ============================================================
  function createChartToggle(canvasEl) {
    if (document.getElementById('chart-mode-toggle')) return;

    const container = document.createElement('div');
    container.id = 'chart-mode-toggle';

    const modes = [
      { id: 'climatogram', label: 'Klimatogram' },
      { id: 'monthly',     label: 'Teploty' },
      { id: 'precipitation', label: 'Srážky' },
      { id: 'aggregate',   label: 'Index' },
      { id: 'comparison',  label: 'Δ Změny' },
    ];

    modes.forEach(mode => {
      const btn = document.createElement('button');
      btn.textContent = mode.label;
      btn.dataset.mode = mode.id;
      if (mode.id === currentChartMode) btn.classList.add('active');

      btn.addEventListener('click', () => {
        currentChartMode = mode.id;
        container.querySelectorAll('button').forEach(b => b.classList.toggle('active', b.dataset.mode === mode.id));
        renderChartByMode();
      });

      container.appendChild(btn);
    });

    canvasEl.parentNode.insertBefore(container, canvasEl);
  }

  function renderChartByMode() {
    if (!currentChartData) return;
    const { canvasEl, results, indicatorKey, unitName, indicatorLabel } = currentChartData;

    if (chartInstance) { chartInstance.destroy(); chartInstance = null; }

    switch (currentChartMode) {
      case 'climatogram':   renderClimatogramChart(canvasEl, results, unitName); break;
      case 'monthly':       renderMonthlyChart(canvasEl, results, unitName); break;
      case 'precipitation': renderMonthlyPrecipChart(canvasEl, results, unitName); break;
      case 'aggregate':     renderAggregateChart(canvasEl, results, indicatorKey, unitName, indicatorLabel); break;
      case 'comparison':    renderComparisonChart(canvasEl, results, indicatorKey, unitName, indicatorLabel); break;
    }
  }

  // ============================================================
  //   Public API
  // ============================================================
  function renderResultsChart(canvasEl, results, indicatorKey, unitName, indicatorLabel) {
    if (!canvasEl) return;

    currentChartData = { canvasEl, results, indicatorKey, unitName, indicatorLabel };

    const hasData = results.some(r => r.index != null && !isNaN(r.index));
    if (!hasData) { canvasEl.style.display = 'none'; return; }

    canvasEl.style.display = 'block';
    createChartToggle(canvasEl);
    renderChartByMode();
  }

  return { renderResultsChart };

})();
