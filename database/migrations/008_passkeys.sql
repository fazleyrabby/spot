-- WebAuthn credentials and short-lived challenges for cross-browser guest recovery.
CREATE TABLE IF NOT EXISTS citizen_passkeys (
  id BIGSERIAL PRIMARY KEY,
  citizen_id VARCHAR(64) NOT NULL REFERENCES citizens(id) ON DELETE CASCADE,
  credential_id VARCHAR(512) NOT NULL UNIQUE,
  public_key BYTEA NOT NULL,
  counter BIGINT NOT NULL DEFAULT 0,
  transports TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_citizen_passkeys_citizen ON citizen_passkeys(citizen_id);

CREATE TABLE IF NOT EXISTS webauthn_challenges (
  id BIGSERIAL PRIMARY KEY,
  citizen_id VARCHAR(64) REFERENCES citizens(id) ON DELETE CASCADE,
  challenge VARCHAR(512) NOT NULL,
  kind VARCHAR(16) NOT NULL CHECK (kind IN ('register', 'authenticate')),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webauthn_challenges_expiry ON webauthn_challenges(expires_at);
