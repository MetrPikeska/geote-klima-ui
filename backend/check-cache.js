require('dotenv').config();
const { pool } = require('./db');

async function check() {
  const result = await pool.query(
    'SELECT unit_id, old_normal_temps FROM climate_results_cache WHERE unit_id = $1 LIMIT 1',
    ['Beskydy']
  );
  
  if (result.rows.length === 0) {
    console.log('No cache for Beskydy');
    return;
  }
  
  const row = result.rows[0];
  console.log('Unit:', row.unit_id);
  console.log('Temps type:', typeof row.old_normal_temps);
  console.log('Temps value (first 500 chars):', String(row.old_normal_temps).substring(0, 500));
  
  // Try to parse it
  try {
    let parsed;
    if (typeof row.old_normal_temps === 'string') {
      parsed = JSON.parse(row.old_normal_temps);
    } else {
      parsed = row.old_normal_temps;
    }
    console.log('✓ Successfully parsed');
    console.log('Parsed:', parsed);
  } catch (e) {
    console.error('✗ Parse error:', e.message);
    console.error('Full temps:', row.old_normal_temps);
  }
  
  process.exit(0);
}

check().catch(err => {
  console.error('DB error:', err);
  process.exit(1);
});
