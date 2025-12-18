// === api.js ===
// Communication with OGC API Features + Node backend for climate calculations

window.ClimateApp = window.ClimateApp || {};

ClimateApp.config = {
  BASE_API_URL: "http://localhost:9000",   // pg-featureserv
  TILE_URL: "http://localhost:7800/public.climate_master_geom/{z}/{x}/{y}.png",
  BACKEND_URL: "http://localhost:4000"     // Node backend
};

ClimateApp.api = (function () {

  /**
   * Fetches a list of ORP or CHKO units from pg-featureserv
   */
  async function fetchUnits(type) {
    let collectionId;
    let labelProp;

    if (type === "orp") {
      collectionId = "public.orp";
      labelProp = "NAZ_ORP";
    } else if (type === "chko") {
      collectionId = "public.chko";
      labelProp = "NAZEV";
    } else {
      return [];
    }

    const url = `${ClimateApp.config.BASE_API_URL}/collections/${collectionId}/items?limit=500`;

    try {
      const res = await fetch(url);
      const data = await res.json();
      const features = data.features || [];

      return features.map((f) => ({
        id: f.id ?? f.properties?.id ?? f.properties?.[labelProp],
        label: f.properties?.[labelProp],
        geom: f.geometry,
        properties: f.properties
      }));

    } catch (err) {
      console.error("fetchUnits error:", err);
      return [];
    }
  }


  /**
   * ON-THE-FLY calculation for:
   * - custom polygon
   * - ORP polygon (geometry from pg-featureserv)
   * - CHKO polygon (geometry from pg-featureserv)
   */
  async function fetchClimateForUnit(selection, onComplete = () => {}) {

    const startTime = performance.now();
    try {
      const res = await fetch(`${ClimateApp.config.BACKEND_URL}/climate/polygon`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          geometry: selection.geometry,
          label: selection.label
        })
      });

      const endTime = performance.now();
      const duration = (endTime - startTime).toFixed(2);
      onComplete(duration);

      // Check if response is OK
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({
          error: 'Unknown error',
          message: `HTTP ${res.status}: ${res.statusText}`
        }));

        throw {
          status: res.status,
          error: errorData.error || 'Request failed',
          message: errorData.message || res.statusText,
          details: errorData.details,
          duration: duration
        };
      }

      const data = await res.json();
      return { ...data, duration: duration };

    } catch (err) {
      const endTime = performance.now();
      const duration = (endTime - startTime).toFixed(2);
      onComplete(duration);

      console.error("Backend error during climate data calculation:", err);

      // Network error (fetch failed completely)
      if (err instanceof TypeError && err.message.includes('fetch')) {
        alert(`❌ Chyba spojení se serverem!\n\nNelze se připojit k backendu na ${ClimateApp.config.BACKEND_URL}\n\nZkontrolujte, zda backend běží (start.bat).`);
        throw {
          error: 'Network error',
          message: 'Cannot connect to backend server',
          duration: duration
        };
      }

      // Backend returned an error response
      if (err.status) {
        const errorMsg = err.message || err.error || 'Neznámá chyba';
        alert(`❌ Chyba při výpočtu klimatických dat!\n\n${errorMsg}\n\n${err.details || ''}`);
        throw err;
      }

      // Unknown error
      alert(`❌ Neočekávaná chyba!\n\n${err.message || err}`);
      throw { error: err, duration: duration };
    }
  }

  // Request GeoJSON export (returns parsed JSON FeatureCollection)
  async function fetchClimateGeoJSON(selection) {
    try {
      const res = await fetch(`${ClimateApp.config.BACKEND_URL}/climate/polygon?export=geojson`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/geo+json,application/json" },
        body: JSON.stringify({ geometry: selection.geometry, label: selection.label, export: 'geojson' })
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        throw new Error(`Export failed: HTTP ${res.status} ${res.statusText} ${txt}`);
      }

      const text = await res.text();
      return JSON.parse(text);
  // Batch compute for multiple selections
  async function fetchClimateForUnits(selections, onProgress = () => {}) {
    const startTime = performance.now();
    try {
      const geometries = selections.map(s => s.geometry);
      const labels = selections.map(s => s.label);

      const res = await fetch(`${ClimateApp.config.BACKEND_URL}/climate/polygon`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ geometries, labels })
      });

      const endTime = performance.now();
      const duration = (endTime - startTime).toFixed(2);
      onProgress(duration);

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({
          error: 'Unknown error',
          message: `HTTP ${res.status}: ${res.statusText}`
        }));

        throw {
          status: res.status,
          error: errorData.error || 'Request failed',
          message: errorData.message || res.statusText,
          duration: duration
        };
      }

      const data = await res.json();
      return { ...data, duration: duration };

    } catch (err) {
      const endTime = performance.now();
      const duration = (endTime - startTime).toFixed(2);
      onProgress(duration);

      console.error("Batch compute error:", err);

      if (err instanceof TypeError && err.message.includes('fetch')) {
        alert(`❌ Chyba spojení!\n\nNelze se připojit k backendu na ${ClimateApp.config.BACKEND_URL}`);
        throw {
          error: 'Network error',
          message: 'Cannot connect to backend',
          duration: duration
        };
      }

      if (err.status) {
        alert(`❌ Chyba při výpočtu!\n\n${err.message || err.error}`);
        throw err;
      }

      alert(`❌ Neočekávaná chyba!\n\n${err.message || err}`);
      throw { error: err, duration: duration };
    }
  }

  return {
    fetchUnits,
    fetchClimateForUnit,
    fetchClimateGeoJSON,
    fetchClimateForUnits
  };

})();
