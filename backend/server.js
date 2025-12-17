// === server.js WITH CACHING ===
// Backend s podporou cachování výsledků do databáze

const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const crypto = require("crypto");
const { pool } = require("./db");

const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: "10mb" }));

// ============================================================
//   HELPER: Generate hash for geometry (for cache lookup)
// ============================================================
function getGeometryHash(geometryJSON) {
  const geomString = JSON.stringify(geometryJSON);
  return crypto.createHash('md5').update(geomString).digest('hex');
}

// ============================================================
//   HELPER: Check if result exists in cache
// ============================================================
async function getCachedResult(geometryHash) {
  const query = `
    SELECT * FROM climate_results_cache
    WHERE geometry_hash = $1
    AND computed_at > NOW() - INTERVAL '30 days'
    LIMIT 1
  `;

  const result = await pool.query(query, [geometryHash]);
  return result.rows.length > 0 ? result.rows[0] : null;
}

// ============================================================
//   HELPER: Save result to cache
// ============================================================
async function saveToCache(geometryHash, unitType, unitId, normals, computationTime) {
  const query = `
    INSERT INTO climate_results_cache (
      unit_type, unit_id, geometry_hash,
      old_normal_t, old_normal_r, old_normal_temps,
      new_normal_t, new_normal_r, new_normal_temps,
      future_normal_t, future_normal_r, future_normal_temps,
      computation_time_ms
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    ON CONFLICT (geometry_hash) DO UPDATE SET
      computed_at = NOW(),
      computation_time_ms = EXCLUDED.computation_time_ms
    RETURNING id
  `;

  const values = [
    unitType,
    unitId,
    geometryHash,
    normals[0].T,
    normals[0].R,
    JSON.stringify(normals[0].monthlyTemps),
    normals[1].T,
    normals[1].R,
    JSON.stringify(normals[1].monthlyTemps),
    normals[2].T,
    normals[2].R,
    JSON.stringify(normals[2].monthlyTemps),
    computationTime
  ];

  await pool.query(query, values);
}

