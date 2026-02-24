CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS tasks (
  id            UUID PRIMARY KEY,
  topic         TEXT NOT NULL CHECK (topic IN ('coding','system-design','behavioral','papers','custom')),
  title         TEXT NOT NULL,
  completed     BOOLEAN DEFAULT false,
  deadline      DATE,
  repetitions   INT DEFAULT 0,
  interval      INT DEFAULT 1,
  ease_factor   FLOAT DEFAULT 2.5,
  next_review   DATE NOT NULL,
  last_reviewed DATE,
  created_at    DATE NOT NULL
);

CREATE TABLE IF NOT EXISTS notes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id     UUID REFERENCES tasks(id) ON DELETE CASCADE,
  text        TEXT NOT NULL,
  created_at  DATE NOT NULL
);

CREATE TABLE IF NOT EXISTS agent_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type        TEXT NOT NULL,
  task_id     UUID REFERENCES tasks(id) ON DELETE SET NULL,
  input       TEXT,
  output      TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
);
