// db.js (CommonJS)
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { Pool } = require("pg");

// Ensure password is always a string
const dbPassword = process.env.DB_PASSWORD;
if (!dbPassword || typeof dbPassword !== 'string') {
  console.error('❌ DB_PASSWORD is not set or is not a string!');
  console.error('DB_PASSWORD value:', dbPassword);
  console.error('DB_PASSWORD type:', typeof dbPassword);
  process.exit(1);
}

const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "postgres",
  password: dbPassword,
  database: process.env.DB_NAME || "klima",
  port: parseInt(process.env.DB_PORT || "5432", 10)
});

// Test database connection on startup
pool.on('connect', () => {
  console.log('✓ Database connected successfully');
});

pool.on('error', (err) => {
  console.error('✗ Unexpected database error:', err);
  process.exit(-1);
});

module.exports = { pool };