// ============================================================
//   /climate/polygon WITH CACHING
// ============================================================
app.post("/climate/polygon", async (req, res) => {
  const startTime = Date.now();

  try {
    const { geometry, label } = req.body;

    // Validation
    if (!geometry) {
      return res.status(400).json({
        error: "Missing geometry",
        message: "Request must include a 'geometry' field with valid GeoJSON"
      });
    }

    const geomOnly = geometry.type === "Feature" ? geometry.geometry : geometry;

    if (!geomOnly.type || !geomOnly.coordinates) {
      return res.status(400).json({
        error: "Invalid geometry format",
        message: "Geometry must have 'type' and 'coordinates' properties"
      });
    }

    // Generate hash for cache lookup
    const geometryHash = getGeometryHash(geomOnly);

    // 🔍 CHECK CACHE FIRST
    const cached = await getCachedResult(geometryHash);

    if (cached) {
      console.log(`✅ Cache HIT for geometry hash: ${geometryHash}`);
      console.log(`   Original computation: ${cached.computation_time_ms}ms`);
      console.log(`   Cached ${Math.round((Date.now() - new Date(cached.computed_at).getTime()) / 1000 / 60)} minutes ago`);

      const duration = Date.now() - startTime;

      return res.json({
        unitName: label || cached.unit_id || "Vlastní polygon",
        normals: [
          {
            key: "old",
            label: "Starý normál (<=1990)",
            T: parseFloat(cached.old_normal_t),
            R: parseFloat(cached.old_normal_r),
            monthlyTemps: cached.old_normal_temps
          },
          {
            key: "new",
            label: "Nový normál (1991–2020)",
            T: parseFloat(cached.new_normal_t),
            R: parseFloat(cached.new_normal_r),
            monthlyTemps: cached.new_normal_temps
          },
          {
            key: "future",
            label: "Predikce 2050 (>=2041)",
            T: parseFloat(cached.future_normal_t),
            R: parseFloat(cached.future_normal_r),
            monthlyTemps: cached.future_normal_temps
          }
        ],
        cached: true,
        cacheAge: Math.round((Date.now() - new Date(cached.computed_at).getTime()) / 1000),
        originalComputationTime: cached.computation_time_ms,
        currentResponseTime: duration
      });
    }

    // ❌ CACHE MISS - perform computation
    console.log(`❌ Cache MISS for geometry hash: ${geometryHash}`);
    console.log(`   Computing new result...`);

    const jsonGeom = JSON.stringify(geomOnly);

    // Original SQL query (same as before)
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
        SUM(weight * tavg_avg) AS T_year,
        SUM(weight * (
          sra_m1 + sra_m2 + sra_m3 + sra_m4 + sra_m5 + sra_m6 +
          sra_m7 + sra_m8 + sra_m9 + sra_m10 + sra_m11 + sra_m12
        )) AS R_year,
        ${Array.from({ length: 12 }, (_, i) =>
          `SUM(weight * tavg_m${i + 1}) AS tavg_m${i + 1}`
        ).join(",")}
      FROM weights
      GROUP BY year
      ORDER BY year;
    `;

    const rows = (await pool.query(sql, [jsonGeom])).rows;

    if (!rows || rows.length === 0) {
      return res.status(404).json({
        error: "No climate data found",
        message: "The provided polygon does not intersect with any climate data."
      });
    }

    // Helper functions
    const avg = (arr, col) =>
      arr.length
        ? arr.reduce((s, r) => s + Number(r[col] || 0), 0) / arr.length
        : null;

    const avgMonthly = (arr) =>
      Array.from({ length: 12 }, (_, i) => avg(arr, `tavg_m${i + 1}`));

    // Split into normals
    const normals = {
      old: rows.filter(r => r.year <= 1990),
      new: rows.filter(r => r.year >= 1991 && r.year <= 2020),
      future: rows.filter(r => r.year >= 2041)
    };

    const normalsArray = [
      {
        key: "old",
        label: "Starý normál (<=1990)",
        T: avg(normals.old, "t_year"),
        R: avg(normals.old, "r_year"),
        monthlyTemps: avgMonthly(normals.old)
      },
      {
        key: "new",
        label: "Nový normál (1991–2020)",
        T: avg(normals.new, "t_year"),
        R: avg(normals.new, "r_year"),
        monthlyTemps: avgMonthly(normals.new)
      },
      {
        key: "future",
        label: "Predikce 2050 (>=2041)",
        T: avg(normals.future, "t_year"),
        R: avg(normals.future, "r_year"),
        monthlyTemps: avgMonthly(normals.future)
      }
    ];

    const computationTime = Date.now() - startTime;

    // 💾 SAVE TO CACHE
    try {
      await saveToCache(
        geometryHash,
        'custom', // unit type
        label || 'custom_polygon',
        normalsArray,
        computationTime
      );
      console.log(`✅ Result saved to cache (${computationTime}ms)`);
    } catch (cacheError) {
      console.warn('⚠️  Failed to save to cache:', cacheError.message);
      // Continue anyway - caching is optional
    }

    res.json({
      unitName: label || "Vlastní polygon",
      normals: normalsArray,
      cached: false,
      computationTime: computationTime
    });

  } catch (err) {
    console.error("=".repeat(60));
    console.error("BACKEND ERROR:", err);
    console.error("Error code:", err.code);
    console.error("Error message:", err.message);
    console.error("Error stack:", err.stack);
    console.error("=".repeat(60));

    if (err.code === '22P02') {
      return res.status(400).json({
        error: "Invalid GeoJSON",
        message: "The provided geometry could not be parsed.",
        details: err.message
      });
    }

    if (err.code === 'ECONNREFUSED') {
      return res.status(503).json({
        error: "Database unavailable",
        message: "Cannot connect to the database."
      });
    }

    console.error('❌ Server error:', err);
    res.status(500).json({
      error: "Internal server error",
      message: "An unexpected error occurred.",
      details: err.message,
      stack: err.stack
    });
  }
});

app.listen(4000, () =>
  console.log("Backend WITH CACHING běží na http://localhost:4000")
);
