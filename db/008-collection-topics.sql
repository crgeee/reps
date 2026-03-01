-- Collection topics: categorize items within templates and collections

-- Template topics (blueprint for collection topics)
CREATE TABLE IF NOT EXISTS template_topics (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id   UUID REFERENCES collection_templates(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  color         TEXT,
  sort_order    INT DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_template_topics_template ON template_topics(template_id);

-- Collection topics (instantiated from template topics or user-created)
CREATE TABLE IF NOT EXISTS collection_topics (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID REFERENCES collections(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  color         TEXT,
  sort_order    INT DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_collection_topics_collection ON collection_topics(collection_id);

-- Relax tasks.topic CHECK constraint to allow arbitrary topic strings
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_topic_check;
ALTER TABLE tasks ADD CONSTRAINT tasks_topic_check CHECK (char_length(topic) > 0 AND char_length(topic) <= 100);

-- =============================================================================
-- Seed template topics for system templates
-- =============================================================================

-- Interview Prep
INSERT INTO template_topics (template_id, name, color, sort_order)
SELECT ct.id, t.name, t.color, t.sort_order
FROM collection_templates ct
CROSS JOIN (VALUES
  ('Coding',        '#3b82f6', 0),
  ('System Design', '#8b5cf6', 1),
  ('Behavioral',    '#10b981', 2),
  ('Papers',        '#f59e0b', 3)
) AS t(name, color, sort_order)
WHERE ct.name = 'Interview Prep' AND ct.is_system = true
AND NOT EXISTS (
  SELECT 1 FROM template_topics tt WHERE tt.template_id = ct.id
);

-- Task Manager
INSERT INTO template_topics (template_id, name, color, sort_order)
SELECT ct.id, t.name, t.color, t.sort_order
FROM collection_templates ct
CROSS JOIN (VALUES
  ('Feature', '#3b82f6', 0),
  ('Bug',     '#ef4444', 1),
  ('Chore',   '#71717a', 2)
) AS t(name, color, sort_order)
WHERE ct.name = 'Task Manager' AND ct.is_system = true
AND NOT EXISTS (
  SELECT 1 FROM template_topics tt WHERE tt.template_id = ct.id
);

-- Bug Tracker
INSERT INTO template_topics (template_id, name, color, sort_order)
SELECT ct.id, t.name, t.color, t.sort_order
FROM collection_templates ct
CROSS JOIN (VALUES
  ('Frontend', '#3b82f6', 0),
  ('Backend',  '#8b5cf6', 1),
  ('Infra',    '#f59e0b', 2)
) AS t(name, color, sort_order)
WHERE ct.name = 'Bug Tracker' AND ct.is_system = true
AND NOT EXISTS (
  SELECT 1 FROM template_topics tt WHERE tt.template_id = ct.id
);

-- Learning Tracker
INSERT INTO template_topics (template_id, name, color, sort_order)
SELECT ct.id, t.name, t.color, t.sort_order
FROM collection_templates ct
CROSS JOIN (VALUES
  ('Concept',  '#3b82f6', 0),
  ('Practice', '#f59e0b', 1),
  ('Project',  '#10b981', 2)
) AS t(name, color, sort_order)
WHERE ct.name = 'Learning Tracker' AND ct.is_system = true
AND NOT EXISTS (
  SELECT 1 FROM template_topics tt WHERE tt.template_id = ct.id
);

-- Reading List
INSERT INTO template_topics (template_id, name, color, sort_order)
SELECT ct.id, t.name, t.color, t.sort_order
FROM collection_templates ct
CROSS JOIN (VALUES
  ('Book',    '#8b5cf6', 0),
  ('Paper',   '#f59e0b', 1),
  ('Article', '#3b82f6', 2)
) AS t(name, color, sort_order)
WHERE ct.name = 'Reading List' AND ct.is_system = true
AND NOT EXISTS (
  SELECT 1 FROM template_topics tt WHERE tt.template_id = ct.id
);
