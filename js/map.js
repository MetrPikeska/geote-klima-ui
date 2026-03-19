// === map.js ===
// Module for map, polygon drawing, and WMS layer switching

window.ClimateApp = window.ClimateApp || {};

ClimateApp.map = (function () {

  let map;
  let currentBaseLayer = null;
  let katastrOverlay = null;
  let drawnItems;
  let drawControl;
  let unitLayer;
  let activeLayerKey = 'dark';

  // === S-JTSK (EPSG:5514) definition ===
  if (typeof proj4 !== 'undefined') {
    proj4.defs(
      'EPSG:5514',
      '+proj=krovak +lat_0=49.5 +lon_0=24.83333333333333 ' +
      '+k=-0.9999 +x_0=0 +y_0=0 +ellps=bessel +units=m +no_defs'
    );
  }

  // ============================================================
  //  Layer definitions
  // ============================================================
  const LAYERS = {
    dark: () => L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
      { maxZoom: 20, attribution: '© OpenStreetMap © CARTO' }
    ),

    osm: () => L.tileLayer(
      'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      { maxZoom: 19, attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' }
    ),

    ortofoto: () => L.tileLayer.wms(
      'https://ags.cuzk.cz/arcgis1/services/ORTOFOTO/MapServer/WMSServer',
      {
        layers: '0',
        format: 'image/jpeg',
        transparent: false,
        version: '1.3.0',
        maxZoom: 20,
        attribution: '© <a href="https://www.cuzk.cz">ČÚZK</a> – Ortofoto ČR',
      }
    ),

    katastrBase: () => L.tileLayer(
      'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      { maxZoom: 19, attribution: '© OpenStreetMap' }
    ),

    katastrWMS: () => L.tileLayer.wms(
      'https://services.cuzk.cz/wms/wms.asp',
      {
        layers: 'KN',
        format: 'image/png',
        transparent: true,
        version: '1.3.0',
        opacity: 0.85,
        maxZoom: 19,
        attribution: '© <a href="https://www.cuzk.cz">ČÚZK</a> – Katastr nemovitostí',
      }
    ),
  };

  // ============================================================
  //  Layer switching
  // ============================================================
  function switchLayer(key) {
    if (key === activeLayerKey) return;
    activeLayerKey = key;

    // Remove current base
    if (currentBaseLayer) { map.removeLayer(currentBaseLayer); currentBaseLayer = null; }
    // Remove katastr overlay if present
    if (katastrOverlay) { map.removeLayer(katastrOverlay); katastrOverlay = null; }

    if (key === 'katastr') {
      currentBaseLayer = LAYERS.katastrBase().addTo(map);
      katastrOverlay   = LAYERS.katastrWMS().addTo(map);
    } else {
      currentBaseLayer = LAYERS[key]().addTo(map);
    }

    // Update switcher button states
    document.querySelectorAll('.map-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.layer === key);
    });
  }

  // ============================================================
  //  Coordinate conversion
  // ============================================================
  function convertToWGS84IfNeeded(geojson) {
    function looksLikeWGS84(coords) {
      return coords.every(ring =>
        ring.every(([x, y]) => x >= -180 && x <= 180 && y >= -90 && y <= 90)
      );
    }
    function convertPolygon(coords) {
      return coords.map(ring =>
        ring.map(([x, y]) => { const [lon, lat] = proj4('EPSG:5514', 'EPSG:4326', [x, y]); return [lon, lat]; })
      );
    }
    if (geojson.type !== 'Feature') return geojson;
    const geom = geojson.geometry;
    if (geom.type === 'Polygon' && !looksLikeWGS84(geom.coordinates)) {
      geojson.geometry.coordinates = convertPolygon(geom.coordinates);
    }
    if (geom.type === 'MultiPolygon' && !looksLikeWGS84(geom.coordinates[0])) {
      geojson.geometry.coordinates = geom.coordinates.map(poly => convertPolygon(poly));
    }
    return geojson;
  }

  // ============================================================
  //  Map initialization
  // ============================================================
  function initMap() {
    map = L.map('map', { center: [49.8, 15.5], zoom: 7, zoomControl: false });

    L.control.zoom({ position: 'topright' }).addTo(map);
    L.control.scale({ position: 'bottomright', imperial: false }).addTo(map);

    // Initial base layer
    currentBaseLayer = LAYERS.dark().addTo(map);

    drawnItems = new L.FeatureGroup();
    map.addLayer(drawnItems);

    drawControl = new L.Control.Draw({
      position: 'topleft',
      draw: {
        polyline: false, rectangle: false, circle: false,
        circlemarker: false, marker: false,
        polygon: {
          allowIntersection: false,
          showArea: true,
          shapeOptions: { color: '#38bdf8', weight: 2 },
        },
      },
      edit: { featureGroup: drawnItems },
    });
    map.addControl(drawControl);

    map.on(L.Draw.Event.CREATED, event => {
      drawnItems.clearLayers();
      drawnItems.addLayer(event.layer);
      ClimateApp.state.customPolygon = event.layer.toGeoJSON();
    });

    // Wire map switcher buttons
    document.querySelectorAll('.map-btn').forEach(btn => {
      btn.addEventListener('click', () => switchLayer(btn.dataset.layer));
    });

    enableGeoJSONUpload();
  }

  // ============================================================
  //  Show ORP/CHKO geometry
  // ============================================================
  function showUnitGeometry(geom) {
    if (unitLayer) { map.removeLayer(unitLayer); unitLayer = null; }
    unitLayer = L.geoJSON(geom, {
      style: { color: '#a855f7', weight: 2, fillOpacity: 0.15 },
    }).addTo(map);
    map.fitBounds(unitLayer.getBounds());
  }

  // ============================================================
  //  GeoJSON upload
  // ============================================================
  function enableGeoJSONUpload() {
    const input = document.getElementById('geojsonUpload');
    if (!input) return;
    input.addEventListener('change', e => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = ev => {
        try {
          let geojson = JSON.parse(ev.target.result);
          if (geojson.type === 'FeatureCollection') {
            if (!geojson.features?.length) { alert('FeatureCollection is empty.'); return; }
            geojson = geojson.features[0];
          }
          geojson = convertToWGS84IfNeeded(geojson);
          drawnItems.clearLayers();
          const layer = L.geoJSON(geojson, {
            style: { color: '#38bdf8', weight: 2, fillOpacity: 0.2 },
          }).addTo(drawnItems);
          ClimateApp.state.customPolygon = geojson;
          map.fitBounds(layer.getBounds());
        } catch (err) {
          alert('File is not valid GeoJSON.');
          console.error(err);
        }
      };
      reader.readAsText(file);
    });
  }

  function resetMapToDefault() {
    if (unitLayer) { map.removeLayer(unitLayer); unitLayer = null; }
    map.setView([49.8, 15.5], 7);
  }

  return { initMap, showUnitGeometry, resetMapToDefault, switchLayer };

})();
