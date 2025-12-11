// db.js (CommonJS)
const { Pool } = require("pg");

const pool = new Pool({
  host: "localhost",
  user: "postgres",
  password: "master",   // uprav pokud máš jiné heslo
  database: "klima",
  port: 5432
});

module.exports = { pool };
