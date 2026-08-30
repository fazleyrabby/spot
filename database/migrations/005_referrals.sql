-- Lightweight adjacency-based referral relationships.
CREATE TABLE IF NOT EXISTS referrals (
  id BIGSERIAL PRIMARY KEY,
  referrer_spot_id VARCHAR(32) NOT NULL REFERENCES spots(id) ON DELETE CASCADE,
  referred_spot_id VARCHAR(32) NOT NULL UNIQUE REFERENCES spots(id) ON DELETE CASCADE,
  referrer_id VARCHAR(64) REFERENCES citizens(id) ON DELETE SET NULL,
  referred_id VARCHAR(64) REFERENCES citizens(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_referral_pair UNIQUE (referrer_spot_id, referred_spot_id)
);

CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_spot_id);
