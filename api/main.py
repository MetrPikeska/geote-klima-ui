import hashlib
import json
import os
import time
from contextlib import asynccontextmanager
from typing import Any

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from database import close_pool, get_pool

load_dotenv()

# ── Rate limiting ────────────────────────────────────────────
limiter = Limiter(key_func=get_remote_address)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await get_pool()
    yield
    await close_pool()


app = FastAPI(title="GeoTE Climate API", lifespan=lifespan)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ── CORS ─────────────────────────────────────────────────────
ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:5500",
    "http://localhost:8080",
    "http://127.0.0.1:8080",
    "http://localhost",
    "http://127.0.0.1",
    "https://petrmikeska.cz",
    "http://petrmikeska.cz",
    "https://www.petrmikeska.cz",
    "http://www.petrmikeska.cz",
    "https://api.petrmikeska.cz",
]


def is_allowed_origin(origin: str) -> bool:
    if origin in ALLOWED_ORIGINS:
        return True
    if origin.endswith(".trycloudflare.com"):
        return True
    if origin.endswith(".petrmikeska.cz"):
        return True
    return False


app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?|https://.*\.(petrmikeska\.cz|trycloudflare\.com)",
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
    allow_credentials=True,
)

# ── Models ───────────────────────────────────────────────────

class Geometry(BaseModel):
    type: str
    coordinates: Any


class PolygonRequest(BaseModel):
    geometry: Geometry | None = None
    geometries: list[Any] | None = None
    label: str | None = None
    labels: list[str] | None = None
    export: str | None = None


# ── Helpers ──────────────────────────────────────────────────

def geometry_hash(geom: dict) -> str:
    return hashlib.md5(json.dumps(geom, sort_keys=True).encode()).hexdigest()


def detect_srid_5514(geom: dict) -> bool:
    """Detect if coordinates are in S-JTSK (5514) — values outside WGS84 range."""
    stack = [geom.get("coordinates")]
    while stack:
        v = stack.pop()
        if isinstance(v, list):
            stack.extend(v)
        elif isinstance(v, (int, float)):
            if abs(v) > 180:
                return True
    return False


def geom_expr(is_5514: bool) -> str:
    """
    climate_master_geom is natively SRID 5514.
    Leaflet draws polygons in WGS84 (4326) → transform to 5514 for intersection.
    """
    if is_5514:
        return "ST_SetSRID(ST_GeomFromGeoJSON($1)::geometry, 5514)"
    return "ST_Transform(ST_SetSRID(ST_GeomFromGeoJSON($1)::geometry, 4326), 5514)"


async def get_cached(pool, geom_hash: str) -> dict | None:
    row = await pool.fetchrow(
        """
        SELECT * FROM climate_results_cache
        WHERE geometry_hash = $1
          AND computed_at > NOW() - INTERVAL '30 days'
        LIMIT 1
        """,
        geom_hash,
    )
    if not row:
        return None

    def safe(val):
        if val is None:
            return []
        if isinstance(val, list):
            return val
        try:
            return json.loads(val)
        except Exception:
            return []

    return {
        "cached": True,
        "unitName": row["unit_id"] or "Vlastní polygon",
        "normals": [
            {
                "key": "old",
                "label": "Starý normál (<=1990)",
                "T": float(row["old_normal_t"]) if row["old_normal_t"] is not None else None,
                "R": float(row["old_normal_r"]) if row["old_normal_r"] is not None else None,
                "monthlyTemps": safe(row["old_normal_temps"]),
                "monthlySRA": safe(row["old_normal_sra"]),
            },
            {
                "key": "new",
                "label": "Nový normál (1991–2020)",
                "T": float(row["new_normal_t"]) if row["new_normal_t"] is not None else None,
                "R": float(row["new_normal_r"]) if row["new_normal_r"] is not None else None,
                "monthlyTemps": safe(row["new_normal_temps"]),
                "monthlySRA": safe(row["new_normal_sra"]),
            },
            {
                "key": "future",
                "label": "Predikce 2050 (>=2041)",
                "T": float(row["future_normal_t"]) if row["future_normal_t"] is not None else None,
                "R": float(row["future_normal_r"]) if row["future_normal_r"] is not None else None,
                "monthlyTemps": safe(row["future_normal_temps"]),
                "monthlySRA": safe(row["future_normal_sra"]),
            },
        ],
        "computationTimeMs": row["computation_time_ms"],
    }


