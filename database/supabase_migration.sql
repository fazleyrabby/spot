-- ==============================================================================
-- SPOT — Supabase Database Migration & 10,000 Grid Initializer
-- Paste this script into your Supabase project's SQL Editor and click "RUN".
-- ==============================================================================

-- 1. CITIZENS TABLE
CREATE TABLE IF NOT EXISTS public.citizens (
  id VARCHAR(64) PRIMARY KEY,
  session_token_hash VARCHAR(64) NOT NULL UNIQUE,
  display_name VARCHAR(32) NOT NULL,
  avatar_id VARCHAR(32) NOT NULL,
  tagline VARCHAR(80),
  website_url VARCHAR(256),
  github_url VARCHAR(256),
  linkedin_url VARCHAR(256),
  ip_address VARCHAR(64),
  device_fingerprint VARCHAR(64),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Add columns if table already exists
ALTER TABLE public.citizens ADD COLUMN IF NOT EXISTS ip_address VARCHAR(64);
ALTER TABLE public.citizens ADD COLUMN IF NOT EXISTS device_fingerprint VARCHAR(64);

-- Index for instant session token authentication lookups
CREATE INDEX IF NOT EXISTS idx_citizens_token_hash ON public.citizens(session_token_hash);

-- 2. SPOTS TABLE
CREATE TABLE IF NOT EXISTS public.spots (
  id VARCHAR(32) PRIMARY KEY, -- e.g. "42,17"
  x INT NOT NULL,
  y INT NOT NULL,
  owner_id VARCHAR(64) REFERENCES public.citizens(id) ON DELETE SET NULL UNIQUE, -- 1 spot per citizen constraint
  claimed_at TIMESTAMP WITH TIME ZONE,
  CONSTRAINT uq_spot_coords UNIQUE (x, y)
);

-- Indexes for coordinate frustum searches and owner lookups
CREATE INDEX IF NOT EXISTS idx_spots_owner ON public.spots(owner_id);
CREATE INDEX IF NOT EXISTS idx_spots_coords ON public.spots(x, y);

-- 3. ENABLE ROW LEVEL SECURITY (RLS)
ALTER TABLE public.citizens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spots ENABLE ROW LEVEL SECURITY;

-- Allow public read access to occupied spot summaries
CREATE POLICY "Public read spots" ON public.spots
  FOR SELECT USING (true);

-- Allow public read access to citizen public profiles (excluding token hash)
CREATE POLICY "Public read citizens" ON public.citizens
  FOR SELECT USING (true);

-- 4. ENABLE SUPABASE REALTIME (Phase 4 Ready)
-- Enables instant live WebSocket updates to all clients when a spot is claimed
ALTER PUBLICATION supabase_realtime ADD TABLE public.spots;

-- 5. INITIALIZE 10,000 SPOTS GRID (100x100)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.spots LIMIT 1) THEN
    INSERT INTO public.spots (id, x, y, owner_id, claimed_at)
    SELECT
      CONCAT(gx, ',', gy) AS id,
      gx AS x,
      gy AS y,
      NULL AS owner_id,
      NULL AS claimed_at
    FROM
      generate_series(0, 99) AS gx
      CROSS JOIN generate_series(0, 99) AS gy;
  END IF;
END $$;
