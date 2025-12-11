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

    if (!geometry) {
      return res.status(400).json({ error: "Missing geometry" });
    }

    // Pokud přijde Feature → extrahuj geometry
    const geomOnly =
      geometry.type === "Feature" ? geometry.geometry : geometry;

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

    // Výsledek
    const rows = (await pool.query(sql, [jsonGeom])).rows;

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
      ]
    });

  } catch (err) {
    console.error("BACKEND ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});


// ============================================================
//     START SERVERU
// ============================================================
app.listen(4000, () =>
  console.log("Backend běží na http://localhost:4000")
);
