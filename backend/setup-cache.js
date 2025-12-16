// Setup cache table
require('dotenv').config();
const { pool } = require('./db');
const fs = require('fs');

async function setupCache() {
  try {
    console.log('🔧 Setting up cache table...\n');

    const sql = fs.readFileSync('./create-cache-table.sql', 'utf8');

    await pool.query(sql);

    console.log('✅ Cache table created successfully!');
    console.log('📊 Verifying table...\n');

    const verify = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'climate_results_cache'
      ORDER BY ordinal_position;
    `);

    console.table(verify.rows);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

setupCache();
