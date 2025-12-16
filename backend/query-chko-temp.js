// Query CHKO areas with average temperature
require('dotenv').config();
const { pool } = require('./db');

async function queryCHKOTemperatures() {
  try {
    console.log('🔍 Querying CHKO areas with average temperatures...\n');

    const sql = `
      WITH chko_climate AS (
        SELECT
          c."NAZEV" AS chko_name,
          AVG(cm.tavg_avg) AS avg_temperature,
          COUNT(DISTINCT cm.year) AS year_count
        FROM public.chko c
        LEFT JOIN climate_master_geom cm
          ON ST_Intersects(c.geom, cm.geom)
        WHERE cm.tavg_avg IS NOT NULL
        GROUP BY c."NAZEV"
        ORDER BY c."NAZEV"
      )
      SELECT
        chko_name AS "CHKO",
        ROUND(avg_temperature::numeric, 2) AS "Průměrná teplota (°C)",
        year_count AS "Počet let s daty"
      FROM chko_climate;
    `;

    const result = await pool.query(sql);

    console.log('✅ Query successful!');
    console.log(`📊 Found ${result.rows.length} CHKO areas\n`);

    console.table(result.rows);

    // Summary
    if (result.rows.length > 0) {
      const temps = result.rows.map(r => parseFloat(r['Průměrná teplota (°C)']));
      const avgTemp = (temps.reduce((a, b) => a + b, 0) / temps.length).toFixed(2);
      console.log(`\n📈 Overall average temperature across all CHKO: ${avgTemp}°C`);
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

queryCHKOTemperatures();
