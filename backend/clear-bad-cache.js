// Clear corrupted cache entries with NULL temperature data
const { pool } = require('./db.js');

async function clearBadCache() {
  try {
    // Delete cache entries where temperature data is NULL (indicates computation failure)
    const result = await pool.query(`
      DELETE FROM climate_results_cache 
      WHERE new_normal_t IS NULL 
         OR new_normal_r IS NULL 
         OR new_normal_temps IS NULL
    `);
    
    console.log(`✓ Deleted ${result.rowCount} corrupted cache entries`);
    
    // Show remaining count
    const countResult = await pool.query(`
      SELECT COUNT(*) as count FROM climate_results_cache
    `);
    
    console.log(`✓ Remaining cache entries: ${countResult.rows[0].count}`);
    
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

clearBadCache();
