-- Security hardening for server-only identity and abuse-control data.
-- PostgREST clients must never be able to read or forge these records.
CREATE TABLE IF NOT EXISTS citizen_sessions (
  id BIGSERIAL PRIMARY KEY,
  citizen_id VARCHAR(64) NOT NULL REFERENCES citizens(id) ON DELETE CASCADE,
  token_hash VARCHAR(64) NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '10 years')
);

CREATE INDEX IF NOT EXISTS idx_citizen_sessions_citizen ON citizen_sessions(citizen_id);
CREATE INDEX IF NOT EXISTS idx_citizen_sessions_expiry ON citizen_sessions(expires_at);

ALTER TABLE citizen_passkeys ENABLE ROW LEVEL SECURITY;
ALTER TABLE webauthn_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE citizen_sessions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON citizen_passkeys, webauthn_challenges, citizen_sessions FROM anon, authenticated';
    EXECUTE 'REVOKE ALL ON SEQUENCE citizen_sessions_id_seq FROM anon, authenticated';
  END IF;
END $$;

