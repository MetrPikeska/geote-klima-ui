// Check CHKO table structure
require('dotenv').config();
const { pool } = require('./db');

async function checkCHKOStructure() {
  try {
    console.log('🔍 Checking CHKO table structure...\n');

    // Get column names
    const columnsQuery = `
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'chko'
      ORDER BY ordinal_position;
    `;

    const columns = await pool.query(columnsQuery);
    console.log('📋 CHKO table columns:');
    console.table(columns.rows);

    // Get sample data
    const sampleQuery = 'SELECT * FROM public.chko LIMIT 3';
    const sample = await pool.query(sampleQuery);
    console.log('\n📊 Sample data (first 3 rows):');
    console.table(sample.rows);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkCHKOStructure();
