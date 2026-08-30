-- Public spot walls: short messages attached to a claimed coordinate.
CREATE TABLE IF NOT EXISTS spot_comments (
  id BIGSERIAL PRIMARY KEY,
  spot_id VARCHAR(32) NOT NULL REFERENCES spots(id) ON DELETE CASCADE,
  author_id VARCHAR(64) REFERENCES citizens(id) ON DELETE SET NULL,
  author_name VARCHAR(32) NOT NULL,
  body VARCHAR(180) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE spots ADD COLUMN IF NOT EXISTS wall_visibility VARCHAR(16) NOT NULL DEFAULT 'readonly';

CREATE INDEX IF NOT EXISTS idx_spot_comments_spot_created
  ON spot_comments(spot_id, created_at DESC);
