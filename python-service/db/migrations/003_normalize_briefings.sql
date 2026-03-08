-- Drop the old simple briefings table
DROP TABLE IF EXISTS briefings CASCADE;

-- Create the main briefings table
CREATE TABLE briefings (
    id SERIAL PRIMARY KEY,
    company_name VARCHAR(255) NOT NULL,
    ticker VARCHAR(20) NOT NULL,
    sector VARCHAR(120) NOT NULL,
    analyst_name VARCHAR(120) NOT NULL,
    summary TEXT NOT NULL,
    recommendation TEXT NOT NULL,
    is_generated BOOLEAN NOT NULL DEFAULT FALSE,
    generated_html TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create table for key points and risks
CREATE TABLE briefing_points (
    id SERIAL PRIMARY KEY,
    briefing_id INTEGER NOT NULL REFERENCES briefings(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('key_point', 'risk'))
);

-- Create table for metrics
CREATE TABLE briefing_metrics (
    id SERIAL PRIMARY KEY,
    briefing_id INTEGER NOT NULL REFERENCES briefings(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    value VARCHAR(50) NOT NULL,
    UNIQUE(briefing_id, name)
);

-- Add indexes for performance
CREATE INDEX idx_briefing_points_briefing_id ON briefing_points(briefing_id);
CREATE INDEX idx_briefing_metrics_briefing_id ON briefing_metrics(briefing_id);
