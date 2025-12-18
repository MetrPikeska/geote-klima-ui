const { pool } = require('./db');

async function testQuery() {
  try {
    // Simulace Beskydy CHKO - vezmu nějaké data z climate_master_geom
    const testResult = await pool.query(`
      SELECT 
        year,
        COUNT(*) as cnt,
        AVG(tavg_avg) as avg_temp,
        SUM(sra_m1 + sra_m2 + sra_m3 + sra_m4 + sra_m5 + sra_m6 +
            sra_m7 + sra_m8 + sra_m9 + sra_m10 + sra_m11 + sra_m12) as total_rainfall
      FROM climate_master_geom
      WHERE naz_ku LIKE '%Beskydy%' OR naz_obec LIKE '%Beskydy%'
      GROUP BY year
      ORDER BY year DESC
      LIMIT 5
    `);
    
    console.log('Beskydy test query results:');
    console.log(JSON.stringify(testResult.rows, null, 2));
    
    if (testResult.rows.length === 0) {
      console.log('\n❌ No data for Beskydy found. Checking available data...');
      
      const sampleData = await pool.query(`
        SELECT DISTINCT naz_obec, naz_ku, COUNT(*) as cnt
        FROM climate_master_geom
        GROUP BY naz_obec, naz_ku
        ORDER BY cnt DESC
        LIMIT 10
      `);
      
      console.log('\nSample data available:');
      sampleData.rows.forEach(r => {
        console.log(`  ${r.naz_obec} / ${r.naz_ku} - ${r.cnt} records`);
      });
    }
    
  } catch (e) {
    console.error('❌ Query error:', e.message);
    console.error('Details:', e);
  } finally {
    await pool.end();
  }
}

testQuery();
