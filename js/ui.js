// === ui.js s multi-select support ===

window.ClimateApp = window.ClimateApp || {};

ClimateApp.state = {
  units: {
    orp: [],
    chko: [],
  },
  customPolygon: null,
  multiSelectMode: false,
  selectedIndices: new Set() // Track selected unit indices in multi-select
};

document.addEventListener("DOMContentLoaded", () => {

  const unitTypeSelect = document.getElementById("unitTypeSelect");
  const unitSelect = document.getElementById("unitSelect");
  const multiSelectCheckbox = document.getElementById("multiSelectMode");
  const selectionCountLabel = document.getElementById("selectionCount");
  const customPolygonHint = document.getElementById("customPolygonHint");
  const computeBtn = document.getElementById("computeBtn");
  const computeAllBtn = document.getElementById("computeAllBtn");
  const statusMessage = document.getElementById("statusMessage");
  const resultsSummary = document.getElementById("resultsSummary");
  const resultsTableBody = document.querySelector("#resultsTable tbody");
  const resultsChartCanvas = document.getElementById("resultsChart");
  const stopwatch = document.getElementById("stopwatch");

  let stopwatchInterval;
  let calculationStartTime;
  let currentChart; // Track current chart instance

  function startStopwatch() {
    stopStopwatch();
    calculationStartTime = performance.now();
    stopwatch.textContent = "Calculating time...";
    stopwatchInterval = setInterval(() => {
      const elapsedTime = (performance.now() - calculationStartTime).toFixed(2);
      stopwatch.textContent = `Calculating time: ${elapsedTime} ms`;
    }, 100);
  }

  function stopStopwatch() {
    clearInterval(stopwatchInterval);
    stopwatchInterval = null;
  }

  ClimateApp.map.initMap();

  loadUnits("orp");
  loadUnits("chko");

  // === Multi-select checkbox handler ===
  multiSelectCheckbox.addEventListener("change", () => {
    ClimateApp.state.multiSelectMode = multiSelectCheckbox.checked;
    ClimateApp.state.selectedIndices.clear();
    selectionCountLabel.style.display = ClimateApp.state.multiSelectMode ? 'block' : 'none';
    computeBtn.style.display = ClimateApp.state.multiSelectMode ? 'none' : 'inline-block';
    computeAllBtn.style.display = ClimateApp.state.multiSelectMode ? 'inline-block' : 'none';
    updateSelectionCount();
  });

  // === Unit type switching ===
  unitTypeSelect.addEventListener("change", () => {
    const type = unitTypeSelect.value;

    if (type === "custom") {
      document.getElementById("unitSelectWrapper").style.display = "none";
      customPolygonHint.style.display = "block";
      document.getElementById("geojsonUploadWrapper").style.display = "block";
    } else {
      document.getElementById("unitSelectWrapper").style.display = "block";
      customPolygonHint.style.display = "none";
      document.getElementById("geojsonUploadWrapper").style.display = "none";
      populateUnitSelect(type);
    }

    ClimateApp.state.selectedIndices.clear();
    updateSelectionCount();
  });

  // === Multi-select: Unit selection ===
  unitSelect.addEventListener("change", (e) => {
    if (!ClimateApp.state.multiSelectMode) {
      // Single-select mode - handled below
      return;
    }

    // In multi-select mode with <select multiple>, options auto-select with Ctrl/Shift
    // Just rebuild selectedIndices from currently selected options
    ClimateApp.state.selectedIndices.clear();
    Array.from(unitSelect.selectedOptions).forEach(option => {
      const idx = Array.from(unitSelect.options).indexOf(option);
      if (idx > 0) { // Skip placeholder at index 0
        ClimateApp.state.selectedIndices.add(idx);
      }
    });
    updateSelectionCount();
  });

  // Add keyboard support for multi-select
  unitSelect.addEventListener("keydown", (e) => {
    if (!ClimateApp.state.multiSelectMode) return;
    
    const selectedIndex = unitSelect.selectedIndex;
    if (selectedIndex < 0) return;

    // On any key in multi-select, just update the indices
    setTimeout(() => {
      ClimateApp.state.selectedIndices.clear();
      Array.from(unitSelect.selectedOptions).forEach(option => {
        const idx = Array.from(unitSelect.options).indexOf(option);
        if (idx > 0) {
          ClimateApp.state.selectedIndices.add(idx);
        }
      });
      updateSelectionCount();
    }, 0);
  });

  // === Single-select: ORP/CHKO selection ===
  // This runs in parallel with the change handler above - change handler checks mode
  unitSelect.addEventListener("change", () => {
    // If multi-select mode, already handled above
    if (ClimateApp.state.multiSelectMode) return;

    const type = unitTypeSelect.value;
    const id = unitSelect.value;

    const list = ClimateApp.state.units[type] || [];
    const selected = list.find(u => String(u.id) === String(id));

    if (selected) {
      ClimateApp.map.showUnitGeometry(selected.geom);
    }
  });

  // === Single calculation ===
  computeBtn.addEventListener("click", async () => {
    statusMessage.textContent = "Calculating...";
    computeBtn.classList.add('loading');
    computeBtn.disabled = true;
    startStopwatch();

    try {
      const selection = getCurrentSelection();

      if (!selection) {
        statusMessage.textContent = "Select a unit or load/draw a polygon.";
        stopStopwatch();
        stopwatch.textContent = "Calculation time: 0.00 s";
        return;
      }

      const climateData = await ClimateApp.api.fetchClimateForUnit(selection, (duration) => {
        stopStopwatch();
        stopwatch.textContent = `Calculation time: ${duration} ms`;
      });

      const indicatorKey = document.getElementById("indicatorSelect").value;
      const filteredNormals = climateData.normals.filter(n => n.T != null);
      const filteredClimateData = { ...climateData, normals: filteredNormals };

      const results = ClimateApp.compute.computeForIndicator(filteredClimateData, indicatorKey);
      const diffs = filteredNormals.length >= 2 ? ClimateApp.compute.computeDifferences(results) : {};

      renderResultsSummary(resultsSummary, filteredClimateData, results, diffs, indicatorKey, climateData.normals);
      renderResultsTable(resultsTableBody, results, climateData.normals);

      if (currentChart) currentChart.destroy();
      currentChart = ClimateApp.charts.renderResultsChart(
        resultsChartCanvas,
        results,
        indicatorKey,
        selection.label || "Custom Polygon",
        indicatorKey === "demartonne" ? "De Martonne aridity index" : "Potential Evapotranspiration"
      );

      statusMessage.textContent = "Calculation complete.";

      // Show export button
      const exportBtn = document.getElementById('exportGeoBtn');
      exportBtn.style.display = 'inline-block';
      exportBtn.onclick = async () => {
        exportBtn.disabled = true;
        exportBtn.textContent = 'Preparing...';
        try {
          const sel = getCurrentSelection();
          const fc = await ClimateApp.api.fetchClimateGeoJSON(sel);
          const blob = new Blob([JSON.stringify(fc, null, 2)], { type: 'application/geo+json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          const name = (sel.label || 'export').replace(/[^a-z0-9\-\_]/gi, '_');
          a.download = `${name}-climate-${Date.now()}.geojson`;
          document.body.appendChild(a);
          a.click();
          a.remove();
          URL.revokeObjectURL(url);
        } catch (e) {
          alert('Export failed: ' + (e.message || e));
          console.error('Export error:', e);
        } finally {
          exportBtn.disabled = false;
          exportBtn.textContent = '↓ Export GeoJSON';
        }
      };

    } catch (err) {
      console.error(err);
      statusMessage.textContent = "Calculation error.";
      stopStopwatch();
      stopwatch.textContent = "Calculation time: Error";
    } finally {
      computeBtn.classList.remove('loading');
      computeBtn.disabled = false;
    }
  });

  // === Batch calculation ===
  computeAllBtn.addEventListener("click", async () => {
    if (ClimateApp.state.selectedIndices.size === 0) {
      alert("Select at least one unit (Shift+click)");
      return;
    }

    statusMessage.textContent = "Computing batch...";
    computeAllBtn.classList.add('loading');
    computeAllBtn.disabled = true;
    startStopwatch();

    try {
      const type = unitTypeSelect.value;
      const units = ClimateApp.state.units[type] || [];

      const selections = Array.from(ClimateApp.state.selectedIndices)
        .sort((a, b) => a - b)
        .map(idx => {
          const unit = units[idx - 1]; // -1 because idx=0 is placeholder
          return {
            type,
            id: unit.id,
            label: unit.label,
            geometry: unit.geom
          };
        });

      const batchData = await ClimateApp.api.fetchClimateForUnits(selections, (duration) => {
        stopStopwatch();
        stopwatch.textContent = `Calculation time: ${duration} ms`;
      });

      renderBatchResults(batchData, selections);
      statusMessage.textContent = `Batch complete: ${batchData.results.length} units computed.`;

    } catch (err) {
      console.error(err);
      statusMessage.textContent = "Batch computation error.";
      stopStopwatch();
      stopwatch.textContent = "Calculation time: Error";
    } finally {
      computeAllBtn.classList.remove('loading');
      computeAllBtn.disabled = false;
    }
  });

  // === Functions ===

  async function loadUnits(type) {
    try {
      if (!ClimateApp.api || !ClimateApp.api.fetchUnits) {
        console.warn("ClimateApp.api not available yet");
        return;
      }
      const units = await ClimateApp.api.fetchUnits(type);
      ClimateApp.state.units[type] = units;
      if (type === unitTypeSelect.value) {
        populateUnitSelect(type);
      }
    } catch (err) {
      console.error("Error loading units:", err);
    }
  }

  function populateUnitSelect(type) {
    const units = ClimateApp.state.units[type] || [];
    unitSelect.innerHTML = "";

    const defaultOpt = document.createElement("option");
    defaultOpt.value = "";
    defaultOpt.textContent = "— select —";
    unitSelect.appendChild(defaultOpt);

    units.sort((a, b) => a.label.localeCompare(b.label));

    units.forEach(u => {
      const opt = document.createElement("option");
      opt.value = u.id;
      opt.textContent = u.label;
      unitSelect.appendChild(opt);
    });
  }

  function getCurrentSelection() {
    const type = unitTypeSelect.value;

    if (type === "custom") {
      if (!ClimateApp.state.customPolygon) return null;
      return {
        type: "custom",
        label: "Custom Polygon",
        geometry: ClimateApp.state.customPolygon
      };
    }

    const id = unitSelect.value;
    if (!id) return null;

    const list = ClimateApp.state.units[type];
    const selected = list.find(u => String(u.id) === String(id));

    return {
      type,
      id: selected.id,
      label: selected.label,
      geometry: selected.geom
    };
  }

  function updateSelectionCount() {
    if (ClimateApp.state.multiSelectMode) {
      const count = ClimateApp.state.selectedIndices.size;
      selectionCountLabel.textContent = count > 0 ? `${count} selected` : 'No selection';
    }
  }

  function renderResultsSummary(container, climateData, results, diffs, indicatorKey, allNormals) {
    const indicatorName = indicatorKey === "demartonne"
      ? "De Martonne aridity index"
      : "Potential Evapotranspiration (Thornthwaite)";

    let html = `<p><strong>${climateData.unitName || "Selected unit"}</strong></p>`;
    html += `<p style="font-size:11px;color:var(--t3);margin-top:2px;">${indicatorName}</p>`;

    // Metric cards for each normal
    if (results.length > 0) {
      html += `<div class="metric-cards">`;
      results.forEach(r => {
        html += `
          <div class="metric-card">
            <div class="mc-label">${r.label}</div>
            <div class="mc-value">${r.index != null ? r.index.toFixed(2) : '—'}</div>
            <div class="mc-sub">T: ${r.T != null ? r.T.toFixed(1) + '°C' : '—'} · R: ${r.R != null ? Math.round(r.R) + ' mm' : '—'}</div>
          </div>`;
      });
      html += `</div>`;
    }

    // Delta chips
    const deltaChips = [];
    if (diffs.oldNew?.deltaIndex != null) {
      const d = diffs.oldNew.deltaIndex;
      const cls = d > 0 ? 'pos' : d < 0 ? 'neg' : 'neutral';
      const sign = d > 0 ? '+' : '';
      deltaChips.push(`<span class="delta-chip ${cls}">New − Old: ${sign}${d.toFixed(2)}</span>`);
    }
    if (diffs.newFuture?.deltaIndex != null) {
      const d = diffs.newFuture.deltaIndex;
      const cls = d > 0 ? 'pos' : d < 0 ? 'neg' : 'neutral';
      const sign = d > 0 ? '+' : '';
      deltaChips.push(`<span class="delta-chip ${cls}">Future − New: ${sign}${d.toFixed(2)}</span>`);
    }
    if (deltaChips.length > 0) {
      html += `<div class="delta-row">${deltaChips.join('')}</div>`;
    }

    container.innerHTML = html;
  }

  function renderResultsTable(tbody, results, allNormals) {
    tbody.innerHTML = "";

    results.forEach(r => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${r.label}</td>
        <td>${r.T?.toFixed(2) || ""}</td>
        <td>${r.R?.toFixed(1) || ""}</td>
        <td>${r.index?.toFixed(2) || ""}</td>`;
      tbody.appendChild(tr);
    });
  }

  function renderBatchResults(batchData, selections) {
    // Reset map to default position when multiple units are selected
    if (ClimateApp.state.multiSelectMode && ClimateApp.state.selectedIndices.size > 1) {
      ClimateApp.map.resetMapToDefault();
    }

    resultsSummary.innerHTML = `<p><strong>Batch Results: ${batchData.results.length} units</strong></p>`;

    const tbody = resultsTableBody;
    tbody.innerHTML = "";

    batchData.results.forEach(result => {
      if (result.error) {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td><strong>${result.unitName}</strong></td>
          <td colspan="3" style="color: red;">⚠️ ${result.error}</td>`;
        tbody.appendChild(tr);
        return;
      }

      if (!result.normals || result.normals.length === 0) return;

      // Render row per normal
      result.normals.forEach((normal, idx) => {
        if (normal.T == null || normal.R == null) return;

        const indicatorKey = document.getElementById("indicatorSelect").value;
        const computed = ClimateApp.compute.computeForIndicator(
          { normals: [normal] },
          indicatorKey
        );
        const index = computed[0]?.index || "—";

        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${result.unitName} (${normal.key})</td>
          <td>${normal.T?.toFixed(2) || ""}</td>
          <td>${normal.R?.toFixed(1) || ""}</td>
          <td>${index !== "—" ? Number(index).toFixed(2) : "—"}</td>`;
        tbody.appendChild(tr);
      });
    });

    // Draw comparison chart (De Martonne across all units)
    const indicatorKey = document.getElementById("indicatorSelect").value;
    currentChart = renderBatchComparisonChart(resultsChartCanvas, batchData.results, indicatorKey);
  }

  function renderBatchComparisonChart(canvas, results, indicatorKey) {
    if (!canvas) return null;

    // Properly destroy existing chart instance before creating new one
    if (currentChart) {
      if (typeof currentChart.destroy === 'function') {
        try {
          currentChart.destroy();
        } catch (e) {
          console.warn('Error destroying previous chart:', e);
        }
      }
      currentChart = null;
    }

    const labels = [];
    const dataNew = [];
    const dataFuture = [];

    results.forEach(r => {
      if (r.error || !r.normals) return;
      labels.push(r.unitName);

      const newNormal = r.normals.find(n => n.key === 'new');
      const futureNormal = r.normals.find(n => n.key === 'future');

      const newComputed = ClimateApp.compute.computeForIndicator({ normals: [newNormal] }, indicatorKey);
      const futureComputed = ClimateApp.compute.computeForIndicator({ normals: [futureNormal] }, indicatorKey);

      dataNew.push(newComputed[0]?.index || null);
      dataFuture.push(futureComputed[0]?.index || null);
    });

    const indicatorLabel = indicatorKey === "demartonne" ? "De Martonne Index" : "PET";

    const TITLE_COLOR = '#e5e7eb';
    const TICK = '#94a3b8';
    const GRID = 'rgba(148, 163, 184, 0.15)';

    return new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'New Normal (1991–2020)',
            data: dataNew,
            backgroundColor: 'rgba(56, 189, 248, 0.55)',
            borderColor: 'rgba(56, 189, 248, 0.9)',
            borderWidth: 1,
          },
          {
            label: 'Prediction 2050',
            data: dataFuture,
            backgroundColor: 'rgba(167, 139, 250, 0.55)',
            borderColor: 'rgba(167, 139, 250, 0.9)',
            borderWidth: 1,
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          title: {
            display: true,
            text: `${indicatorLabel} — Batch Comparison`,
            color: TITLE_COLOR,
            font: { size: 15 },
          },
          legend: {
            display: true,
            position: 'top',
            labels: { color: TITLE_COLOR, usePointStyle: true, padding: 14, font: { size: 11 } },
          },
        },
        scales: {
          y: {
            beginAtZero: false,
            title: { display: true, text: indicatorLabel, color: TITLE_COLOR, font: { size: 11 } },
            ticks: { color: TICK },
            grid: { color: GRID },
          },
          x: {
            ticks: { color: TICK },
            grid: { color: GRID },
          },
        },
      }
    });
  }

});