async def save_cache(pool, geom_hash: str, label: str, normals: list, computation_ms: int):
    await pool.execute(
        """
        INSERT INTO climate_results_cache (
            unit_type, unit_id, geometry_hash,
            old_normal_t, old_normal_r, old_normal_temps, old_normal_sra,
            new_normal_t, new_normal_r, new_normal_temps, new_normal_sra,
            future_normal_t, future_normal_r, future_normal_temps, future_normal_sra,
            computation_time_ms
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
        ON CONFLICT (geometry_hash) DO UPDATE SET
            computed_at = NOW(),
            old_normal_sra = EXCLUDED.old_normal_sra,
            new_normal_sra = EXCLUDED.new_normal_sra,
            future_normal_sra = EXCLUDED.future_normal_sra,
            computation_time_ms = EXCLUDED.computation_time_ms
        """,
        "custom",
        label or "custom_polygon",
        geom_hash,
        normals[0]["T"], normals[0]["R"],
        json.dumps(normals[0]["monthlyTemps"]), json.dumps(normals[0]["monthlySRA"]),
        normals[1]["T"], normals[1]["R"],
        json.dumps(normals[1]["monthlyTemps"]), json.dumps(normals[1]["monthlySRA"]),
        normals[2]["T"], normals[2]["R"],
        json.dumps(normals[2]["monthlyTemps"]), json.dumps(normals[2]["monthlySRA"]),
        computation_ms,
    )


async def compute_climate(pool, geom: dict, label: str | None) -> dict | None:
    t0 = time.monotonic()
    h = geometry_hash(geom)

    cached = await get_cached(pool, h)
    if cached:
        cached["unitName"] = label or cached["unitName"]
        return cached

    is_5514 = detect_srid_5514(geom)
    expr = geom_expr(is_5514)
    geom_json = json.dumps(geom)

    months = list(range(1, 13))
    month_cols_t = ", ".join(f"tavg_m{i}" for i in months)
    month_cols_r = ", ".join(f"sra_m{i}" for i in months)
    # tavg_avg column doesn't exist — compute annual average from monthly values
    tavg_sum = " + ".join(f"COALESCE(tavg_m{i}, 0)" for i in months)
    sra_sum  = " + ".join(f"COALESCE(sra_m{i}, 0)" for i in months)

    sql = (
        f"WITH poly AS (SELECT {expr} AS geom),"
        " inter AS ("
        "   SELECT c.year,"
        f"  ({tavg_sum}) / 12.0 AS tavg_avg,"
        f"  ({sra_sum}) AS sra_annual,"
        "   ST_Area(ST_Intersection(c.geom, p.geom)) AS area_intersect,"
        "   ST_Area(p.geom) AS area_poly,"
        f"  {month_cols_t}, {month_cols_r}"
        "   FROM climate_master_geom c CROSS JOIN poly p"
        "   WHERE ST_Intersects(c.geom, p.geom)"
        " ),"
        " weights AS ("
        "   SELECT *, area_intersect / NULLIF(area_poly, 0) AS weight"
        "   FROM inter WHERE area_intersect > 0"
        " )"
        " SELECT year, tavg_avg, sra_annual, weight,"
        f" {month_cols_t}, {month_cols_r}"
        " FROM weights ORDER BY year"
    )

    rows = await pool.fetch(sql, geom_json)
    if not rows:
        return None

    # Group by year → weighted average
    by_year: dict[int, list] = {}
    for r in rows:
        by_year.setdefault(r["year"], []).append(r)

    yearly = []
    for year, yr_rows in by_year.items():
        total_w = sum(r["weight"] or 0 for r in yr_rows)
        if total_w == 0:
            continue
        T_year = sum((r["tavg_avg"] or 0) * (r["weight"] or 0) for r in yr_rows) / total_w
        R_year = sum((r["sra_annual"] or 0) * (r["weight"] or 0) for r in yr_rows) / total_w
        mt = [
            sum((r[f"tavg_m{i}"] or 0) * (r["weight"] or 0) for r in yr_rows) / total_w
            for i in range(1, 13)
        ]
        mr = [
            sum((r[f"sra_m{i}"] or 0) * (r["weight"] or 0) for r in yr_rows) / total_w
            for i in range(1, 13)
        ]
        yearly.append({"year": year, "T": T_year, "R": R_year, "mt": mt, "mr": mr})

    def period_avg(items: list, key: str):
        return sum(i[key] for i in items) / len(items) if items else None

    def period_monthly(items: list, key: str):
        if not items:
            return [None] * 12
        return [sum(i[key][m] for i in items) / len(items) for m in range(12)]

    periods = [
        ("old",    "Starý normál (<=1990)",     [y for y in yearly if y["year"] <= 1990]),
        ("new",    "Nový normál (1991–2020)",    [y for y in yearly if 1991 <= y["year"] <= 2020]),
        ("future", "Predikce 2050 (>=2041)",     [y for y in yearly if y["year"] >= 2041]),
    ]

    normals = [
        {
            "key": key,
            "label": lbl,
            "T": period_avg(items, "T"),
            "R": period_avg(items, "R"),
            "monthlyTemps": period_monthly(items, "mt"),
            "monthlySRA": period_monthly(items, "mr"),
        }
        for key, lbl, items in periods
    ]

    computation_ms = int((time.monotonic() - t0) * 1000)

    try:
        await save_cache(pool, h, label, normals, computation_ms)
    except Exception as e:
        print(f"Cache save failed: {e}")

    return {
        "cached": False,
        "unitName": label or "Vlastní polygon",
        "normals": normals,
        "computationTimeMs": computation_ms,
    }


