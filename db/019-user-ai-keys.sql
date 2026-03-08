CREATE TABLE IF NOT EXISTS user_ai_keys (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  provider        TEXT NOT NULL CHECK (provider IN ('anthropic', 'openai')),
  model           TEXT,
  encrypted_key   TEXT NOT NULL,
  key_prefix      TEXT NOT NULL,
  key_version     INT NOT NULL DEFAULT 1,
  expires_at      TIMESTAMPTZ NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_ai_keys_expires ON user_ai_keys (expires_at);
