const { pool } = require('./db');

async function checkColumns() {
  try {
    // Zkontrolovat co vrací SQL dotaz
    const result = await pool.query(`
      SELECT DISTINCT
        year,
        COUNT(*) as cnt,
        de_martonne,
        pet
      FROM climate_master_geom
      WHERE de_martonne IS NOT NULL
      GROUP BY year, de_martonne, pet
      LIMIT 10
    `);
    
    console.log('Sloupce de_martonne a pet:');
    result.rows.forEach(r => {
      console.log(`  Year ${r.year}: cnt=${r.cnt}, de_martonne=${r.de_martonne}, pet=${r.pet}`);
    });
    
    // Zkontrolovat NULL values
    const nullCheck = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN de_martonne IS NULL THEN 1 END) as null_de_martonne,
        COUNT(CASE WHEN pet IS NULL THEN 1 END) as null_pet
      FROM climate_master_geom
    `);
    
    console.log('\nNull check:');
    console.log(JSON.stringify(nullCheck.rows[0], null, 2));
    
  } catch (e) {
    console.error('❌', e.message);
  } finally {
    await pool.end();
  }
}

checkColumns();
