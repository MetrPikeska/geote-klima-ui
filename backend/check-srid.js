require('dotenv').config();
const { pool } = require('./db');

(async () => {
  try {
    // Check SRID of climate table geoms
    const climateGeomInfo = await pool.query(`
      SELECT 
        ST_SRID(geom) as srid,
        COUNT(*) as count,
        ST_AsText(ST_Envelope(ST_Collect(geom))) as bbox
      FROM climate_master_geom
      LIMIT 1
    `);
    
    console.log('Climate table geometry SRID info:', climateGeomInfo.rows[0]);
    
    // Check one example geometry
    const sample = await pool.query(`
      SELECT 
        areaid,
        ST_AsText(geom) as geom_text,
        ST_SRID(geom) as srid
      FROM climate_master_geom
      LIMIT 1
    `);
    
    if (sample.rows.length > 0) {
      console.log('\nSample geometry from climate table:');
      console.log('  areaid:', sample.rows[0].areaid);
      console.log('  SRID:', sample.rows[0].srid);
      console.log('  Geom (first 100 chars):', sample.rows[0].geom_text.substring(0, 100));
    }
    
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
})();
