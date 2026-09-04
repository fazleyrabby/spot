-- Migration: 011_email_logs.sql
-- Description: Track transactional email dispatches to prevent duplicate sends and maintain audit trail

CREATE TABLE IF NOT EXISTS email_logs (
  id SERIAL PRIMARY KEY,
  kind VARCHAR(32) NOT NULL,
  reference_id VARCHAR(128) NOT NULL,
  recipient_email VARCHAR(255) NOT NULL,
  resend_id VARCHAR(64),
  status VARCHAR(16) DEFAULT 'sent',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT email_logs_kind_reference_unique UNIQUE (kind, reference_id)
);

CREATE INDEX IF NOT EXISTS idx_email_logs_recipient ON email_logs (recipient_email);
CREATE INDEX IF NOT EXISTS idx_email_logs_kind_ref ON email_logs (kind, reference_id);
