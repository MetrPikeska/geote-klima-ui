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
  unitSelect.addEventListener("click", (e) => {
    if (!ClimateApp.state.multiSelectMode) return;

    if (!(e.target instanceof HTMLOptionElement)) return;

    const idx = Array.from(unitSelect.options).indexOf(e.target);
    if (idx <= 0) return; // Skip placeholder

    if (e.shiftKey || e.ctrlKey) {
      e.preventDefault();
      e.target.selected = !e.target.selected;

      if (e.target.selected) {
        ClimateApp.state.selectedIndices.add(idx);
      } else {
        ClimateApp.state.selectedIndices.delete(idx);
      }

      updateSelectionCount();
    }
  });

  // === Single-select: ORP/CHKO selection ===
  if (!ClimateApp.state.multiSelectMode) {
    unitSelect.addEventListener("change", () => {
      const type = unitTypeSelect.value;
      const id = unitSelect.value;

      const list = ClimateApp.state.units[type] || [];
      const selected = list.find(u => String(u.id) === String(id));

      if (selected) {
        ClimateApp.map.showUnitGeometry(selected.geom);
      }
    });
  }

  // === Single calculation ===
  computeBtn.addEventListener("click", async () => {
    statusMessage.textContent = "Calculating...";
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
      const filteredNormals = climateData.normals.filter(n => n.T != null && n.R != null);
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
          exportBtn.textContent = 'Export GeoJSON';
        }
      };

    } catch (err) {
      console.error(err);
      statusMessage.textContent = "Calculation error.";
      stopStopwatch();
      stopwatch.textContent = "Calculation time: Error";
    }
  });

  // === Batch calculation ===
  computeAllBtn.addEventListener("click", async () => {
    if (ClimateApp.state.selectedIndices.size === 0) {
      alert("Select at least one unit (Shift+click)");
      return;
    }

    statusMessage.textContent = "Computing batch...";
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
      stopwatch.textContent = "Error";
    }
  });

  // === Functions ===

  async function loadUnits(type) {
    try {
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
    let html = "";

    const indicatorName =
      indicatorKey === "demartonne"
        ? "De Martonne aridity index"
        : "Potential Evapotranspiration (Thornthwaite)";

    html += `<p><strong>${climateData.unitName || "selected unit"}</strong></p>`;
    html += `<p>Selected indicator: <strong>${indicatorName}</strong></p>`;

    if (diffs.oldNew) {
      html += `<p>New - Old: ΔT = ${diffs.oldNew.deltaT?.toFixed(2)}, ΔR = ${diffs.oldNew.deltaR?.toFixed(1)}, ΔIndex = ${diffs.oldNew.deltaIndex?.toFixed(2)}</p>`;
    }

    if (diffs.newFuture) {
      html += `<p>Prediction - New: ΔT = ${diffs.newFuture.deltaT?.toFixed(2)}, ΔR = ${diffs.newFuture.deltaR?.toFixed(1)}, ΔIndex = ${diffs.newFuture.deltaIndex?.toFixed(2)}</p>`;
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
    if (currentChart) currentChart.destroy();
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

      const newNormal = r.normals.find(n => n.key === 'new');
      const futureNormal = r.normals.find(n => n.key === 'future');

      const newComputed = ClimateApp.compute.computeForIndicator({ normals: [newNormal] }, indicatorKey);
      const futureComputed = ClimateApp.compute.computeForIndicator({ normals: [futureNormal] }, indicatorKey);

      dataNew.push(newComputed[0]?.index || null);
      dataFuture.push(futureComputed[0]?.index || null);
    });

    const indicatorLabel = indicatorKey === "demartonne" ? "De Martonne Index" : "PET";

    return new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'New Normal (1991-2020)',
            data: dataNew,
            backgroundColor: 'rgba(54, 162, 235, 0.7)'
          },
          {
            label: 'Prediction 2050',
            data: dataFuture,
            backgroundColor: 'rgba(255, 99, 132, 0.7)'
          }
        ]
      },
      options: {
        responsive: true,
        plugins: {
          title: { display: true, text: `${indicatorLabel} Comparison Across Units` },
          legend: { display: true }
        },
        scales: {
          y: { beginAtZero: true, title: { display: true, text: indicatorLabel } }
        }
      }
    });
  }

});
