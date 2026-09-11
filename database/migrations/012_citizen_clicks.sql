-- Migration: 012_citizen_clicks.sql
-- Add click / view counter to citizens and billboards with daily deduplication log for unique visitors

ALTER TABLE citizens
  ADD COLUMN IF NOT EXISTS views_count INT NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS citizen_clicks (
  citizen_id VARCHAR(64) NOT NULL REFERENCES citizens(id) ON DELETE CASCADE,
  visitor_hash VARCHAR(64) NOT NULL,
  clicked_date DATE NOT NULL DEFAULT CURRENT_DATE,
  PRIMARY KEY (citizen_id, visitor_hash, clicked_date)
);

CREATE INDEX IF NOT EXISTS idx_citizen_clicks_cit_date
  ON citizen_clicks(citizen_id, clicked_date);

-- Billboard / Ad spot click tracking
ALTER TABLE billboard_orders
  ADD COLUMN IF NOT EXISTS views_count INT NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS billboard_clicks (
  billboard_id VARCHAR(64) NOT NULL,
  visitor_hash VARCHAR(64) NOT NULL,
  clicked_date DATE NOT NULL DEFAULT CURRENT_DATE,
  PRIMARY KEY (billboard_id, visitor_hash, clicked_date)
);

CREATE INDEX IF NOT EXISTS idx_billboard_clicks_bb_date
  ON billboard_clicks(billboard_id, clicked_date);

CREATE TABLE IF NOT EXISTS billboard_stats (
  billboard_id VARCHAR(64) PRIMARY KEY,
  views_count INT NOT NULL DEFAULT 0
);
