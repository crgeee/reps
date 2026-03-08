-- Learning Tracks feature tables

CREATE TABLE IF NOT EXISTS tracks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        TEXT UNIQUE NOT NULL,
  title       TEXT NOT NULL,
  description TEXT,
  image_url   TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS modules (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  track_id       UUID NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  slug           TEXT NOT NULL,
  title          TEXT NOT NULL,
  description    TEXT,
  sort_order     INT NOT NULL,
  prerequisites  UUID[] DEFAULT '{}',
  concepts       TEXT[] DEFAULT '{}',
  created_at     TIMESTAMPTZ DEFAULT now(),
  UNIQUE(track_id, slug)
);

CREATE TABLE IF NOT EXISTS user_progress (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  module_id     UUID NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  status        TEXT NOT NULL DEFAULT 'locked' CHECK (status IN ('locked', 'active', 'completed')),
  repetitions   INT DEFAULT 0,
  interval      INT DEFAULT 1,
  ease_factor   FLOAT DEFAULT 2.5,
  next_review   DATE,
  last_reviewed DATE,
  created_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, module_id)
);

CREATE TABLE IF NOT EXISTS exercises (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id     UUID NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  type          TEXT NOT NULL CHECK (type IN ('code', 'knowledge', 'mini-app')),
  prompt        TEXT NOT NULL,
  starter_code  TEXT,
  test_code     TEXT,
  difficulty    INT DEFAULT 1 CHECK (difficulty BETWEEN 1 AND 3),
  generated_by  TEXT NOT NULL DEFAULT 'ai' CHECK (generated_by IN ('ai', 'manual')),
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS submissions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exercise_id   UUID NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_code     TEXT NOT NULL,
  stdout        TEXT,
  stderr        TEXT,
  passed        BOOLEAN,
  ai_feedback   TEXT,
  score         INT CHECK (score BETWEEN 1 AND 5),
  execution_ms  INT,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS settings (
  key        TEXT PRIMARY KEY,
  value      JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_modules_track_order ON modules(track_id, sort_order);
CREATE INDEX idx_user_progress_user_module ON user_progress(user_id, module_id);
CREATE INDEX idx_exercises_module ON exercises(module_id);
CREATE INDEX idx_submissions_exercise ON submissions(exercise_id);
CREATE INDEX idx_submissions_user ON submissions(user_id, created_at DESC);
