-- Collections
CREATE TABLE IF NOT EXISTS collections (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  icon        TEXT,
  color       TEXT,
  sr_enabled  BOOLEAN DEFAULT true,
  sort_order  INT DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- Add collection_id to tasks
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS collection_id UUID REFERENCES collections(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_collection ON tasks(collection_id);

-- Seed default collection and assign existing tasks (skip if already exists)
INSERT INTO collections (id, name, icon, sr_enabled, sort_order)
SELECT '00000000-0000-0000-0000-000000000001', 'Interview Prep', NULL, true, 0
WHERE NOT EXISTS (SELECT 1 FROM collections WHERE id = '00000000-0000-0000-0000-000000000001');

UPDATE tasks SET collection_id = '00000000-0000-0000-0000-000000000001' WHERE collection_id IS NULL;

-- Review events (single source of truth for streaks + heatmap)
CREATE TABLE IF NOT EXISTS review_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id       UUID REFERENCES tasks(id) ON DELETE SET NULL,
  collection_id UUID REFERENCES collections(id) ON DELETE SET NULL,
  quality       INT NOT NULL CHECK (quality BETWEEN 0 AND 5),
  reviewed_at   DATE NOT NULL DEFAULT CURRENT_DATE
);

CREATE INDEX IF NOT EXISTS idx_review_events_date ON review_events(reviewed_at);
CREATE INDEX IF NOT EXISTS idx_review_events_collection ON review_events(collection_id);

-- Tags
CREATE TABLE IF NOT EXISTS tags (
  id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name  TEXT NOT NULL UNIQUE,
  color TEXT
);

CREATE TABLE IF NOT EXISTS task_tags (
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  tag_id  UUID REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, tag_id)
);

-- Mock interview sessions
CREATE TABLE IF NOT EXISTS mock_sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID REFERENCES collections(id) ON DELETE SET NULL,
  topic         TEXT NOT NULL,
  difficulty    TEXT DEFAULT 'medium' CHECK (difficulty IN ('easy', 'medium', 'hard')),
  messages      JSONB NOT NULL DEFAULT '[]',
  score         JSONB,
  started_at    TIMESTAMPTZ DEFAULT now(),
  completed_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_mock_sessions_collection ON mock_sessions(collection_id);
