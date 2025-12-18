// === server.js WITH CACHING + BATCH SUPPORT ===
// Backend s podporou cachování výsledků do databáze a dávkovým zpracováním

const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const crypto = require("crypto");
const { pool } = require("./db");

const app = express();
app.use(cors());

// Increase JSON parsing limits for large geometries
// IMPORTANT: Use extended: true for large URL-encoded data
app.use(express.json({ limit: "50mb", strict: false }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Debug logging middleware
app.use((req, res, next) => {
  if (req.method === 'POST' && req.path === '/climate/polygon') {
    console.log('[DEBUG BACKEND] Incoming POST /climate/polygon');
    console.log('[DEBUG] Content-Type:', req.headers['content-type']);
    console.log('[DEBUG] Body type:', typeof req.body);
    console.log('[DEBUG] Body keys:', Object.keys(req.body || {}));
    if (req.body?.geometry) {
      console.log('[DEBUG] Geometry type:', req.body.geometry.type);
      console.log('[DEBUG] Geometry coords sample:', String(req.body.geometry.coordinates).slice(0, 50));
    }
    if (req.body?.geometries) {
      console.log('[DEBUG] Geometries count:', req.body.geometries.length);
    }
  }
  next();
});

// JSON parse error handler
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && 'body' in err) {
    console.error('[ERROR] JSON Parse Error:', err.message);
    console.error('[ERROR] Raw body (first 500 chars):', req.body?.slice?.(0, 500));
    return res.status(400).json({
      error: 'Invalid JSON',
      message: err.message
    });
  }
  next(err);
});

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
//   HELPER: Compute climate for a single geometry
// ============================================================
async function computeClimateForGeometry(geomOnly, label) {
  try {
    const hash = getGeometryHash(geomOnly);

    // Check cache first
    const cached = await getCachedResult(hash);
    if (cached) {
      console.log(`✅ Cache HIT for hash: ${hash.slice(0, 8)}...`);
      return {
        cached: true,
        unitName: label || cached.unit_id || "Vlastní polygon",
        normals: [
          {
            key: "old",
            label: "Starý normál (<=1990)",
            T: parseFloat(cached.old_normal_t),
            R: parseFloat(cached.old_normal_r),
            monthlyTemps: JSON.parse(cached.old_normal_temps || '[]')
          },
          {
            key: "new",
            label: "Nový normál (1991–2020)",
            T: parseFloat(cached.new_normal_t),
            R: parseFloat(cached.new_normal_r),
            monthlyTemps: JSON.parse(cached.new_normal_temps || '[]')
          },
          {
            key: "future",
            label: "Predikce 2050 (>=2041)",
            T: parseFloat(cached.future_normal_t),
            R: parseFloat(cached.future_normal_r),
            monthlyTemps: JSON.parse(cached.future_normal_temps || '[]')
          }
        ],
        computationTimeMs: cached.computation_time_ms
      };
    }

    // Cache miss - compute
    const jsonGeom = JSON.stringify(geomOnly);

    function detectLikely5514(g) {
      try {
        const stack = [g.coordinates];
        while (stack.length) {
          const v = stack.pop();
          if (Array.isArray(v)) {
            for (const item of v) stack.push(item);
          } else if (typeof v === 'number') {
            if (Math.abs(v) > 1000) return true;
          }
        }
      } catch (e) {}
      return false;
    }

    const incomingIs5514 = detectLikely5514(geomOnly);
    const geomExpr = incomingIs5514
      ? "ST_SetSRID(ST_GeomFromGeoJSON($1)::geometry, 5514)"
      : "ST_Transform(ST_SetSRID(ST_GeomFromGeoJSON($1)::geometry, 4326), 5514)";

    const sql = `
      WITH poly AS (
        SELECT ${geomExpr} AS geom
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

    const result = await pool.query(sql, [jsonGeom]);
    const rows = result.rows;

    console.log('[SQL DEBUG] Query executed. Rows returned:', rows.length);
    if (rows.length > 0) {
      console.log('[SQL DEBUG] First row years:', rows.map(r => r.year).slice(0, 5));
      console.log('[SQL DEBUG] Sample row:', {
        year: rows[0].year,
        T_year: rows[0].T_year,
        R_year: rows[0].R_year,
        tavg_m1: rows[0].tavg_m1
      });
    }

    if (!rows || rows.length === 0) {
      return null;
    }

    const avg = (arr, col) =>
      arr.length ? arr.reduce((s, r) => s + Number(r[col] || 0), 0) / arr.length : null;

    const avgMonthly = (arr) =>
      Array.from({ length: 12 }, (_, i) => avg(arr, `tavg_m${i + 1}`));

    const normals = {
      old: rows.filter(r => r.year <= 1990),
      new: rows.filter(r => r.year >= 1991 && r.year <= 2020),
      future: rows.filter(r => r.year >= 2041)
    };

    const normalsArray = [
      {
        key: "old",
        label: "Starý normál (<=1990)",
        T: avg(normals.old, "T_year"),
        R: avg(normals.old, "R_year"),
        monthlyTemps: avgMonthly(normals.old)
      },
      {
        key: "new",
        label: "Nový normál (1991–2020)",
        T: avg(normals.new, "T_year"),
        R: avg(normals.new, "R_year"),
        monthlyTemps: avgMonthly(normals.new)
      },
      {
        key: "future",
        label: "Predikce 2050 (>=2041)",
        T: avg(normals.future, "T_year"),
        R: avg(normals.future, "R_year"),
        monthlyTemps: avgMonthly(normals.future)
      }
    ];

    // Log computed normals for debugging
    console.log('[COMPUTE DEBUG] Normals computed:', normalsArray.map(n => ({
      label: n.label,
      T: n.T,
      R: n.R,
      hasMonthly: Array.isArray(n.monthlyTemps) && n.monthlyTemps.length > 0
    })));

    // Check for all-zero results and throw error
    const allZero = normalsArray.every(n => 
      (n.T === null || n.T === 0) && 
      (n.R === null || n.R === 0) &&
      (!Array.isArray(n.monthlyTemps) || n.monthlyTemps.every(m => m === null || m === 0))
    );

    if (allZero) {
      console.error('[ERROR] All computed values are zero! Data issue detected.');
      console.error('[ERROR] Normals count - old:', normals.old.length, 'new:', normals.new.length, 'future:', normals.future.length);
      throw new Error('Climate data computation returned all zeros. Possible geometry/data mismatch.');
    }
      },
      {
        key: "future",
        label: "Predikce 2050 (>=2041)",
        T: avg(normals.future, "T_year"),
        R: avg(normals.future, "R_year"),
        monthlyTemps: avgMonthly(normals.future)
      }
    ];

    const computationTime = Date.now();

    // Save to cache
    try {
      await saveToCache(hash, 'custom', label || 'custom_polygon', normalsArray, computationTime);
      console.log(`✅ Cache saved (${hash.slice(0, 8)}...)`);
    } catch (e) {
      console.warn('Cache save failed:', e.message);
    }

    return {
      cached: false,
      unitName: label || "Vlastní polygon",
      normals: normalsArray,
      computationTimeMs: computationTime
    };
  } catch (err) {
    console.error("Compute error for geometry:", err.message);
    throw err;
  }
}

// ============================================================
//   /climate/polygon - SUPPORTS SINGLE & BATCH
// ============================================================
app.post("/climate/polygon", async (req, res) => {
  const startTime = Date.now();

  try {
    const { geometry, geometries, label, labels } = req.body;
    
    // Log what we received
    if (geometry) {
      console.log('[RECEIVED] Single geometry, type:', geometry.type, 'coords length:', geometry.coordinates?.length);
    }
    if (geometries) {
      console.log('[RECEIVED] Batch with', geometries.length, 'geometries');
    }

    // Determine if single or batch
    const isBatch = Array.isArray(geometries) && geometries.length > 0;

    if (!isBatch && !geometry) {
      return res.status(400).json({
        error: "Missing geometry",
        message: "Request must include 'geometry' (single) or 'geometries' (array)"
      });
    }

    // BATCH REQUEST
    if (isBatch) {
      const results = [];
      for (let i = 0; i < geometries.length; i++) {
        try {
          const geom = geometries[i];
          const geomOnly = geom.type === "Feature" ? geom.geometry : geom;

          if (!geomOnly.type || !geomOnly.coordinates) {
            results.push({
              index: i,
              error: "Invalid geometry format",
              unitName: labels && labels[i] ? labels[i] : `Unit ${i + 1}`
            });
            continue;
          }

          const unitLabel = labels && labels[i] ? labels[i] : `Unit ${i + 1}`;
          const result = await computeClimateForGeometry(geomOnly, unitLabel);

          if (result) {
            results.push({ index: i, ...result });
          } else {
            results.push({
              index: i,
              error: "No climate data found",
              unitName: unitLabel
            });
          }
        } catch (e) {
          console.error(`Batch item ${i} error:`, e.message);
          results.push({
            index: i,
            error: e.message,
            unitName: labels && labels[i] ? labels[i] : `Unit ${i + 1}`
          });
        }
      }

      const duration = Date.now() - startTime;
      return res.json({
        batch: true,
        count: geometries.length,
        results,
        totalTimeMs: duration
      });
    }

    // SINGLE REQUEST
    const geomOnly = geometry.type === "Feature" ? geometry.geometry : geometry;

    if (!geomOnly.type || !geomOnly.coordinates) {
      return res.status(400).json({
        error: "Invalid geometry format",
        message: "Geometry must have 'type' and 'coordinates' properties"
      });
    }

    const result = await computeClimateForGeometry(geomOnly, label);
    const duration = Date.now() - startTime;

    if (!result) {
      return res.status(404).json({
        error: "No climate data found",
        message: "The provided polygon does not intersect with any climate data."
      });
    }

    // Check if GeoJSON export requested
    const wantsGeoJSON = (req.query && req.query.export === 'geojson') ||
      (req.headers && req.headers.accept && req.headers.accept.includes('geo+json')) ||
      (req.body && req.body.export === 'geojson');

    if (wantsGeoJSON) {
      try {
        const jsonGeom = JSON.stringify(geomOnly);
        function detectLikely5514(g) {
          try {
            const stack = [g.coordinates];
            while (stack.length) {
              const v = stack.pop();
              if (Array.isArray(v)) {
                for (const item of v) stack.push(item);
              } else if (typeof v === 'number') {
                if (Math.abs(v) > 1000) return true;
              }
            }
          } catch (e) {}
          return false;
        }
        const incomingIs5514 = detectLikely5514(geomOnly);
        const geomSql = incomingIs5514
          ? "ST_AsGeoJSON(ST_Transform(ST_SetSRID(ST_GeomFromGeoJSON($1)::geometry,5514),4326)) as gj"
          : "ST_AsGeoJSON(ST_SetSRID(ST_GeomFromGeoJSON($1)::geometry,4326)) as gj";
        const gres = await pool.query(`SELECT ${geomSql}`, [jsonGeom]);
        const geomJSON = gres.rows[0] && gres.rows[0].gj ? JSON.parse(gres.rows[0].gj) : geomOnly;

        const feature = {
          type: 'Feature',
          geometry: geomJSON,
          properties: {
            unitName: label || 'Vlastní polygon',
            normals: result.normals,
            cached: result.cached,
            computationTimeMs: result.computationTimeMs,
            currentResponseTime: duration
          }
        };

        const fc = { type: 'FeatureCollection', features: [feature] };
        res.set('Content-Type', 'application/geo+json');
        return res.send(fc);
      } catch (e) {
        console.warn('GeoJSON export failed:', e.message);
        // Fallback to JSON
      }
    }

    res.json({
      ...result,
      currentResponseTime: duration
    });

  } catch (err) {
    console.error("=".repeat(60));
    console.error("BACKEND ERROR:", err.message);
    console.error(err.stack);
    console.error("=".repeat(60));

    res.status(500).json({
      error: "Internal server error",
      message: err.message,
      duration: ((Date.now() - startTime) / 1000).toFixed(2)
    });
  }
});

app.listen(4000, () =>
  console.log("Backend WITH CACHING + BATCH běží na http://localhost:4000")
);
