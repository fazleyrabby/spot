-- ==============================================================================
-- SPOT — Moderation flags (profanity warnings per device fingerprint / IP)
-- Auto-rename offenders and track repeat attempts; block after threshold.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.moderation_flags (
  device_key TEXT PRIMARY KEY,          -- "fp:<fingerprint>" or "ip:<address>"
  device_fingerprint VARCHAR(64),
  ip_address VARCHAR(64),
  warning_count INT NOT NULL DEFAULT 1,
  last_attempt TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_moderation_flags_fp ON public.moderation_flags(device_fingerprint);
CREATE INDEX IF NOT EXISTS idx_moderation_flags_ip ON public.moderation_flags(ip_address);
