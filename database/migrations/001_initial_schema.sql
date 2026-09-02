-- Initial Schema for Spot

CREATE TABLE IF NOT EXISTS citizens (
  id VARCHAR(64) PRIMARY KEY,
  session_token_hash VARCHAR(64) NOT NULL UNIQUE,
  display_name VARCHAR(32) NOT NULL,
  avatar_id VARCHAR(32) NOT NULL,
  tagline VARCHAR(80),
  bio VARCHAR(280),
  website_url VARCHAR(256),
  github_url VARCHAR(256),
  github_id VARCHAR(64) UNIQUE,
  email VARCHAR(256),
  avatar_url VARCHAR(512),
  twitter_url VARCHAR(256),
  facebook_url VARCHAR(256),
  instagram_url VARCHAR(256),
  youtube_url VARCHAR(256),
  linkedin_url VARCHAR(256),
  custom_avatar_data TEXT,
  ip_address VARCHAR(64),
  device_fingerprint VARCHAR(64),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_citizens_token_hash ON citizens(session_token_hash);
CREATE INDEX IF NOT EXISTS idx_citizens_github_id ON citizens(github_id);
CREATE INDEX IF NOT EXISTS idx_citizens_device_fingerprint ON citizens(device_fingerprint);

CREATE TABLE IF NOT EXISTS spots (
  id VARCHAR(32) PRIMARY KEY,
  x INT NOT NULL,
  y INT NOT NULL,
  owner_id VARCHAR(64) REFERENCES citizens(id) ON DELETE SET NULL UNIQUE,
  claimed_at TIMESTAMP WITH TIME ZONE,
  CONSTRAINT uq_spot_coords UNIQUE (x, y)
);

CREATE INDEX IF NOT EXISTS idx_spots_owner ON spots(owner_id);
CREATE INDEX IF NOT EXISTS idx_spots_coords ON spots(x, y);

-- Local/authoritative API visitor counter
CREATE TABLE IF NOT EXISTS site_stats (
  key VARCHAR(64) PRIMARY KEY,
  value BIGINT NOT NULL DEFAULT 0
);

INSERT INTO site_stats (key, value)
VALUES ('total_visitors', 1)
ON CONFLICT (key) DO NOTHING;

-- Function to seed 10,000 spots if empty
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM spots LIMIT 1) THEN
    INSERT INTO spots (id, x, y, owner_id, claimed_at)
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
