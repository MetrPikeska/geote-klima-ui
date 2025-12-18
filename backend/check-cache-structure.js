// Check cache table structure
const { pool } = require('./db.js');

async function checkStructure() {
  try {
    const res = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name='climate_results_cache'
      ORDER BY ordinal_position
    `);
    
    console.log('Cache table columns:');
    res.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type}`);
    });
    
    // Also show sample data
    const sample = await pool.query(`
      SELECT * FROM climate_results_cache LIMIT 1
    `);
    
    if (sample.rows.length > 0) {
      console.log('\nSample record keys:', Object.keys(sample.rows[0]));
    }
    
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

checkStructure();
