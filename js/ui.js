// === ui.js ===
// User interface, controls, and application logic

window.ClimateApp = window.ClimateApp || {};

ClimateApp.state = {
  units: {
    orp: [],
    chko: [],
  },
  customPolygon: null,
};

document.addEventListener("DOMContentLoaded", () => {

  const unitTypeSelect = document.getElementById("unitTypeSelect");
  const unitSelect = document.getElementById("unitSelect");
  const customPolygonHint = document.getElementById("customPolygonHint");
  const computeBtn = document.getElementById("computeBtn");
  const statusMessage = document.getElementById("statusMessage");
  const resultsSummary = document.getElementById("resultsSummary");
  const resultsTableBody = document.querySelector("#resultsTable tbody");
  const resultsChartCanvas = document.getElementById("resultsChart");
  const stopwatch = document.getElementById("stopwatch"); // Get stopwatch element

  let stopwatchInterval; // ADDED: Global interval variable
  let calculationStartTime; // ADDED: To store start time for running stopwatch

  function startStopwatch() { // ADDED: Start stopwatch function
    stopStopwatch(); // Clear any existing interval
    calculationStartTime = performance.now();
    stopwatch.textContent = "Calculating time..."; // Initial message
    stopwatchInterval = setInterval(() => {
      const elapsedTime = (performance.now() - calculationStartTime).toFixed(2);
      stopwatch.textContent = `Calculating time: ${elapsedTime} ms`;
    }, 100); // Update every 100 milliseconds
  }

  function stopStopwatch() { // ADDED: Stop stopwatch function
    clearInterval(stopwatchInterval);
    stopwatchInterval = null;
  }

  ClimateApp.map.initMap();

  loadUnits("orp");
  loadUnits("chko");

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
  });

  // === ORP/CHKO selection ===
  unitSelect.addEventListener("change", () => {
    const type = unitTypeSelect.value;
    const id = unitSelect.value;

    const list = ClimateApp.state.units[type] || [];
    const selected = list.find(u => String(u.id) === String(id));

    if (selected) {
      ClimateApp.map.showUnitGeometry(selected.geom);
    }
  });

  // === Calculation ===
  computeBtn.addEventListener("click", async () => {
    statusMessage.textContent = "Calculating..."; // Translated
    startStopwatch(); // ADDED: Start the running stopwatch

    try {
      const selection = getCurrentSelection();
      if (!selection) {
        statusMessage.textContent = "Select a unit or load/draw a polygon."; // Translated
        stopStopwatch(); // ADDED: Stop stopwatch on no selection
        stopwatch.textContent = "Calculation time: 0.00 s"; // Reset if no selection
        return;
      }

      // Pass updateStopwatch function as callback
      const climateData = await ClimateApp.api.fetchClimateForUnit(selection, (duration) => {
        stopStopwatch(); // ADDED: Stop the running stopwatch
        stopwatch.textContent = `Calculation time: ${duration} ms`;
      });
      const indicatorKey = document.getElementById("indicatorSelect").value;

      const filteredNormals = climateData.normals.filter(n => n.T != null && n.R != null);
      const filteredClimateData = { ...climateData, normals: filteredNormals };

      const results = ClimateApp.compute.computeForIndicator(filteredClimateData, indicatorKey);
      const diffs = filteredNormals.length >= 2
        ? ClimateApp.compute.computeDifferences(results)
        : {};

      renderResultsSummary(resultsSummary, filteredClimateData, results, diffs, indicatorKey, climateData.normals);
      renderResultsTable(resultsTableBody, results, climateData.normals);

      ClimateApp.charts.renderResultsChart(
        resultsChartCanvas,
        results,
        indicatorKey,
        selection.label || "Custom Polygon", // Translated
        indicatorKey === "demartonne"
          ? "De Martonne aridity index"
          : "Potential Evapotranspiration"
      );

      statusMessage.textContent = "Calculation complete."; // Translated

    } catch (err) {
      console.error(err);
      statusMessage.textContent = "Calculation error."; // Translated
      stopStopwatch(); // ADDED: Stop stopwatch on error
      stopwatch.textContent = "Calculation time: Error"; // Indicate error on stopwatch
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
    defaultOpt.textContent = "— select —"; // Translated
    unitSelect.appendChild(defaultOpt);

    // Sort units alphabetically by label
    units.sort((a, b) => a.label.localeCompare(b.label)); // ADDED: Sorting

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
        label: "Custom Polygon", // Translated
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

  function renderResultsSummary(container, climateData, results, diffs, indicatorKey, allNormals) {
    let html = "";

    const indicatorName =
      indicatorKey === "demartonne"
        ? "De Martonne aridity index"
        : "Potential Evapotranspiration (Thornthwaite)";

    html += `<p><strong>${climateData.unitName || "selected unit"}</strong></p>`; // Translated
    html += `<p>Selected indicator: <strong>${indicatorName}</strong></p>`; // Translated

    if (diffs.oldNew) {
      html += `<p>New - Old: ΔT = ${diffs.oldNew.deltaT?.toFixed(2)}, ΔR = ${diffs.oldNew.deltaR?.toFixed(1)}, ΔIndex = ${diffs.oldNew.deltaIndex?.toFixed(2)}</p>`; // Translated
    }

    if (diffs.newFuture) {
      html += `<p>Prediction - New: ΔT = ${diffs.newFuture.deltaT?.toFixed(2)}, ΔR = ${diffs.newFuture.deltaR?.toFixed(1)}, ΔIndex = ${diffs.newFuture.deltaIndex?.toFixed(2)}</p>`; // Translated
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

});
