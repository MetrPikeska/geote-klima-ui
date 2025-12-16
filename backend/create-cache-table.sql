-- Cache table for pre-computed climate results
-- Stores calculated climate indicators to avoid repeated expensive computations

CREATE TABLE IF NOT EXISTS climate_results_cache (
    id SERIAL PRIMARY KEY,

    -- Identification
    unit_type VARCHAR(50) NOT NULL,  -- 'orp', 'chko', or 'custom'
    unit_id VARCHAR(100),             -- ID of the unit (e.g., 'Beskydy')
    geometry_hash VARCHAR(64) NOT NULL UNIQUE, -- MD5 hash of geometry for custom polygons

    -- Climate data for each normal
    old_normal_t NUMERIC,             -- Average temperature for old normal
    old_normal_r NUMERIC,             -- Average precipitation for old normal
    old_normal_ai NUMERIC,            -- De Martonne index for old normal
    old_normal_pet NUMERIC,           -- PET for old normal
    old_normal_temps JSONB,           -- Monthly temperatures array

    new_normal_t NUMERIC,
    new_normal_r NUMERIC,
    new_normal_ai NUMERIC,
    new_normal_pet NUMERIC,
    new_normal_temps JSONB,

    future_normal_t NUMERIC,
    future_normal_r NUMERIC,
    future_normal_ai NUMERIC,
    future_normal_pet NUMERIC,
    future_normal_temps JSONB,

    -- Metadata
    computed_at TIMESTAMP DEFAULT NOW(),
    computation_time_ms INTEGER      -- How long it took to compute
);

-- Create indexes for fast lookup
CREATE INDEX IF NOT EXISTS idx_cache_unit_type_id ON climate_results_cache (unit_type, unit_id);
CREATE INDEX IF NOT EXISTS idx_cache_geometry_hash ON climate_results_cache (geometry_hash);
CREATE INDEX IF NOT EXISTS idx_cache_computed_at ON climate_results_cache (computed_at);

-- Add comments
COMMENT ON TABLE climate_results_cache IS 'Cached climate calculation results to avoid repeated expensive computations';
COMMENT ON COLUMN climate_results_cache.geometry_hash IS 'MD5 hash of ST_AsText(geometry) for unique identification';
COMMENT ON COLUMN climate_results_cache.computation_time_ms IS 'Original computation time in milliseconds';
