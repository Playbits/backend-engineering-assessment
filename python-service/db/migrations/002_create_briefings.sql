CREATE TABLE IF NOT EXISTS briefings (
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
