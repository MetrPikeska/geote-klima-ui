const { pool } = require('./db');

async function postTest() {
  try {
    // Get a CHKO geometry (use NAZEV uppercase)
    const chko = await pool.query(`SELECT ST_AsGeoJSON(geom) as geomjson, "NAZEV" as name FROM chko WHERE LOWER("NAZEV") LIKE '%beskydy%' LIMIT 1`);
    if (!chko.rows.length) {
      console.log('No CHKO matching Beskydy found.');
      await pool.end();
      return;
    }

    const geomJson = JSON.parse(chko.rows[0].geomjson);
    console.log('Using CHKO:', chko.rows[0].name);

    // POST to backend
    const body = { geometry: geomJson, label: chko.rows[0].name, export: 'geojson' };

    const res = await fetch('http://localhost:4000/climate/polygon?export=geojson', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    console.log('Response status:', res.status);
    const contentType = res.headers.get('content-type') || '';

    const fs = require('fs');

    if (contentType.includes('geo+json') || contentType.includes('application/json')) {
      const text = await res.text();
      // Try to parse to ensure valid JSON
      try {
        const parsed = JSON.parse(text);
        const outPath = `beskydy-climate-${Date.now()}.geojson`;
        fs.writeFileSync(outPath, JSON.stringify(parsed, null, 2));
        console.log('Saved GeoJSON to', outPath);
      } catch (e) {
        console.error('Failed to parse response as JSON for saving:', e.message);
        console.log('Raw response:', text.slice(0, 2000));
      }
    } else {
      const data = await res.json();
      console.log(JSON.stringify(data, null, 2));
    }

  } catch (e) {
    console.error('Error posting test:', e);
  } finally {
    await pool.end();
  }
}

postTest();
