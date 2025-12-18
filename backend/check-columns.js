require('dotenv').config();
const { pool } = require('./db');

(async () => {
  try {
    const result = await pool.query(
      `SELECT * FROM climate_master_geom LIMIT 1`
    );
    if (result.rows.length > 0) {
      console.log('Column names in result:');
      console.log(Object.keys(result.rows[0]));
    }
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
})();
