const { pool } = require('./db');

async function testBeskydy() {
  try {
    // Najít CHKO Beskydy
    const chko = await pool.query(`
      SELECT id, nazev, ST_AsText(ST_Centroid(geom)) as center
      FROM chko
      WHERE LOWER(nazev) LIKE '%beskydy%'
      LIMIT 1
    `);
    
    if (chko.rows.length === 0) {
      console.log('❌ CHKO Beskydy not found');
      return;
    }
    
    console.log('✅ CHKO found:', chko.rows[0]);
    
    // Test same query as backend uses
    const sql = `
      WITH poly AS (
        SELECT geom FROM chko
        WHERE LOWER(nazev) LIKE '%beskydy%'
        LIMIT 1
      ),
      inter AS (
        SELECT
          c.*,
          ST_Area(ST_Intersection(c.geom, p.geom)) AS area_intersect,
          ST_Area(p.geom) AS area_poly
        FROM climate_master_geom c
        CROSS JOIN poly p
        WHERE ST_Intersects(c.geom, p.geom)
      ),
      weights AS (
        SELECT *,
          area_intersect / NULLIF(area_poly, 0) AS weight
        FROM inter
        WHERE area_intersect > 0
      )
      SELECT
        year,
        COUNT(*) as cnt,
        SUM(weight * tavg_avg) AS T_year,
        SUM(weight * (
          sra_m1 + sra_m2 + sra_m3 + sra_m4 + sra_m5 + sra_m6 +
          sra_m7 + sra_m8 + sra_m9 + sra_m10 + sra_m11 + sra_m12
        )) AS R_year
      FROM weights
      GROUP BY year
      ORDER BY year DESC
      LIMIT 5
    `;
    
    const result = await pool.query(sql);
    console.log('\nQuery result (first 5 years):');
    console.log(JSON.stringify(result.rows, null, 2));
    
    if (result.rows.length === 0) {
      console.log('⚠️  No data found for Beskydy CHKO');
    }
    
  } catch (e) {
    console.error('❌ Error:', e.message);
    console.error(e);
  } finally {
    await pool.end();
  }
}

testBeskydy();
