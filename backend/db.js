// ============================================
// Database Connection Module
// PostgreSQL + PostGIS connection pool
// ============================================

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { Pool } = require("pg");

// ===== Configuration Validation =====

// Validate required environment variables
const requiredEnvVars = ['DB_PASSWORD', 'DB_HOST', 'DB_USER', 'DB_NAME'];
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.error('❌ Missing required environment variables:');
  missingVars.forEach(varName => {
    console.error(`   - ${varName}`);
  });
  console.error('\n📋 Setup instructions:');
  console.error('   1. Copy .env.example to .env:');
  console.error('      cp backend/.env.example backend/.env');
  console.error('   2. Edit backend/.env and set your database credentials');
  console.error('   3. Ensure DB_PASSWORD is set correctly\n');
  process.exit(1);
}

// Validate password specifically (common mistake)
const dbPassword = process.env.DB_PASSWORD;
if (typeof dbPassword !== 'string' || dbPassword === 'your_password_here') {
  console.error('❌ DB_PASSWORD is not properly configured!');
  console.error('   Current value: "' + dbPassword + '"');
  console.error('\n📋 Please edit backend/.env and set a real password.\n');
  process.exit(1);
}

// ===== Create Connection Pool =====

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || "5432", 10),
  user: process.env.DB_USER,
  password: dbPassword,
  database: process.env.DB_NAME,
  // Connection pool settings
  max: 20, // maximum number of clients in the pool
  idleTimeoutMillis: 30000, // close idle clients after 30 seconds
  connectionTimeoutMillis: 5000, // return error after 5 seconds if unable to connect
});

// ===== Connection Event Handlers =====

let isConnected = false;

pool.on('connect', (client) => {
  if (!isConnected) {
    console.log('✓ Database connected successfully');
    console.log(`  Host: ${process.env.DB_HOST}:${process.env.DB_PORT}`);
    console.log(`  Database: ${process.env.DB_NAME}`);
    isConnected = true;
  }
});

pool.on('error', (err, client) => {
  console.error('✗ Unexpected database error:', err.message);
  console.error('  This error occurred on an idle client');
  // Don't exit on pool errors - let the pool handle reconnection
});

// ===== Startup Health Check =====

const testConnection = async () => {
  try {
    console.log('🔍 Testing database connection...');
    
    // Test basic connectivity
    const result = await pool.query('SELECT NOW() as current_time, version() as pg_version');
    console.log('✓ PostgreSQL connection OK');
    console.log(`  Server time: ${result.rows[0].current_time}`);
    
    // Check for PostGIS extension
    const postgisCheck = await pool.query(
      "SELECT EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'postgis') as has_postgis"
    );
    
    if (postgisCheck.rows[0].has_postgis) {
      const postgisVersion = await pool.query('SELECT PostGIS_Version() as version');
      console.log('✓ PostGIS extension found');
      console.log(`  Version: ${postgisVersion.rows[0].version}`);
    } else {
      console.error('⚠️  WARNING: PostGIS extension not found!');
      console.error('   Spatial queries will fail.');
      console.error('   Install with: CREATE EXTENSION postgis;');
    }
    
    // Check if climate_master_geom table exists
    const tableCheck = await pool.query(
      "SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'climate_master_geom') as table_exists"
    );
    
    if (tableCheck.rows[0].table_exists) {
      console.log('✓ climate_master_geom table found');
    } else {
      console.error('⚠️  WARNING: climate_master_geom table not found!');
      console.error('   You may need to import spatial data first.');
    }
    
    console.log('✓ Database health check completed\n');
    
  } catch (err) {
    console.error('❌ Database connection test failed:');
    console.error(`   ${err.message}`);
    console.error('\n📋 Troubleshooting:');
    console.error('   1. Check if PostgreSQL is running');
    console.error('   2. Verify credentials in backend/.env');
    console.error('   3. Check network connectivity if using remote DB');
    console.error('   4. Ensure database "' + process.env.DB_NAME + '" exists\n');
    process.exit(1);
  }
};

// Run health check on module load
testConnection();

// ===== Graceful Shutdown =====

process.on('SIGINT', async () => {
  console.log('\n🛑 Received SIGINT, closing database connections...');
  await pool.end();
  console.log('✓ Database pool closed');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Received SIGTERM, closing database connections...');
  await pool.end();
  console.log('✓ Database pool closed');
  process.exit(0);
});

// ===== Exports =====

module.exports = { pool };
