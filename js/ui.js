// === ui.js ===
// Uživatelské rozhraní, ovládání a logika aplikace

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

  ClimateApp.map.initMap();

  loadUnits("orp");
  loadUnits("chko");

  // === Přepínání typu jednotky ===
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

  // === Výběr ORP/CHKO ===
  unitSelect.addEventListener("change", () => {
    const type = unitTypeSelect.value;
    const id = unitSelect.value;

    const list = ClimateApp.state.units[type] || [];
    const selected = list.find(u => String(u.id) === String(id));

    if (selected) {
      ClimateApp.map.showUnitGeometry(selected.geom);
    }
  });

  // === Výpočet ===
  computeBtn.addEventListener("click", async () => {
    statusMessage.textContent = "Počítám…";

    try {
      const selection = getCurrentSelection();
      if (!selection) {
        statusMessage.textContent = "Vyber jednotku nebo načti/nakresli polygon.";
        return;
      }

      const climateData = await ClimateApp.api.fetchClimateForUnit(selection);
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
        selection.label || "Vlastní polygon",
        indicatorKey === "demartonne"
          ? "De Martonne aridity index"
          : "Potenciální evapotranspirace"
      );

      statusMessage.textContent = "Výpočet dokončen.";

    } catch (err) {
      console.error(err);
      statusMessage.textContent = "Chyba při výpočtu.";
    }
  });

  // === Funkce ===

  async function loadUnits(type) {
    try {
      const units = await ClimateApp.api.fetchUnits(type);
      ClimateApp.state.units[type] = units;
      if (type === unitTypeSelect.value) {
        populateUnitSelect(type);
      }
    } catch (err) {
      console.error("Chyba při načítání jednotek:", err);
    }
  }

  function populateUnitSelect(type) {
    const units = ClimateApp.state.units[type] || [];
    unitSelect.innerHTML = "";

    const defaultOpt = document.createElement("option");
    defaultOpt.value = "";
    defaultOpt.textContent = "— vyber —";
    unitSelect.appendChild(defaultOpt);

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
        label: "Vlastní polygon",
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
        : "Potenciální evapotranspirace (Thornthwaite)";

    html += `<p><strong>${climateData.unitName || "vybraná jednotka"}</strong></p>`;
    html += `<p>Vybraný ukazatel: <strong>${indicatorName}</strong></p>`;

    if (diffs.oldNew) {
      html += `<p>Nový - Starý: ΔT = ${diffs.oldNew.deltaT?.toFixed(2)}, ΔR = ${diffs.oldNew.deltaR?.toFixed(1)}, ΔIndex = ${diffs.oldNew.deltaIndex?.toFixed(2)}</p>`;
    }

    if (diffs.newFuture) {
      html += `<p>Predikce - Nový: ΔT = ${diffs.newFuture.deltaT?.toFixed(2)}, ΔR = ${diffs.newFuture.deltaR?.toFixed(1)}, ΔIndex = ${diffs.newFuture.deltaIndex?.toFixed(2)}</p>`;
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
