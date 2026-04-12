// === ui.js ===

window.ClimateApp = window.ClimateApp || {};

ClimateApp.state = {
  units: {
    kraje: [],
    okresy: [],
    orp: [],
    obce: [],
    chko: [],
  },
  customPolygon: null,
  multiSelectMode: false,
  selectedIndices: new Set(),
  activeUnitType: 'kraje',
  activeIndicator: 'demartonne',
  activeNormal: 'new',
  loadedTypes: new Set(), // lazy-load tracking
};

document.addEventListener('DOMContentLoaded', () => {

  // ── DOM refs ──────────────────────────────────────────────────
  const unitTypeGrid    = document.getElementById('unitTypeGrid');
  const unitSearch      = document.getElementById('unitSearch');
  const unitSelect      = document.getElementById('unitSelect');
  const unitSearchSec   = document.getElementById('unitSearchSection');
  const customSection   = document.getElementById('customSection');
  const multiSelectCb   = document.getElementById('multiSelectMode');
  const selectionCount  = document.getElementById('selectionCount');
  const indicatorGrid   = document.getElementById('indicatorGrid');
  const normalSegs      = document.getElementById('normalSegs');
  const computeBtn      = document.getElementById('computeBtn');
  const computeAllBtn   = document.getElementById('computeAllBtn');
  const statusMessage   = document.getElementById('statusMessage');
  const stopwatch       = document.getElementById('stopwatch');
  const resultsSummary  = document.getElementById('resultsSummary');
  const resultsTableBody = document.querySelector('#resultsTable tbody');
  const resultsChartCanvas = document.getElementById('resultsChart');

  let stopwatchInterval = null;
  let currentChart = null;

  // ── Init ───────────────────────────────────────────────────────
  ClimateApp.map.initMap();
  loadUnits('kraje'); // load initial type eagerly

  // ── Stopwatch ──────────────────────────────────────────────────
  function startStopwatch() {
    stopStopwatch();
    const t0 = performance.now();
    stopwatch.textContent = 'Počítám…';
    stopwatchInterval = setInterval(() => {
      stopwatch.textContent = `Čas: ${((performance.now() - t0) / 1000).toFixed(1)} s`;
    }, 100);
  }
  function stopStopwatch() {
    clearInterval(stopwatchInterval);
    stopwatchInterval = null;
  }

  // ── Unit type switching ────────────────────────────────────────
  unitTypeGrid.querySelectorAll('.utype-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      unitTypeGrid.querySelectorAll('.utype-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const type = btn.dataset.type;
      ClimateApp.state.activeUnitType = type;
      ClimateApp.state.selectedIndices.clear();
      updateSelectionCount();

      if (type === 'custom') {
        unitSearchSec.style.display = 'none';
        customSection.style.display = '';
      } else {
        unitSearchSec.style.display = '';
        customSection.style.display = 'none';

        if (!ClimateApp.state.loadedTypes.has(type)) {
          loadUnits(type);
        } else {
          populateUnitSelect(type);
        }
      }
    });
  });

  // ── Search filtering ───────────────────────────────────────────
  unitSearch.addEventListener('input', () => {
    const q = unitSearch.value.trim().toLowerCase();
    const type = ClimateApp.state.activeUnitType;
    const all = ClimateApp.state.units[type] || [];

    const filtered = q
      ? all.filter(u => u.label.toLowerCase().includes(q))
      : all;

    renderUnitOptions(filtered);
  });

  // ── Unit list selection ────────────────────────────────────────
  unitSelect.addEventListener('change', () => {
    if (ClimateApp.state.multiSelectMode) {
      ClimateApp.state.selectedIndices.clear();
      Array.from(unitSelect.selectedOptions).forEach(opt => {
        if (opt.value) ClimateApp.state.selectedIndices.add(opt.value);
      });
      updateSelectionCount();
      return;
    }

    // Single select — highlight on map
    const type = ClimateApp.state.activeUnitType;
    const id = unitSelect.value;
    const list = ClimateApp.state.units[type] || [];
    const selected = list.find(u => String(u.id) === String(id));
    if (selected && ClimateApp.map.showUnitGeometry) {
      ClimateApp.map.showUnitGeometry(selected.geom);
    }
  });

  // ── Multi-select toggle ────────────────────────────────────────
  multiSelectCb.addEventListener('change', () => {
    ClimateApp.state.multiSelectMode = multiSelectCb.checked;
    ClimateApp.state.selectedIndices.clear();
    selectionCount.style.display = ClimateApp.state.multiSelectMode ? 'inline-flex' : 'none';
    computeBtn.style.display    = ClimateApp.state.multiSelectMode ? 'none' : '';
    computeAllBtn.style.display = ClimateApp.state.multiSelectMode ? '' : 'none';
    updateSelectionCount();
  });

  // ── Indicator chips ────────────────────────────────────────────
  indicatorGrid.querySelectorAll('.ind-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      indicatorGrid.querySelectorAll('.ind-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      ClimateApp.state.activeIndicator = btn.dataset.key;
    });
  });

  // ── Normal segmented control ───────────────────────────────────
  normalSegs.querySelectorAll('.norm-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      normalSegs.querySelectorAll('.norm-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      ClimateApp.state.activeNormal = btn.dataset.key;
    });
  });

  // ── Single calculation ─────────────────────────────────────────
  computeBtn.addEventListener('click', async () => {
    const selection = getCurrentSelection();
    if (!selection) {
      setStatus('Vyberte jednotku nebo nakreslete polygon.');
      return;
    }

    setStatus('Počítám…');
    computeBtn.classList.add('loading');
    computeBtn.disabled = true;
    startStopwatch();

    try {
      const climateData = await ClimateApp.api.fetchClimateForUnit(selection, dur => {
        stopStopwatch();
        stopwatch.textContent = `Čas výpočtu: ${(dur / 1000).toFixed(2)} s`;
      });

      const indicatorKey = ClimateApp.state.activeIndicator;
      const filtered = climateData.normals.filter(n => n.T != null);
      const filteredData = { ...climateData, normals: filtered };

      const results = ClimateApp.compute.computeForIndicator(filteredData, indicatorKey);
      const diffs   = filtered.length >= 2 ? ClimateApp.compute.computeDifferences(results) : {};

      renderResultsSummary(filteredData, results, diffs, indicatorKey);
      renderResultsTable(results);

      if (currentChart) { currentChart.destroy(); currentChart = null; }
      currentChart = ClimateApp.charts.renderResultsChart(
        resultsChartCanvas,
        results,
        indicatorKey,
        selection.label || 'Vlastní polygon',
        getIndicatorLabel(indicatorKey)
      );

      // Wire export button
      const exportBtn = document.getElementById('exportGeoBtn');
      exportBtn.style.display = 'inline-flex';
      exportBtn.onclick = () => handleExport(selection, exportBtn);

      setStatus('Výpočet dokončen.');
    } catch (err) {
      console.error(err);
      setStatus('Chyba při výpočtu.');
      stopStopwatch();
      stopwatch.textContent = 'Chyba';
    } finally {
      computeBtn.classList.remove('loading');
      computeBtn.disabled = false;
    }
  });

  // ── Batch calculation ──────────────────────────────────────────
  computeAllBtn.addEventListener('click', async () => {
    if (ClimateApp.state.selectedIndices.size === 0) {
      setStatus('Vyberte aspoň jednu jednotku.');
      return;
    }

    setStatus('Dávkový výpočet…');
    computeAllBtn.classList.add('loading');
    computeAllBtn.disabled = true;
    startStopwatch();

    try {
      const type = ClimateApp.state.activeUnitType;
      const units = ClimateApp.state.units[type] || [];
      const ids = Array.from(ClimateApp.state.selectedIndices);

      const selections = ids.map(id => {
        const unit = units.find(u => String(u.id) === String(id));
        return unit ? { type, id: unit.id, label: unit.label, geometry: unit.geom } : null;
      }).filter(Boolean);

      const batchData = await ClimateApp.api.fetchClimateForUnits(selections, dur => {
        stopStopwatch();
        stopwatch.textContent = `Čas: ${(dur / 1000).toFixed(2)} s`;
      });

      renderBatchResults(batchData, selections);
      setStatus(`Hotovo: ${batchData.results.length} jednotek.`);
    } catch (err) {
      console.error(err);
      setStatus('Chyba při dávkovém výpočtu.');
      stopStopwatch();
    } finally {
      computeAllBtn.classList.remove('loading');
      computeAllBtn.disabled = false;
    }
  });

  // ── Helpers ────────────────────────────────────────────────────

  async function loadUnits(type) {
    try {
      if (!ClimateApp.api?.fetchUnits) return;
      setStatus(`Načítám ${type}…`);
      const units = await ClimateApp.api.fetchUnits(type);
      ClimateApp.state.units[type] = units;
      ClimateApp.state.loadedTypes.add(type);
      if (type === ClimateApp.state.activeUnitType) {
        populateUnitSelect(type);
      }
      setStatus('');
    } catch (err) {
      console.error('loadUnits error:', err);
      setStatus(`Chyba načítání ${type}.`);
    }
  }

  function populateUnitSelect(type) {
    const units = [...(ClimateApp.state.units[type] || [])];
    units.sort((a, b) => a.label.localeCompare(b.label, 'cs'));
    renderUnitOptions(units);
  }

  function renderUnitOptions(units) {
    unitSelect.innerHTML = '';
    if (units.length === 0) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.disabled = true;
      opt.textContent = '— žádné výsledky —';
      unitSelect.appendChild(opt);
      return;
    }
    units.forEach(u => {
      const opt = document.createElement('option');
      opt.value = u.id;
      opt.textContent = u.label;
      unitSelect.appendChild(opt);
    });
  }

  function getCurrentSelection() {
    const type = ClimateApp.state.activeUnitType;

    if (type === 'custom') {
      if (!ClimateApp.state.customPolygon) return null;
      return { type: 'custom', label: 'Vlastní polygon', geometry: ClimateApp.state.customPolygon };
    }

    const id = unitSelect.value;
    if (!id) return null;

    const list = ClimateApp.state.units[type] || [];
    const unit = list.find(u => String(u.id) === String(id));
    if (!unit) return null;

    return { type, id: unit.id, label: unit.label, geometry: unit.geom };
  }

  function updateSelectionCount() {
    const n = ClimateApp.state.selectedIndices.size;
    selectionCount.textContent = `${n} vybráno`;
  }

  function setStatus(msg) {
    statusMessage.textContent = msg;
  }

  function getIndicatorLabel(key) {
    const labels = {
      demartonne: 'De Martonne AI',
      ldf:        'Lang LDF',
      pet:        'PET Thornthwaite',
      vpd:        'VPD (kPa)',
      mvj:        'MVJ (%)',
      kiz:        'KIZ (mm)',
      deltasra:   'Δ Srážky (mm)',
      deltat:     'Δ Teplota (°C)',
    };
    return labels[key] || key;
  }

  function normalClass(key) {
    return { old: 'mc-old', new: 'mc-new', future: 'mc-future' }[key] || '';
  }

  function fmt(v, digits = 2) {
    if (v == null) return '—';
    return Number(v).toFixed(digits);
  }

  // ── Render results summary ─────────────────────────────────────
  function renderResultsSummary(climateData, results, diffs, indicatorKey) {
    const name = climateData.unitName || 'Výsledky';
    const label = getIndicatorLabel(indicatorKey);
    const isDelta = indicatorKey === 'deltasra' || indicatorKey === 'deltat';
    const unit = { deltasra: 'mm', deltat: '°C', vpd: 'kPa', mvj: '%', kiz: 'mm', pet: 'mm/r' }[indicatorKey] || '';

    let html = `
      <div class="summary-header">
        <span class="summary-unit-name">${name}</span>
        <span class="summary-indicator">${label}</span>
      </div>
      <div class="metric-cards">
    `;

    results.forEach(r => {
      const val = r.index;
      const isNull = val == null;
      html += `
        <div class="metric-card ${normalClass(r.key)}">
          <div class="mc-period">${r.label}</div>
          <div class="mc-value ${isNull ? 'mc-null' : ''}">
            ${isNull ? '—' : fmt(val) + (isDelta && r.key !== 'old' && val >= 0 ? '' : '')}
            ${!isNull && unit ? `<span style="font-size:13px;font-weight:400;color:var(--t3);margin-left:2px">${unit}</span>` : ''}
          </div>
          <div class="mc-sub">T: ${fmt(r.T, 1)}°C &nbsp;·&nbsp; R: ${r.R != null ? Math.round(r.R) + ' mm' : '—'}</div>
        </div>
      `;
    });
    html += '</div>';

    // Delta chips (skip for delta-type indicators since the values ARE deltas)
    if (!isDelta) {
      const chips = [];
      if (diffs.oldNew?.deltaIndex != null) {
        const d = diffs.oldNew.deltaIndex;
        const cls = d > 0 ? 'pos' : d < 0 ? 'neg' : 'neutral';
        chips.push(`<span class="delta-chip ${cls}">Nový − Starý: ${d > 0 ? '+' : ''}${fmt(d)}</span>`);
      }
      if (diffs.newFuture?.deltaIndex != null) {
        const d = diffs.newFuture.deltaIndex;
        const cls = d > 0 ? 'pos' : d < 0 ? 'neg' : 'neutral';
        chips.push(`<span class="delta-chip ${cls}">2050 − Nový: ${d > 0 ? '+' : ''}${fmt(d)}</span>`);
      }
      if (chips.length) html += `<div class="delta-row">${chips.join('')}</div>`;
    }

    resultsSummary.innerHTML = html;
    document.getElementById('sheetTitle').textContent = name;
  }

  // ── Render results table ───────────────────────────────────────
  function renderResultsTable(results) {
    resultsTableBody.innerHTML = '';
    results.forEach(r => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${r.label}</td>
        <td>${fmt(r.T, 1)}</td>
        <td>${r.R != null ? Math.round(r.R) : '—'}</td>
        <td>${r.index != null ? fmt(r.index) : '—'}</td>
      `;
      resultsTableBody.appendChild(tr);
    });
  }

  // ── Render batch results ───────────────────────────────────────
  function renderBatchResults(batchData, selections) {
    if (ClimateApp.map.resetMapToDefault) ClimateApp.map.resetMapToDefault();

    const indicatorKey = ClimateApp.state.activeIndicator;

    resultsSummary.innerHTML = `
      <div class="summary-header">
        <span class="summary-unit-name">Dávkové výsledky</span>
        <span class="summary-indicator">${batchData.results.length} jednotek · ${getIndicatorLabel(indicatorKey)}</span>
      </div>
    `;
    document.getElementById('sheetTitle').textContent = 'Dávkové výsledky';

    resultsTableBody.innerHTML = '';
    batchData.results.forEach(result => {
      if (result.error) {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td><strong>${result.unitName}</strong></td><td colspan="3" style="color:var(--red)">⚠ ${result.error}</td>`;
        resultsTableBody.appendChild(tr);
        return;
      }
      if (!result.normals?.length) return;

      result.normals.forEach(normal => {
        if (normal.T == null) return;
        const computed = ClimateApp.compute.computeForIndicator({ normals: [normal] }, indicatorKey);
        const idx = computed[0]?.index;
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${result.unitName} <span style="color:var(--t3);font-size:10px">(${normal.key})</span></td>
          <td>${fmt(normal.T, 1)}</td>
          <td>${normal.R != null ? Math.round(normal.R) : '—'}</td>
          <td>${idx != null ? fmt(idx) : '—'}</td>
        `;
        resultsTableBody.appendChild(tr);
      });
    });

    // Batch comparison chart
    if (currentChart) { currentChart.destroy(); currentChart = null; }
    currentChart = renderBatchComparisonChart(resultsChartCanvas, batchData.results, indicatorKey);
  }

  function renderBatchComparisonChart(canvas, results, indicatorKey) {
    if (!canvas) return null;

    const labels = [];
    const dataNew = [];
    const dataFuture = [];

    results.forEach(r => {
      if (r.error || !r.normals) return;
      labels.push(r.unitName);

      const newN    = r.normals.find(n => n.key === 'new');
      const futureN = r.normals.find(n => n.key === 'future');

      const cn = ClimateApp.compute.computeForIndicator({ normals: newN    ? [newN]    : [] }, indicatorKey);
      const cf = ClimateApp.compute.computeForIndicator({ normals: futureN ? [futureN] : [] }, indicatorKey);

      dataNew.push(cn[0]?.index ?? null);
      dataFuture.push(cf[0]?.index ?? null);
    });

    const TITLE = 'oklch(93% 0.01 255)';
    const TICK  = 'oklch(62% 0.025 255)';
    const GRID  = 'oklch(26% 0.022 255 / 40%)';

    return new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { label: '1991–2020',  data: dataNew,    backgroundColor: 'oklch(72% 0.16 148 / 55%)', borderColor: 'oklch(72% 0.16 148)', borderWidth: 1 },
          { label: 'Predikce 2050', data: dataFuture, backgroundColor: 'oklch(70% 0.17 40 / 55%)', borderColor: 'oklch(70% 0.17 40)', borderWidth: 1 },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          title: { display: true, text: `${getIndicatorLabel(indicatorKey)} — srovnání`, color: TITLE, font: { size: 14, family: 'Syne' } },
          legend: { display: true, position: 'top', labels: { color: TITLE, usePointStyle: true, padding: 14, font: { size: 11 } } },
        },
        scales: {
          y: { title: { display: true, text: getIndicatorLabel(indicatorKey), color: TITLE, font: { size: 11 } }, ticks: { color: TICK }, grid: { color: GRID } },
          x: { ticks: { color: TICK }, grid: { color: GRID } },
        },
      },
    });
  }

  // ── GeoJSON export ─────────────────────────────────────────────
  async function handleExport(selection, btn) {
    btn.disabled = true;
    const origText = btn.querySelector('span')?.textContent;
    if (btn.querySelector('span')) btn.querySelector('span').textContent = '…';

    try {
      const fc = await ClimateApp.api.fetchClimateGeoJSON(selection);
      const blob = new Blob([JSON.stringify(fc, null, 2)], { type: 'application/geo+json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(selection.label || 'export').replace(/[^a-z0-9\-_]/gi, '_')}-klima.geojson`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert('Export selhal: ' + (e.message || e));
    } finally {
      btn.disabled = false;
      if (btn.querySelector('span')) btn.querySelector('span').textContent = origText || 'GeoJSON';
    }
  }

});