def extract_geometry(raw) -> dict:
    """Accept GeoJSON Feature or bare Geometry."""
    if isinstance(raw, dict):
        if raw.get("type") == "Feature":
            return raw["geometry"]
        return raw
    return raw.dict() if hasattr(raw, "dict") else raw


# ── Unit type config ─────────────────────────────────────────

UNIT_TYPES = {
    "kraje":  {"table": "kraje",  "label_col": "naz_cznuts3", "limit": 20},
    "okresy": {"table": "okresy", "label_col": "nazev",       "limit": 100},
    "orp":    {"table": "orp",    "label_col": "NAZ_ORP",     "limit": 300},
    "obce":   {"table": "obce",   "label_col": "nazev",       "limit": 7000},
    "chko":   {"table": "chko",   "label_col": "NAZEV",       "limit": 50},
}


# ── Endpoints ─────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/units/{unit_type}")
@limiter.limit("60/minute")
async def get_units(request: Request, unit_type: str):
    cfg = UNIT_TYPES.get(unit_type)
    if not cfg:
        raise HTTPException(
            status_code=400,
            detail=f"Neznámý typ jednotky '{unit_type}'. Platné: {', '.join(UNIT_TYPES)}"
        )

    pool = await get_pool()
    table = cfg["table"]
    label_col = cfg["label_col"]
    limit = cfg["limit"]

    # Quote label column in case it contains uppercase letters
    q_label = f'"{label_col}"'

    sql = f"""
        SELECT
            {q_label} AS label,
            ST_AsGeoJSON(
                ST_Transform(
                    ST_SimplifyPreserveTopology(geom, 50),
                    4326
                ),
                6
            ) AS geojson
        FROM {table}
        ORDER BY {q_label}
        LIMIT {limit}
    """

    rows = await pool.fetch(sql)

    features = []
    for i, row in enumerate(rows):
        if not row["geojson"]:
            continue
        features.append({
            "type": "Feature",
            "id": i,
            "geometry": json.loads(row["geojson"]),
            "properties": {"label": row["label"]},
        })

    return {
        "type": "FeatureCollection",
        "features": features,
    }


@app.post("/climate/polygon")
@limiter.limit("30/minute")
async def climate_polygon(
    request: Request,
    body: PolygonRequest,
    export: str | None = Query(default=None),
):
    pool = await get_pool()
    t0 = time.monotonic()

    # ── Batch ─────────────────────────────────────────────────
    if body.geometries:
        results = []
        for i, raw_geom in enumerate(body.geometries):
            lbl = (body.labels[i] if body.labels and i < len(body.labels) else f"Unit {i+1}")
            try:
                geom = extract_geometry(raw_geom)
                result = await compute_climate(pool, geom, lbl)
                if result:
                    results.append({"index": i, **result})
                else:
                    results.append({"index": i, "error": "No climate data found", "unitName": lbl})
            except Exception as e:
                results.append({"index": i, "error": str(e), "unitName": lbl})

        return {
            "batch": True,
            "count": len(body.geometries),
            "results": results,
            "totalTimeMs": int((time.monotonic() - t0) * 1000),
        }

    # ── Single ────────────────────────────────────────────────
    if not body.geometry:
        raise HTTPException(status_code=400, detail="Missing 'geometry' or 'geometries'")

    geom = extract_geometry(body.geometry)
    result = await compute_climate(pool, geom, body.label)

    if not result:
        raise HTTPException(status_code=404, detail="Polygon does not intersect any climate data.")

    wants_geojson = export == "geojson" or (body.export == "geojson")
    if wants_geojson:
        is_5514 = detect_srid_5514(geom)
        geom_sql = (
            "ST_AsGeoJSON(ST_Transform(ST_SetSRID(ST_GeomFromGeoJSON($1)::geometry,5514),4326))"
            if is_5514
            else "ST_AsGeoJSON(ST_SetSRID(ST_GeomFromGeoJSON($1)::geometry,4326))"
        )
        row = await pool.fetchrow(f"SELECT {geom_sql} AS gj", json.dumps(geom))
        geom_out = json.loads(row["gj"]) if row and row["gj"] else geom
        fc = {
            "type": "FeatureCollection",
            "features": [{
                "type": "Feature",
                "geometry": geom_out,
                "properties": {
                    "unitName": body.label or "Vlastní polygon",
                    "normals": result["normals"],
                    "cached": result["cached"],
                    "computationTimeMs": result["computationTimeMs"],
                },
            }],
        }
        return JSONResponse(content=fc, media_type="application/geo+json")

    return {**result, "currentResponseTime": int((time.monotonic() - t0) * 1000)}
