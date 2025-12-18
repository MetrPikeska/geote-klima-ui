// === server.js ===
// Backend pro výpočet klimatických normálů ON-THE-FLY (vážené průměry)
// Správně počítá ROČNÍ srážky podle zadání De Martonne (R_year = SUM měsíčních srážek)

const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const { pool } = require("./db");

const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: "10mb" }));


// ============================================================
//   /climate/polygon
//   ON-THE-FLY výpočet klimatických normálů pro polygon
//   – ST_Intersects
//   – Vážené průměry podle plochy
//   – Vrací: T_year, R_year, monthlyTemps[12]
// ============================================================
app.post("/climate/polygon", async (req, res) => {
  try {
    const { geometry, label } = req.body;

    // Validation: Check if geometry exists
    if (!geometry) {
      return res.status(400).json({
        error: "Missing geometry",
        message: "Request must include a 'geometry' field with valid GeoJSON"
      });
    }

    // Validation: Check geometry structure
    const geomOnly = geometry.type === "Feature" ? geometry.geometry : geometry;

    if (!geomOnly.type || !geomOnly.coordinates) {
      return res.status(400).json({
        error: "Invalid geometry format",
        message: "Geometry must have 'type' and 'coordinates' properties"
      });
    }

    // Validation: Check if coordinates array is not empty
    if (!Array.isArray(geomOnly.coordinates) || geomOnly.coordinates.length === 0) {
      return res.status(400).json({
        error: "Invalid coordinates",
        message: "Geometry coordinates must be a non-empty array"
      });
    }

    const jsonGeom = JSON.stringify(geomOnly);

    // ============================================================
    // HLAVNÍ SQL DOTAZ – SPRÁVNÁ VERZE PRO DE MARTONNE
    // ============================================================
    const sql = `
      WITH poly AS (
        SELECT ST_Transform(
          ST_SetSRID(ST_GeomFromGeoJSON($1)::geometry, 4326),
          5514
        ) AS geom
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

        -- ROČNÍ TELOTA (už máš tavg_avg správně)
        SUM(weight * tavg_avg) AS T_year,

        -- ROČNÍ SRÁŽKY = SOUČET VŠECH 12 MĚSÍCŮ * váha
        SUM(weight * (
          sra_m1 + sra_m2 + sra_m3 + sra_m4 + sra_m5 + sra_m6 +
          sra_m7 + sra_m8 + sra_m9 + sra_m10 + sra_m11 + sra_m12
        )) AS R_year,

        -- MĚSÍČNÍ TEPLOTY PRO PET
        ${Array.from({ length: 12 }, (_, i) =>
          `SUM(weight * tavg_m${i + 1}) AS tavg_m${i + 1}`
        ).join(",")}

      FROM weights
      GROUP BY year
      ORDER BY year;
    `;

    // Execute query
    const result = await pool.query(sql, [jsonGeom]);
    const rows = result.rows;

    // Validation: Check if we got any data
    if (!rows || rows.length === 0) {
      return res.status(404).json({
        error: "No climate data found",
        message: "The provided polygon does not intersect with any climate data. Try a larger area or different location."
      });
    }

    // ============================================================
    //  HELPER FUNKCE
    // ============================================================
    const avg = (arr, col) =>
      arr.length
        ? arr.reduce((s, r) => s + Number(r[col] || 0), 0) / arr.length
        : null;

    const avgMonthly = (arr) =>
      Array.from({ length: 12 }, (_, i) => avg(arr, `tavg_m${i + 1}`));


    // ============================================================
    // ROZDĚLENÍ NA NORMÁLY
    // ============================================================
    const normals = {
      old: rows.filter(r => r.year <= 1990),
      new: rows.filter(r => r.year >= 1991 && r.year <= 2020),
      future: rows.filter(r => r.year >= 2041)
    };


    // ============================================================
    // FINÁLNÍ JSON ODPOVĚĎ – správně podle compute.js
    // ============================================================
    res.json({
      unitName: label || "Vlastní polygon",
      normals: [
        {
          key: "old",
          label: "Starý normál (<=1990)",
          T: avg(normals.old, "tavg_avg"),
          R: avg(normals.old, "sra_avg"),
          monthlyTemps: avgMonthly(normals.old)
        },
        {
          key: "new",
          label: "Nový normál (1991–2020)",
          T: avg(normals.new, "tavg_avg"),
          R: avg(normals.new, "sra_avg"),
          monthlyTemps: avgMonthly(normals.new)
        },
        {
          key: "future",
          label: "Predikce 2050 (>=2041)",
          T: avg(normals.future, "tavg_avg"),
          R: avg(normals.future, "sra_avg"),
          monthlyTemps: avgMonthly(normals.future)
        }
      ]
    });

  } catch (err) {
    console.error("=".repeat(60));
    console.error("BACKEND ERROR:", err);
    console.error("Error code:", err.code);
    console.error("Error message:", err.message);
    console.error("Error stack:", err.stack);
    console.error("=".repeat(60));

    // Different error types
    if (err.code === '22P02') {
      // PostGIS geometry parsing error
      return res.status(400).json({
        error: "Invalid GeoJSON",
        message: "The provided geometry could not be parsed. Please check your GeoJSON format.",
        details: err.message
      });
    }

    if (err.code === 'ECONNREFUSED') {
      // Database connection error
      return res.status(503).json({
        error: "Database unavailable",
        message: "Cannot connect to the database. Please check if PostgreSQL is running."
      });
    }

    // Generic server error
    res.status(500).json({
      error: "Internal server error",
      message: "An unexpected error occurred while processing your request.",
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});


// ============================================================
//     MCP API ENDPOINT
// ============================================================
app.post("/api/mcp/query", async (req, res) => {
  const { query } = req.body;

  if (!query) {
    return res.status(400).json({
      success: false,
      error: "Query is required",
    });
  }

  try {
    // Simple SQL parsing for common queries
    const lowerQuery = query.toLowerCase();

    if (
      lowerQuery.includes("celadna") &&
      lowerQuery.includes("teplota")
    ) {
      // Query for Čeladná temperature
      const result = await pool.query(`
        SELECT 
          naz_obec,
          year,
          ROUND(tavg_avg::numeric, 2) as avg_temp,
          ROUND(AVG(tavg_avg) OVER (PARTITION BY naz_obec)::numeric, 2) as overall_avg
        FROM climate_master_geom
        WHERE LOWER(naz_obec) LIKE '%celadna%'
        ORDER BY year DESC
        LIMIT 5
      `);

      return res.json({
        success: true,
        result: {
          query: "Čeladná temperature data",
          data: result.rows,
          count: result.rows.length,
        },
      });
    }

    if (lowerQuery.includes("tables")) {
      // List all tables
      const result = await pool.query(`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
        ORDER BY table_name
      `);

      return res.json({
        success: true,
        result: {
          query: "Available tables",
          tables: result.rows.map((r) => r.table_name),
          count: result.rows.length,
        },
      });
    }

    if (lowerQuery.includes("schema")) {
      // Get schema for a table
      const tableMatch = query.match(/schema\s+(\w+)/i);
      const tableName = tableMatch ? tableMatch[1] : "climate_master_geom";

      const result = await pool.query(
        `
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = $1
        ORDER BY ordinal_position
      `,
        [tableName]
      );

      return res.json({
        success: true,
        result: {
          query: `Schema for ${tableName}`,
          columns: result.rows,
          count: result.rows.length,
        },
      });
    }

    if (lowerQuery.includes("stats")) {
      // Database statistics
      const result = await pool.query(`
        SELECT 
          schemaname,
          tablename,
          pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
          n_live_tup as live_rows
        FROM pg_stat_user_tables
        WHERE schemaname = 'public'
        ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
        LIMIT 10
      `);

      return res.json({
        success: true,
        result: {
          query: "Database statistics",
          stats: result.rows,
        },
      });
    }

    // Default: try to execute as SQL (with safety limits)
    if (lowerQuery.includes("select")) {
      const result = await pool.query(query + " LIMIT 10");

      return res.json({
        success: true,
        result: {
          query: "Query result",
          data: result.rows,
          count: result.rowCount,
        },
      });
    }

    // No recognized pattern
    res.json({
      success: false,
      error: "Unknown query type. Try: 'Čeladná teplota', 'tables', 'schema climate_master_geom', 'stats'",
    });
  } catch (error) {
    console.error("[MCP API] Error:", error);
    res.json({
      success: false,
      error: error.message,
    });
  }
});

// ============================================================
//     START SERVERU
// ============================================================
app.listen(4000, () =>
  console.log("Backend běží na http://localhost:4000")
);
