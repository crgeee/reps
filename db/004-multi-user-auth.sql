-- Multi-user auth: users, sessions, magic links, device auth, custom topics

-- Users
CREATE TABLE IF NOT EXISTS users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email           TEXT NOT NULL UNIQUE,
  display_name    TEXT,
  email_verified  BOOLEAN DEFAULT false,
  is_admin        BOOLEAN DEFAULT false,
  timezone        TEXT DEFAULT 'UTC',
  theme           TEXT DEFAULT 'dark' CHECK (theme IN ('dark', 'light', 'system')),
  notify_daily    BOOLEAN DEFAULT true,
  notify_weekly   BOOLEAN DEFAULT true,
  daily_review_goal INT DEFAULT 5 CHECK (daily_review_goal BETWEEN 1 AND 50),
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- Sessions (DB-backed, opaque tokens)
CREATE TABLE IF NOT EXISTS sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash      TEXT NOT NULL UNIQUE,
  expires_at      TIMESTAMPTZ NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT now(),
  last_used_at    TIMESTAMPTZ DEFAULT now(),
  user_agent      TEXT,
  ip_address      TEXT
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

-- Magic link tokens
CREATE TABLE IF NOT EXISTS magic_link_tokens (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email           TEXT NOT NULL,
  token_hash      TEXT NOT NULL UNIQUE,
  expires_at      TIMESTAMPTZ NOT NULL,
  used            BOOLEAN DEFAULT false,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_magic_link_expires ON magic_link_tokens(expires_at);

-- Device auth codes (CLI login)
CREATE TABLE IF NOT EXISTS device_auth_codes (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_code         TEXT NOT NULL UNIQUE,
  device_code_hash  TEXT NOT NULL UNIQUE,
  user_id           UUID REFERENCES users(id) ON DELETE CASCADE,
  session_token_hash TEXT,
  expires_at        TIMESTAMPTZ NOT NULL,
  approved          BOOLEAN DEFAULT false,
  denied            BOOLEAN DEFAULT false,
  created_at        TIMESTAMPTZ DEFAULT now()
);

-- Custom topics per user
CREATE TABLE IF NOT EXISTS custom_topics (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  color           TEXT,
  UNIQUE(user_id, name)
);

CREATE INDEX IF NOT EXISTS idx_custom_topics_user ON custom_topics(user_id);

-- Add user_id to existing tables (nullable initially for migration)
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE collections ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE tags ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE agent_logs ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE mock_sessions ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE review_events ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;

-- Indexes on user_id
CREATE INDEX IF NOT EXISTS idx_tasks_user ON tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_collections_user ON collections(user_id);
CREATE INDEX IF NOT EXISTS idx_tags_user ON tags(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_logs_user ON agent_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_mock_sessions_user ON mock_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_review_events_user ON review_events(user_id);

-- Update tags unique constraint: from global to per-user
-- Drop old unique constraint on name, add per-user unique
ALTER TABLE tags DROP CONSTRAINT IF EXISTS tags_name_key;
-- Add unique constraint per user (will be enforced after migration backfill)
-- Can't add NOT NULL yet — need to backfill user_id first via migrate-users script
