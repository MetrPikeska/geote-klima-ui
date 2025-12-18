const { pool } = require('./db');

async function getCeladnaTemperature() {
  try {
    console.log('🔍 Hledání průměrné roční teploty pro obec Čeladná...\n');
    
    const result = await pool.query(`
      SELECT 
        naz_obec,
        year,
        ROUND(tavg_avg::numeric, 2) as prumer_teplota_c,
        ROUND(tavg_m1::numeric, 2) as led,
        ROUND(tavg_m2::numeric, 2) as unor,
        ROUND(tavg_m3::numeric, 2) as brezen,
        ROUND(tavg_m4::numeric, 2) as duben,
        ROUND(tavg_m5::numeric, 2) as kveten,
        ROUND(tavg_m6::numeric, 2) as cerven,
        ROUND(tavg_m7::numeric, 2) as cervenec,
        ROUND(tavg_m8::numeric, 2) as srpen,
        ROUND(tavg_m9::numeric, 2) as zari,
        ROUND(tavg_m10::numeric, 2) as rijen,
        ROUND(tavg_m11::numeric, 2) as listopad,
        ROUND(tavg_m12::numeric, 2) as prosinec
      FROM climate_master_geom
      WHERE LOWER(naz_obec) LIKE '%celadna%'
      ORDER BY year DESC
    `);
    
    if (result.rows.length === 0) {
      console.log('❌ Obec Čeladná nenalezena v databázi.');
      return;
    }
    
    console.log(`✅ Nalezeno: ${result.rows.length} záznamů pro obec Čeladná\n`);
    console.log('═══════════════════════════════════════════════════════════');
    
    result.rows.forEach(row => {
      console.log(`\n📅 ROK: ${row.year}`);
      console.log(`🌡️  ROČNÍ PRŮMĚR: ${row.prumer_teplota_c}°C`);
      console.log('\n📊 Měsíční průměry (°C):');
      console.log(`  Led:       ${row.led}°C   │ Srpen:    ${row.srpen}°C`);
      console.log(`  Únor:      ${row.unor}°C   │ Září:     ${row.zari}°C`);
      console.log(`  Březen:    ${row.brezen}°C   │ Říjen:    ${row.rijen}°C`);
      console.log(`  Duben:     ${row.duben}°C   │ Listopad: ${row.listopad}°C`);
      console.log(`  Květen:    ${row.kveten}°C   │ Prosinec: ${row.prosinec}°C`);
      console.log(`  Červen:    ${row.cerven}°C`);
      console.log(`  Červenec:  ${row.cervenec}°C`);
    });
    
    // Celkový průměr za všechny roky
    const avgResult = await pool.query(`
      SELECT 
        ROUND(AVG(tavg_avg)::numeric, 2) as celoroky_prumer
      FROM climate_master_geom
      WHERE LOWER(naz_obec) LIKE '%celadna%'
    `);
    
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log(`\n📈 PRŮMĚR ZA VŠECHNY ROKY: ${avgResult.rows[0].celoroky_prumer}°C`);
    
  } catch (e) {
    console.error('❌ Chyba:', e.message);
  } finally {
    await pool.end();
  }
}

getCeladnaTemperature();
