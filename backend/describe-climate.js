const { pool } = require('./db');

async function describeTable() {
  try {
    const columns = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'climate_master_geom'
      ORDER BY ordinal_position
    `);
    
    console.log('climate_master_geom columns:');
    columns.rows.forEach(c => {
      console.log(`  ${c.column_name}: ${c.data_type}`);
    });
    
    // Check actual data
    console.log('\nSample data:');
    const sample = await pool.query(`SELECT * FROM climate_master_geom LIMIT 1`);
    if (sample.rows[0]) {
      console.log(JSON.stringify(sample.rows[0], null, 2));
    }
    
  } catch (e) {
    console.error('❌ Error:', e.message);
  } finally {
    await pool.end();
  }
}

describeTable();
