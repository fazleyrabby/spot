-- Initial Schema for Spot

CREATE TABLE IF NOT EXISTS citizens (
  id VARCHAR(64) PRIMARY KEY,
  session_token_hash VARCHAR(64) NOT NULL UNIQUE,
  display_name VARCHAR(32) NOT NULL,
  avatar_id VARCHAR(32) NOT NULL,
  tagline VARCHAR(80),
  website_url VARCHAR(256),
  github_url VARCHAR(256),
  linkedin_url VARCHAR(256),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_citizens_token_hash ON citizens(session_token_hash);

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
