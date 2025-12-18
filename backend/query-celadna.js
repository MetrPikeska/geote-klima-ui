const { pool } = require('./db');

async function findCeladnaData() {
  try {
    // Zjistit tabulky
    console.log('=== TABULKY V DATABÁZI ===\n');
    const tables = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    
    for (const tableRow of tables.rows) {
      const tableName = tableRow.table_name;
      
      // Zjistit sloupce
      const columns = await pool.query(`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = $1
        ORDER BY ordinal_position
      `, [tableName]);
      
      console.log(`\n📊 Tabulka: ${tableName}`);
      console.log('Sloupce:', columns.rows.map(c => `${c.column_name} (${c.data_type})`).join(', '));
      
      // Zkusit najít Čeladnou
      if (columns.rows.some(c => c.column_name.toLowerCase().includes('obec') || 
                                  c.column_name.toLowerCase().includes('name') ||
                                  c.column_name.toLowerCase().includes('municipality'))) {
        const celadnaResult = await pool.query(`
          SELECT * FROM ${tableName} 
          WHERE LOWER(CAST(${columns.rows[0].column_name} AS TEXT)) LIKE '%celadna%' 
             OR LOWER(CAST(${columns.rows[1]?.column_name || columns.rows[0].column_name} AS TEXT)) LIKE '%celadna%'
          LIMIT 5
        `).catch(() => null);
        
        if (celadnaResult?.rows?.length > 0) {
          console.log('\n🎯 Nálezy pro Čeladnou:');
          console.log(JSON.stringify(celadnaResult.rows, null, 2));
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Chyba:', error.message);
  } finally {
    await pool.end();
  }
}

findCeladnaData();
