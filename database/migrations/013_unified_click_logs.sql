-- Migration: 013_unified_click_logs.sql
-- Unified interaction & click logs table for monuments, citizens, billboards, and world secrets.
-- Copies all legacy citizen and billboard logs into the unified structure.

-- 1. Create unified click log table
CREATE TABLE IF NOT EXISTS world_click_logs (
  id BIGSERIAL PRIMARY KEY,
  target_type VARCHAR(32) NOT NULL,          -- 'monument', 'citizen', 'billboard', 'secret', 'portal'
  target_id VARCHAR(64) NOT NULL,            -- e.g. 'yorimichi_village', citizen UUID, billboard ID
  source VARCHAR(32) NOT NULL DEFAULT '2d',  -- '2d', 'voxel', 'radar', 'new_tab'
  visitor_hash VARCHAR(64) NOT NULL,
  country VARCHAR(8),
  city VARCHAR(64),
  clicked_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique index: 1 unique count per visitor per target per day
CREATE UNIQUE INDEX IF NOT EXISTS idx_world_clicks_unique
  ON world_click_logs (target_type, target_id, visitor_hash, clicked_date);

-- Fast lookup indexes
CREATE INDEX IF NOT EXISTS idx_world_clicks_lookup
  ON world_click_logs (target_type, target_id, clicked_date);

CREATE INDEX IF NOT EXISTS idx_world_clicks_date
  ON world_click_logs (clicked_date, target_type);

-- 2. Unified fast real-time totals counter
CREATE TABLE IF NOT EXISTS world_interaction_stats (
  target_type VARCHAR(32) NOT NULL,
  target_id VARCHAR(64) NOT NULL,
  total_clicks BIGINT NOT NULL DEFAULT 0,
  unique_visitors BIGINT NOT NULL DEFAULT 0,
  last_clicked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (target_type, target_id)
);

-- 3. Copy existing citizen clicks into unified log
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'citizen_clicks') THEN
    INSERT INTO world_click_logs (target_type, target_id, source, visitor_hash, clicked_date, created_at)
    SELECT 'citizen', citizen_id, '2d', visitor_hash, clicked_date, clicked_date::timestamp
    FROM citizen_clicks
    ON CONFLICT (target_type, target_id, visitor_hash, clicked_date) DO NOTHING;
  END IF;
END $$;

-- 4. Copy existing billboard clicks into unified log
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'billboard_clicks') THEN
    INSERT INTO world_click_logs (target_type, target_id, source, visitor_hash, clicked_date, created_at)
    SELECT 'billboard', billboard_id, '2d', visitor_hash, clicked_date, clicked_date::timestamp
    FROM billboard_clicks
    ON CONFLICT (target_type, target_id, visitor_hash, clicked_date) DO NOTHING;
  END IF;
END $$;

-- 5. Copy existing aggregate stats into world_interaction_stats
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'billboard_stats') THEN
    INSERT INTO world_interaction_stats (target_type, target_id, total_clicks, unique_visitors, last_clicked_at)
    SELECT 'billboard', billboard_id, views_count, views_count, NOW()
    FROM billboard_stats
    ON CONFLICT (target_type, target_id) DO UPDATE SET
      total_clicks = GREATEST(world_interaction_stats.total_clicks, EXCLUDED.total_clicks),
      unique_visitors = GREATEST(world_interaction_stats.unique_visitors, EXCLUDED.unique_visitors);
  END IF;

  IF EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'citizens' AND column_name = 'views_count') THEN
    INSERT INTO world_interaction_stats (target_type, target_id, total_clicks, unique_visitors, last_clicked_at)
    SELECT 'citizen', id, views_count, views_count, NOW()
    FROM citizens
    WHERE views_count > 0
    ON CONFLICT (target_type, target_id) DO UPDATE SET
      total_clicks = GREATEST(world_interaction_stats.total_clicks, EXCLUDED.total_clicks),
      unique_visitors = GREATEST(world_interaction_stats.unique_visitors, EXCLUDED.unique_visitors);
  END IF;
END $$;
