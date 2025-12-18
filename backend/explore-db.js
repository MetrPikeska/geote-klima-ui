const { pool } = require('./db');

async function explore() {
  try {
    const tables = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    
    console.log('📊 TABULKY V DATABÁZI:\n');
    for (const t of tables.rows) {
      const cols = await pool.query(`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = $1
        ORDER BY ordinal_position
      `, [t.table_name]);
      
      console.log(`${t.table_name}:`);
      cols.rows.forEach(c => console.log(`  - ${c.column_name}: ${c.data_type}`));
      
      const count = await pool.query(`SELECT COUNT(*) as cnt FROM "${t.table_name}"`);
      console.log(`  Řádků: ${count.rows[0].cnt}\n`);
    }
  } catch (e) {
    console.error('❌', e.message);
  } finally {
    await pool.end();
  }
}
explore();
