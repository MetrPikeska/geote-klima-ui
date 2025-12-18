require('dotenv').config();
const { pool } = require('./db');

(async () => {
  try {
    const result = await pool.query(
      'DELETE FROM climate_results_cache WHERE unit_id = $1',
      ['Brdy']
    );
    console.log('✓ Brdy cache deleted:', result.rowCount, 'rows');
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
})();
