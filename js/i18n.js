// === i18n.js ===
// CS / EN překlady

window.ClimateApp = window.ClimateApp || {};

ClimateApp.i18n = (function () {

  const DICT = {
    // ── Brand ──────────────────────────────────────────────
    'brand.sub':          { cs: 'Klimatická analýza ČR',    en: 'Climate Analysis CZ' },

    // ── Map switcher ───────────────────────────────────────
    'map.dark':           { cs: 'Mapa',     en: 'Map' },
    'map.osm':            { cs: 'OSM',      en: 'OSM' },
    'map.aerial':         { cs: 'Letecká',  en: 'Aerial' },
    'map.cadastre':       { cs: 'Katastr',  en: 'Cadastre' },

    // ── Unit type section ──────────────────────────────────
    'section.unit':       { cs: 'Územní jednotka',   en: 'Administrative unit' },
    'utype.kraje':        { cs: 'Kraj',    en: 'Region' },
    'utype.okresy':       { cs: 'Okres',   en: 'District' },
    'utype.orp':          { cs: 'ORP',     en: 'ORP' },
    'utype.obce':         { cs: 'Obec',    en: 'Municipality' },
    'utype.chko':         { cs: 'CHKO/NP', en: 'CHKO/NP' },
    'utype.custom':       { cs: 'Vlastní', en: 'Custom' },

    // ── Unit search ────────────────────────────────────────
    'section.select':     { cs: 'Vybrat jednotku',   en: 'Select unit' },
    'search.placeholder': { cs: 'Hledat…',            en: 'Search…' },
    'select.loading':     { cs: 'Načítám…',           en: 'Loading…' },

    // ── Custom polygon ─────────────────────────────────────
    'custom.hint':        { cs: 'Nakreslete polygon nástrojem na mapě, nebo nahrajte GeoJSON soubor.',
                            en: 'Draw a polygon using the map tool, or upload a GeoJSON file.' },
    'custom.upload':      { cs: 'Nahrát GeoJSON / S-JTSK', en: 'Upload GeoJSON / S-JTSK' },

    // ── Multi-select ───────────────────────────────────────
    'multi.label':        { cs: 'Multi-výběr', en: 'Multi-select' },
    'multi.count':        { cs: '{n} vybráno', en: '{n} selected' },

    // ── Indicator section ──────────────────────────────────
    'section.indicator':  { cs: 'Klimatický ukazatel', en: 'Climate indicator' },
    'ind.demartonne':     { cs: 'De Martonne', en: 'De Martonne' },
    'ind.ldf':            { cs: 'Lang LDF',    en: 'Lang LDF' },
    'ind.pet':            { cs: 'PET',         en: 'PET' },
    'ind.vpd':            { cs: 'VPD',         en: 'VPD' },
    'ind.mvj':            { cs: 'MVJ',         en: 'MVJ' },
    'ind.kiz':            { cs: 'KIZ',         en: 'KIZ' },
    'ind.deltasra':       { cs: 'Δ Srážky',    en: 'Δ Precip.' },
    'ind.deltat':         { cs: 'Δ Teplota',   en: 'Δ Temp.' },

    'ind.demartonne.title': { cs: 'De Martonne index aridity: AI = R / (T + 10)',
                              en: 'De Martonne aridity index: AI = R / (T + 10)' },
    'ind.ldf.title':        { cs: 'Langův dešťový faktor: LDF = R / T',
                              en: "Lang's rain factor: LDF = R / T" },
    'ind.pet.title':        { cs: 'Potenciální evapotranspirace — Thornthwaite',
                              en: 'Potential evapotranspiration — Thornthwaite' },
    'ind.vpd.title':        { cs: 'Vapor Pressure Deficit',
                              en: 'Vapor Pressure Deficit' },
    'ind.mvj.title':        { cs: 'Minářova vláhová jistota (veg. období 4–9)',
                              en: "Minář's moisture reliability (growing season 4–9)" },
    'ind.kiz.title':        { cs: 'Končekův index zavlažení (léto 6–8)',
                              en: "Konček's irrigation index (summer 6–8)" },
    'ind.deltasra.title':   { cs: 'Rozdíl srážek mezi normálami (Δ mm / %)',
                              en: 'Precipitation difference between normals (Δ mm / %)' },
    'ind.deltat.title':     { cs: 'Rozdíl teplot mezi normálami (Δ °C)',
                              en: 'Temperature difference between normals (Δ °C)' },

    // ── Climate normal ─────────────────────────────────────
    'section.normal':     { cs: 'Klimatický normál', en: 'Climate normal' },

    // ── Buttons ────────────────────────────────────────────
    'btn.compute':        { cs: 'Vypočítat',     en: 'Calculate' },
    'btn.computeAll':     { cs: 'Vypočítat vše', en: 'Calculate all' },

    // ── Results sheet ──────────────────────────────────────
    'sheet.title':        { cs: 'Výsledky analýzy', en: 'Analysis results' },
    'sheet.placeholder':  { cs: 'Vyberte územní jednotku a spusťte výpočet.',
                            en: 'Select an administrative unit and start the calculation.' },
    'table.normal':       { cs: 'Normál', en: 'Normal' },
    'table.index':        { cs: 'Index',  en: 'Index' },

    // ── Dynamic UI strings (used in ui.js) ─────────────────
    'status.computing':   { cs: 'Počítám…',             en: 'Calculating…' },
    'status.done':        { cs: 'Výpočet dokončen.',     en: 'Calculation complete.' },
    'status.error':       { cs: 'Chyba při výpočtu.',   en: 'Calculation error.' },
    'status.loading':     { cs: 'Načítám {type}…',      en: 'Loading {type}…' },
    'status.loadErr':     { cs: 'Chyba načítání {type}.', en: 'Error loading {type}.' },
    'status.noSelection': { cs: 'Vyberte jednotku nebo nakreslete polygon.',
                            en: 'Select a unit or draw a polygon.' },
    'status.batchDone':   { cs: 'Hotovo: {n} jednotek.', en: 'Done: {n} units.' },
    'status.batchComputing': { cs: 'Dávkový výpočet…',  en: 'Batch calculation…' },
    'status.noSelection2':{ cs: 'Vyberte aspoň jednu jednotku.',
                            en: 'Select at least one unit.' },

    'timer.computing':    { cs: 'Počítám…',                        en: 'Calculating…' },
    'timer.done':         { cs: 'Čas výpočtu: {t} s',             en: 'Computation time: {t} s' },
    'timer.error':        { cs: 'Chyba',                           en: 'Error' },
    'timer.elapsed':      { cs: 'Čas: {t} s',                     en: 'Time: {t} s' },

    // ── Normal labels (returned from backend) ──────────────
    'normal.old':         { cs: 'Starý normál (≤1990)',    en: 'Old normal (≤1990)' },
    'normal.new':         { cs: 'Nový normál (1991–2020)', en: 'New normal (1991–2020)' },
    'normal.future':      { cs: 'Predikce 2050 (≥2041)',   en: 'Forecast 2050 (≥2041)' },

    // ── Summary labels ─────────────────────────────────────
    'diff.oldNew':        { cs: 'Nový − Starý',        en: 'New − Old' },
    'diff.newFuture':     { cs: 'Predikce 2050 − Nový', en: 'Forecast 2050 − New' },
    'batch.title':        { cs: 'Dávkové výsledky',    en: 'Batch results' },
    'batch.subtitle':     { cs: '{n} jednotek · {ind}', en: '{n} units · {ind}' },

    // ── Indicator labels (for charts/summaries) ────────────
    'indlabel.demartonne': { cs: 'De Martonne AI',   en: 'De Martonne AI' },
    'indlabel.ldf':        { cs: 'Lang LDF',          en: 'Lang LDF' },
    'indlabel.pet':        { cs: 'PET Thornthwaite',  en: 'PET Thornthwaite' },
    'indlabel.vpd':        { cs: 'VPD (kPa)',         en: 'VPD (kPa)' },
    'indlabel.mvj':        { cs: 'MVJ (%)',            en: 'MVJ (%)' },
    'indlabel.kiz':        { cs: 'KIZ (mm)',           en: 'KIZ (mm)' },
    'indlabel.deltasra':   { cs: 'Δ Srážky (mm)',      en: 'Δ Precip. (mm)' },
    'indlabel.deltat':     { cs: 'Δ Teplota (°C)',     en: 'Δ Temp. (°C)' },

    // ── Chart labels ───────────────────────────────────────
    'chart.comparison':   { cs: '{ind} — srovnání',   en: '{ind} — comparison' },
    'chart.new':          { cs: '1991–2020',           en: '1991–2020' },
    'chart.future':       { cs: 'Predikce 2050',       en: 'Forecast 2050' },

    // ── Accessibility / titles ─────────────────────────────
    'sidebar.close':      { cs: 'Zavřít panel',  en: 'Close panel' },
    'conn.title':         { cs: 'Stav spojení',  en: 'Connection status' },
    'mobile.open':        { cs: 'Otevřít panel', en: 'Open panel' },
    'close.sheet':        { cs: 'Zavřít',        en: 'Close' },
  };

  let _lang = localStorage.getItem('geote_lang') || 'cs';

  function t(key, vars = {}) {
    const entry = DICT[key];
    if (!entry) return key;
    let str = entry[_lang] || entry['cs'] || key;
    for (const [k, v] of Object.entries(vars)) {
      str = str.replace(`{${k}}`, v);
    }
    return str;
  }

  function getLang() { return _lang; }

  function setLang(lang) {
    _lang = lang;
    localStorage.setItem('geote_lang', lang);
    applyToDOM();
    document.documentElement.lang = lang;
  }

  function applyToDOM() {
    // Text content
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.dataset.i18n;
      el.textContent = t(key);
    });
    // Placeholder
    document.querySelectorAll('[data-i18n-ph]').forEach(el => {
      el.placeholder = t(el.dataset.i18nPh);
    });
    // Title attribute
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
      el.title = t(el.dataset.i18nTitle);
    });
    // HTML content (for elements needing innerHTML)
    document.querySelectorAll('[data-i18n-html]').forEach(el => {
      el.innerHTML = t(el.dataset.i18nHtml);
    });

    // Update lang toggle button
    const btn = document.getElementById('langToggleBtn');
    if (btn) btn.textContent = _lang === 'cs' ? 'EN' : 'CS';
  }

  function toggle() {
    setLang(_lang === 'cs' ? 'en' : 'cs');
  }

  function init() {
    applyToDOM();
  }

  return { t, getLang, setLang, toggle, init };

})();
