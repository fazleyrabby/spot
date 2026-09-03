-- 010_billboard_orders.sql
-- Cyber Billboard Reservations & Sponsorship tracking

CREATE TABLE IF NOT EXISTS billboard_orders (
  id BIGSERIAL PRIMARY KEY,
  gumroad_sale_id VARCHAR(128) NOT NULL UNIQUE,
  billboard_id VARCHAR(64) NOT NULL,
  billboard_name VARCHAR(128),
  tier VARCHAR(64),
  buyer_email VARCHAR(255) NOT NULL,
  buyer_name VARCHAR(255),
  citizen_id VARCHAR(64),
  headline VARCHAR(64) NOT NULL,
  subtext VARCHAR(128),
  target_url TEXT,
  banner_image_url VARCHAR(512),
  brand_color VARCHAR(32),
  price_cents INTEGER NOT NULL DEFAULT 0,
  currency VARCHAR(16) NOT NULL DEFAULT 'usd',
  status VARCHAR(32) NOT NULL DEFAULT 'pending_review', -- 'pending_review', 'live', 'rejected', 'expired'
  raw_payload JSONB,
  starts_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_billboard_orders_billboard ON billboard_orders(billboard_id);
CREATE INDEX IF NOT EXISTS idx_billboard_orders_status ON billboard_orders(status);
CREATE INDEX IF NOT EXISTS idx_billboard_orders_email ON billboard_orders(buyer_email);
