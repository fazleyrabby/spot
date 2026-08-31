-- Manual City Showcase sponsorship inquiries.
-- Payment and activation remain separate until an invoice is paid and reviewed.
CREATE TABLE IF NOT EXISTS sponsorship_requests (
  id VARCHAR(64) PRIMARY KEY,
  contact_name VARCHAR(80) NOT NULL,
  email VARCHAR(254) NOT NULL,
  business_name VARCHAR(80) NOT NULL,
  website_url VARCHAR(512) NOT NULL,
  description VARCHAR(500) NOT NULL,
  logo_url VARCHAR(512),
  tier VARCHAR(20) NOT NULL CHECK (tier IN ('basic', 'featured', 'premium')),
  ad_slot_key VARCHAR(32) CHECK (ad_slot_key IS NULL OR ad_slot_key IN ('premium-1', 'premium-2', 'featured-1', 'featured-2')),
  status VARCHAR(24) NOT NULL DEFAULT 'inquiry'
    CHECK (status IN ('inquiry', 'awaiting_payment', 'paid_pending_review', 'approved', 'inactive', 'rejected', 'closed')),
  invoice_reference VARCHAR(128),
  ip_address INET,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sponsorship_requests_status_created
  ON sponsorship_requests(status, created_at DESC);

ALTER TABLE sponsorship_requests ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON sponsorship_requests FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON sponsorship_requests FROM authenticated;
  END IF;
END $$;
