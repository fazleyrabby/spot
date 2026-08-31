-- Guest anti-abuse metadata. These values are signals, not authentication.
ALTER TABLE citizens
  ADD COLUMN IF NOT EXISTS device_fingerprint VARCHAR(64);

CREATE INDEX IF NOT EXISTS idx_citizens_device_fingerprint
  ON citizens(device_fingerprint);
