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
  let allUnitsLayer = null;
  let highlightedLeafletLayer = null;
  let activeLayerKey = 'osm';

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

    // Initial base layer (OSM matches light theme)
    currentBaseLayer = LAYERS.osm().addTo(map);

    drawnItems = new L.FeatureGroup();
    map.addLayer(drawnItems);

    drawControl = new L.Control.Draw({
      position: 'topright',
      draw: {
        polyline: false, rectangle: false, circle: false,
        circlemarker: false, marker: false,
        polygon: {
          allowIntersection: false,
          showArea: true,
          shapeOptions: { color: 'oklch(42% 0.14 165)', weight: 2, fillOpacity: 0.12 },
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
  //  Show all units as interactive layer
  // ============================================================
  function showAllUnits(units, onUnitClick) {
    if (allUnitsLayer) { map.removeLayer(allUnitsLayer); allUnitsLayer = null; }
    highlightedLeafletLayer = null;
    if (!units || units.length === 0) return;

    const ACC = '#1a6b58'; // forest teal — matches CSS --acc
    const STYLE_DEFAULT  = { color: ACC, weight: 0.8, fillColor: ACC, fillOpacity: 0.04, opacity: 0.55 };
    const STYLE_HOVER    = { color: ACC, weight: 1.8, fillColor: ACC, fillOpacity: 0.16, opacity: 1 };
    const STYLE_SELECTED = { color: ACC, weight: 2.5, fillColor: ACC, fillOpacity: 0.26, opacity: 1 };

    const features = units.map(u => ({
      type: 'Feature',
      geometry: u.geom,
      properties: { id: u.id, label: u.label },
      _unit: u,
    }));

    allUnitsLayer = L.geoJSON({ type: 'FeatureCollection', features }, {
      style: STYLE_DEFAULT,
      onEachFeature(feature, layer) {
        layer._unit = feature._unit || units.find(u => String(u.id) === String(feature.properties.id));

        // Tooltip: bind without sticky — open/close manually to prevent accumulation
        layer.bindTooltip(feature.properties.label, {
          permanent: false,
          sticky: false,
          className: 'unit-tooltip',
          direction: 'top',
          offset: [0, -6],
        });

        layer.on({
          mouseover(e) {
            if (e.target !== highlightedLeafletLayer) e.target.setStyle(STYLE_HOVER);
            e.target.bringToFront();
            e.target.openTooltip();
          },
          mouseout(e) {
            if (e.target !== highlightedLeafletLayer) allUnitsLayer.resetStyle(e.target);
            e.target.closeTooltip();
          },
          click(e) {
            // Stop propagation to prevent bounding-box focus ring
            L.DomEvent.stopPropagation(e);
            if (e.originalEvent) e.originalEvent.stopPropagation();
            e.target.closeTooltip();

            if (highlightedLeafletLayer) allUnitsLayer.resetStyle(highlightedLeafletLayer);
            highlightedLeafletLayer = e.target;
            e.target.setStyle(STYLE_SELECTED);
            e.target.bringToFront();
            if (onUnitClick && layer._unit) onUnitClick(layer._unit);
          },
        });
      },
    }).addTo(map);
  }

  function highlightUnitOnMap(unitId) {
    if (!allUnitsLayer) return;
    const ACC = '#1a6b58';
    const STYLE_SELECTED = { color: ACC, weight: 2.5, fillColor: ACC, fillOpacity: 0.26, opacity: 1 };
    allUnitsLayer.eachLayer(layer => {
      if (layer._unit && String(layer._unit.id) === String(unitId)) {
        if (highlightedLeafletLayer) allUnitsLayer.resetStyle(highlightedLeafletLayer);
        highlightedLeafletLayer = layer;
        layer.setStyle(STYLE_SELECTED);
        layer.bringToFront();
      }
    });
  }

  // ============================================================
  //  Show single unit geometry (legacy / fallback)
  // ============================================================
  function showUnitGeometry(geom) {
    if (unitLayer) { map.removeLayer(unitLayer); unitLayer = null; }
    unitLayer = L.geoJSON(geom, {
      style: { color: '#1a6b58', weight: 2, fillOpacity: 0.12 },
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
            style: { color: '#1a6b58', weight: 2, fillOpacity: 0.12 },
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
    if (allUnitsLayer) { map.removeLayer(allUnitsLayer); allUnitsLayer = null; }
    highlightedLeafletLayer = null;
    map.setView([49.8, 15.5], 7);
  }

  return { initMap, showUnitGeometry, showAllUnits, highlightUnitOnMap, resetMapToDefault, switchLayer };

})();
