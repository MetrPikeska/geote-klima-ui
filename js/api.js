// === api.js ===
// Komunikace s OGC API Features + Node backend pro klimatické výpočty

window.ClimateApp = window.ClimateApp || {};

ClimateApp.config = {
  BASE_API_URL: "http://localhost:9000",   // pg-featureserv
  TILE_URL: "http://localhost:7800/public.climate_master_geom/{z}/{x}/{y}.png",
  BACKEND_URL: "http://localhost:4000"     // Node backend
};

ClimateApp.api = (function () {

  /**
   * Načte seznam ORP nebo CHKO z pg-featureserv
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
   * ON-THE-FLY výpočet pro:
   * - vlastní polygon
   * - ORP polygon (geometrie z pg-featureserv)
   * - CHKO polygon (geometrie z pg-featureserv)
   */
  async function fetchClimateForUnit(selection) {

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
      const duration = (endTime - startTime).toFixed(2); // in milliseconds

      const data = await res.json();
      return { ...data, duration: duration };

    } catch (err) {
      const endTime = performance.now();
      const duration = (endTime - startTime).toFixed(2); // in milliseconds
      console.error("Chyba backendu při výpočtu klimatických dat:", err);
      throw { error: err, duration: duration }; // Also pass duration on error
    }
  }


  return {
    fetchUnits,
    fetchClimateForUnit,
  };

})();
