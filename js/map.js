// === map.js ===
// Modul pro mapu a kreslení polygonů

window.ClimateApp = window.ClimateApp || {};

ClimateApp.map = (function () {

  let map;
  let baseLayer;
  let drawnItems;
  let drawControl;
  let unitLayer;

  // === DEFINICE S-JTSK (EPSG:5514) pro proj4 ===
  if (typeof proj4 !== "undefined") {
    proj4.defs(
      "EPSG:5514",
      "+proj=krovak +lat_0=49.5 +lon_0=24.83333333333333 " +
      "+k=-0.9999 +x_0=0 +y_0=0 +ellps=bessel +units=m +no_defs"
    );
  }

  // === KONVERZE GEOJSON 5514 -> WGS84 (pouze pokud jsou souřadnice mimo rozsah WGS84) ===
  function convertToWGS84IfNeeded(geojson) {

    // WGS84 má lon -180 až 180, lat -90 až 90
    function looksLikeWGS84(coords) {
      return coords.every(ring =>
        ring.every(([x, y]) =>
          x >= -180 && x <= 180 && y >= -90 && y <= 90
        )
      );
    }

    function convertPolygon(coords) {
      return coords.map(ring =>
        ring.map(coord => {
          const [x, y] = coord;
          const [lon, lat] = proj4("EPSG:5514", "EPSG:4326", [x, y]);
          return [lon, lat];
        })
      );
    }

    // Pokud geojson není feature → přeskočit
    if (geojson.type !== "Feature") return geojson;

    const geom = geojson.geometry;

    if (geom.type === "Polygon") {
      if (!looksLikeWGS84(geom.coordinates)) {
        geojson.geometry.coordinates = convertPolygon(geom.coordinates);
      }
    }

    if (geom.type === "MultiPolygon") {
      if (!looksLikeWGS84(geom.coordinates[0])) {
        geojson.geometry.coordinates = geom.coordinates.map(poly =>
          convertPolygon(poly)
        );
      }
    }

    return geojson;
  }

  // === Inicializace mapy ===
  function initMap() {
    map = L.map("map", {
      center: [49.8, 15.5],
      zoom: 7,
      zoomControl: true,
    });

    baseLayer = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19
    }).addTo(map);

    drawnItems = new L.FeatureGroup();
    map.addLayer(drawnItems);

    drawControl = new L.Control.Draw({
      position: "topleft",
      draw: {
        polyline: false,
        rectangle: false,
        circle: false,
        circlemarker: false,
        marker: false,
        polygon: {
          allowIntersection: false,
          showArea: true,
          shapeOptions: {
            color: "#38bdf8",
            weight: 2
          }
        }
      },
      edit: {
        featureGroup: drawnItems
      }
    });

    map.addControl(drawControl);

    // === Po nakreslení polygonu ===
    map.on(L.Draw.Event.CREATED, event => {
      const layer = event.layer;

      drawnItems.clearLayers();
      drawnItems.addLayer(layer);

      ClimateApp.state.customPolygon = layer.toGeoJSON();
    });

    // Aktivujeme upload
    enableGeoJSONUpload();
  }

  // === Zobrazení polygonu ORP/CHKO ===
  function showUnitGeometry(geom) {

    if (unitLayer) {
      map.removeLayer(unitLayer);
      unitLayer = null;
    }

    unitLayer = L.geoJSON(geom, {
      style: {
        color: "#a855f7",
        weight: 2,
        fillOpacity: 0.15
      }
    }).addTo(map);

    map.fitBounds(unitLayer.getBounds());
  }

  // === Nahrání GeoJSON ===
  function enableGeoJSONUpload() {
    const input = document.getElementById("geojsonUpload");
    if (!input) return;

    input.addEventListener("change", e => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();

      reader.onload = event => {
        try {
          let geojson = JSON.parse(event.target.result);

          // 🟦 FeatureCollection → vezmeme první feature
          if (geojson.type === "FeatureCollection") {
            if (!geojson.features || geojson.features.length === 0) {
              alert("FeatureCollection neobsahuje žádné prvky.");
              return;
            }
            geojson = geojson.features[0];
            console.log("Converted FeatureCollection → Feature");
          }

          // 🟦 Konverze S-JTSK → WGS84 jen pokud to není WGS
          geojson = convertToWGS84IfNeeded(geojson);

          // 🟦 Vykreslení
          drawnItems.clearLayers();

          const layer = L.geoJSON(geojson, {
            style: {
              color: "#38bdf8",
              weight: 2,
              fillOpacity: 0.2
            }
          }).addTo(drawnItems);

          // 🟦 Uložit do app state
          ClimateApp.state.customPolygon = geojson;

          map.fitBounds(layer.getBounds());

        } catch (err) {
          alert("Soubor není platný GeoJSON.");
          console.error(err);
        }
      };

      reader.readAsText(file);
    });
  }

  return {
    initMap,
    showUnitGeometry
  };
})();
