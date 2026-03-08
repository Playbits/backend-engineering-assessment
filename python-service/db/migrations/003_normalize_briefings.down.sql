DROP TABLE IF EXISTS briefing_metrics;
DROP TABLE IF EXISTS briefing_points;
DROP TABLE IF EXISTS briefings;

-- Recreate the structure from 002 if needed for rollback sanity, 
-- but normally we just roll back to previous migration state.
CREATE TABLE briefings (
    id SERIAL PRIMARY KEY,
    company_name VARCHAR(255) NOT NULL,
    ticker VARCHAR(20) NOT NULL,
    sector VARCHAR(120) NOT NULL,
    analyst_name VARCHAR(120) NOT NULL,
    summary TEXT NOT NULL,
    recommendation TEXT NOT NULL,
    key_points JSONB NOT NULL,
    risks JSONB NOT NULL,
    metrics JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
