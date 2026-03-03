-- MCP API keys
CREATE TABLE IF NOT EXISTS mcp_keys (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  key_hash    TEXT NOT NULL,
  key_prefix  TEXT NOT NULL,
  scopes      TEXT[] DEFAULT '{read}',
  last_used_at TIMESTAMPTZ,
  expires_at  TIMESTAMPTZ,
  revoked_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mcp_keys_user_id ON mcp_keys(user_id);

-- Server settings (key-value)
CREATE TABLE IF NOT EXISTS server_settings (
  key   TEXT PRIMARY KEY,
  value JSONB NOT NULL
);

INSERT INTO server_settings (key, value) VALUES ('mcp_enabled', 'true')
  ON CONFLICT DO NOTHING;

-- Per-user MCP toggle (default off — opt-in)
ALTER TABLE users ADD COLUMN IF NOT EXISTS mcp_enabled BOOLEAN DEFAULT false;

-- MCP audit log
CREATE TABLE IF NOT EXISTS mcp_audit_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_id      UUID REFERENCES mcp_keys(id) ON DELETE SET NULL,
  user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  tool_name   TEXT NOT NULL,
  success     BOOLEAN NOT NULL,
  error       TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mcp_audit_log_user_id ON mcp_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_mcp_audit_log_created_at ON mcp_audit_log(created_at);
