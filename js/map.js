// === map.js ===
// Module for map and polygon drawing

window.ClimateApp = window.ClimateApp || {};

ClimateApp.map = (function () {

  let map;
  let baseLayer;
  let drawnItems;
  let drawControl;
  let unitLayer;

  // === S-JTSK (EPSG:5514) definition for proj4 ===
  if (typeof proj4 !== "undefined") {
    proj4.defs(
      "EPSG:5514",
      "+proj=krovak +lat_0=49.5 +lon_0=24.83333333333333 " +
      "+k=-0.9999 +x_0=0 +y_0=0 +ellps=bessel +units=m +no_defs"
    );
  }

  // === GEOJSON 5514 -> WGS84 CONVERSION (only if coordinates are outside WGS84 range) ===
  function convertToWGS84IfNeeded(geojson) {

    // WGS84 has lon -180 to 180, lat -90 to 90
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

    // If geojson is not a feature → skip
    if (geojson.type !== "Feature") return geojson;

    const geom = geojson.geometry;

    if (geom.type === "Polygon") {
      if (!looksLikeWGS84(geom.coordinates)) {
        geojson.geometry.coordinates = convertPolygon(geom.coordinates);
      }
    }

    if (geom.type === "MultiPolygon") {
      if (!looksLikeWGS4(geom.coordinates[0])) {
        geojson.geometry.coordinates = geom.coordinates.map(poly =>
          convertPolygon(poly)
        );
      }
    }

    return geojson;
  }

  // === Generates HTML content for a Leaflet popup ===
  function getPopupContent(properties) { // ADDED: Function to generate popup content
    let content = "<h4>Polygon Info</h4>";
    if (properties) {
      for (const key in properties) {
        if (Object.hasOwnProperty.call(properties, key)) {
          const value = properties[key];
          // Basic check for non-object values to display
          if (typeof value !== 'object' && typeof value !== 'function') {
            content += `<p><strong>${key}:</strong> ${value}</p>`;
          }
        }
      }
    } else {
      content += "<p>No properties available.</p>";
    }

    // ADDED: Approximate area calculation for custom polygons if no area property is found
    if (!properties || !properties.area) {
      // This is a placeholder. Accurate area calculation for arbitrary polygons requires a library like turf.js
      // For demonstration, we can add a note or a very basic approximation if needed.
      content += "<p>Area calculation not available or approximate.</p>";
    }

    return content;
  }

  // === Map Initialization ===
  function initMap() {
    map = L.map("map", {
      center: [49.8, 15.5],
      zoom: 7,
      zoomControl: true,
    });

    baseLayer = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19
    }).addTo(map);

    L.control.scale().addTo(map); // Scale control

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

    // === After drawing a polygon ===
    map.on(L.Draw.Event.CREATED, event => {
      const layer = event.layer;

      drawnItems.clearLayers();
      drawnItems.addLayer(layer);

      ClimateApp.state.customPolygon = layer.toGeoJSON();
      // No popup binding
    });

    // Enable upload
    enableGeoJSONUpload();
  }

  // === Displaying ORP/CHKO polygon ===
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
      },
      onEachFeature: function(feature, layer) { 
        // No popup binding
      }
    }).addTo(map);

    map.fitBounds(unitLayer.getBounds());
  }

  // === GeoJSON Upload ===
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

          // FeatureCollection → take the first feature
          if (geojson.type === "FeatureCollection") {
            if (!geojson.features || geojson.features.length === 0) {
              alert("FeatureCollection contains no features.");
              return;
            }
            geojson = geojson.features[0];
            console.log("Converted FeatureCollection → Feature");
          }

          // Convert S-JTSK → WGS84 only if it`s not WGS
          geojson = convertToWGS84IfNeeded(geojson);

          // Render
          drawnItems.clearLayers();

          const layer = L.geoJSON(geojson, {
            style: {
              color: "#38bdf8",
              weight: 2,
              fillOpacity: 0.2
            },
            onEachFeature: function(feature, layer) {
              // No popup binding
            }
          }).addTo(drawnItems);

          // Save to app state
          ClimateApp.state.customPolygon = geojson;

          map.fitBounds(layer.getBounds());
          // No openPopup()

        } catch (err) {
          alert("File is not a valid GeoJSON.");
          console.error(err);
        }
      };

      reader.readAsText(file);
    });
  }

  function resetMapToDefault() {
    // Remove the unit layer if displayed
    if (unitLayer) {
      map.removeLayer(unitLayer);
      unitLayer = null;
    }
    // Reset map to default center and zoom
    map.setView([49.8, 15.5], 7);
  }

  return {
    initMap,
    showUnitGeometry,
    resetMapToDefault
  };
})();
