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
CREATE UNIQUE INDEX IF NOT EXISTS idx_template_topics_unique_name ON template_topics(template_id, name);

-- Collection topics (instantiated from template topics or user-created)
CREATE TABLE IF NOT EXISTS collection_topics (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID REFERENCES collections(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  color         TEXT,
  sort_order    INT DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_collection_topics_collection ON collection_topics(collection_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_collection_topics_unique_name ON collection_topics(collection_id, name);

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

-- =============================================================================
-- Seed additional system templates: Personal & Work
-- =============================================================================

-- 6. Personal
WITH tmpl AS (
  INSERT INTO collection_templates (name, description, icon, color, sr_enabled, default_view, is_system)
  SELECT 'Personal',
    'Track personal tasks, errands, and goals.',
    'Home',
    '#ec4899',
    false,
    'list',
    true
  WHERE NOT EXISTS (
    SELECT 1 FROM collection_templates WHERE name = 'Personal' AND is_system = true
  )
  RETURNING id
),
statuses AS (
  INSERT INTO template_statuses (template_id, name, color, sort_order)
  SELECT tmpl.id, s.name, s.color, s.sort_order
  FROM tmpl
  CROSS JOIN (VALUES
    ('todo',        '#71717a', 0),
    ('in-progress', '#3b82f6', 1),
    ('waiting',     '#f59e0b', 2),
    ('done',        '#22c55e', 3)
  ) AS s(name, color, sort_order)
)
INSERT INTO template_tasks (template_id, title, description, status_name, topic, sort_order)
SELECT tmpl.id, t.title, t.description, t.status_name, t.topic, t.sort_order
FROM tmpl
CROSS JOIN (VALUES
  ('Grocery shopping',
   NULL,
   'todo', 'Errands', 0),
  ('Schedule dentist appointment',
   NULL,
   'todo', 'Health', 1)
) AS t(title, description, status_name, topic, sort_order);

-- Personal topics
INSERT INTO template_topics (template_id, name, color, sort_order)
SELECT ct.id, t.name, t.color, t.sort_order
FROM collection_templates ct
CROSS JOIN (VALUES
  ('Errands',  '#3b82f6', 0),
  ('Health',   '#22c55e', 1),
  ('Finance',  '#f59e0b', 2),
  ('Home',     '#8b5cf6', 3)
) AS t(name, color, sort_order)
WHERE ct.name = 'Personal' AND ct.is_system = true
AND NOT EXISTS (
  SELECT 1 FROM template_topics tt WHERE tt.template_id = ct.id
);

-- 7. Work
WITH tmpl AS (
  INSERT INTO collection_templates (name, description, icon, color, sr_enabled, default_view, is_system)
  SELECT 'Work',
    'Manage work tasks, projects, and follow-ups.',
    'Briefcase',
    '#06b6d4',
    false,
    'list',
    true
  WHERE NOT EXISTS (
    SELECT 1 FROM collection_templates WHERE name = 'Work' AND is_system = true
  )
  RETURNING id
),
statuses AS (
  INSERT INTO template_statuses (template_id, name, color, sort_order)
  SELECT tmpl.id, s.name, s.color, s.sort_order
  FROM tmpl
  CROSS JOIN (VALUES
    ('todo',        '#71717a', 0),
    ('in-progress', '#3b82f6', 1),
    ('blocked',     '#ef4444', 2),
    ('done',        '#22c55e', 3)
  ) AS s(name, color, sort_order)
)
INSERT INTO template_tasks (template_id, title, description, status_name, topic, sort_order)
SELECT tmpl.id, t.title, t.description, t.status_name, t.topic, t.sort_order
FROM tmpl
CROSS JOIN (VALUES
  ('Prepare sprint planning notes',
   NULL,
   'todo', 'Meetings', 0),
  ('Follow up on design review',
   NULL,
   'todo', 'Follow-ups', 1)
) AS t(title, description, status_name, topic, sort_order);

-- Work topics
INSERT INTO template_topics (template_id, name, color, sort_order)
SELECT ct.id, t.name, t.color, t.sort_order
FROM collection_templates ct
CROSS JOIN (VALUES
  ('Projects',   '#3b82f6', 0),
  ('Meetings',   '#8b5cf6', 1),
  ('Follow-ups', '#f59e0b', 2),
  ('Admin',      '#71717a', 3)
) AS t(name, color, sort_order)
WHERE ct.name = 'Work' AND ct.is_system = true
AND NOT EXISTS (
  SELECT 1 FROM template_topics tt WHERE tt.template_id = ct.id
);
