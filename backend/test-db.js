// Quick database test script
require('dotenv').config();
const { pool } = require('./db');

async function testQuery() {
  try {
    console.log('🔍 Connecting to database...');
    const result = await pool.query('SELECT * FROM climate_master_geom LIMIT 3');
    console.log('✅ Query successful!');
    console.log('📊 Columns:', Object.keys(result.rows[0] || {}));
    console.log('📦 Row count:', result.rows.length);
    console.log('\n📋 First 3 rows:\n');
    console.table(result.rows);
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

testQuery();
