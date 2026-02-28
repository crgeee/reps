-- Collection templates: reusable blueprints for creating new collections

-- Template definitions
CREATE TABLE IF NOT EXISTS collection_templates (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  description   TEXT,
  icon          TEXT,
  color         TEXT,
  sr_enabled    BOOLEAN DEFAULT false,
  default_view  TEXT DEFAULT 'list' CHECK (default_view IN ('list', 'board')),
  is_system     BOOLEAN DEFAULT false,
  user_id       UUID REFERENCES users(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_collection_templates_user ON collection_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_collection_templates_system ON collection_templates(is_system) WHERE is_system = true;

-- Template statuses (define the columns/workflow for a template)
CREATE TABLE IF NOT EXISTS template_statuses (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id   UUID REFERENCES collection_templates(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  color         TEXT,
  sort_order    INT DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_template_statuses_template ON template_statuses(template_id);

-- Template tasks (editable sample tasks included with the template)
CREATE TABLE IF NOT EXISTS template_tasks (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id   UUID REFERENCES collection_templates(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  description   TEXT,
  status_name   TEXT NOT NULL,
  topic         TEXT DEFAULT 'custom',
  sort_order    INT DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_template_tasks_template ON template_tasks(template_id);

-- Add default_view to existing collections table
ALTER TABLE collections ADD COLUMN IF NOT EXISTS default_view TEXT DEFAULT 'list';

-- =============================================================================
-- Seed system templates
-- =============================================================================

-- 1. Interview Prep
WITH tmpl AS (
  INSERT INTO collection_templates (name, description, icon, color, sr_enabled, default_view, is_system)
  VALUES (
    'Interview Prep',
    'Track your technical interview preparation with spaced repetition across coding, system design, and behavioral topics.',
    'GraduationCap',
    '#8b5cf6',
    true,
    'board',
    true
  )
  RETURNING id
),
statuses AS (
  INSERT INTO template_statuses (template_id, name, color, sort_order)
  SELECT tmpl.id, s.name, s.color, s.sort_order
  FROM tmpl
  CROSS JOIN (VALUES
    ('todo',       '#71717a', 0),
    ('studying',   '#3b82f6', 1),
    ('practicing', '#f59e0b', 2),
    ('confident',  '#10b981', 3),
    ('mastered',   '#8b5cf6', 4)
  ) AS s(name, color, sort_order)
)
INSERT INTO template_tasks (template_id, title, description, status_name, topic, sort_order)
SELECT tmpl.id, t.title, t.description, t.status_name, t.topic, t.sort_order
FROM tmpl
CROSS JOIN (VALUES
  ('System design: URL shortener',
   'Design a URL shortening service like bit.ly. Consider scale, storage, and redirect latency.',
   'todo', 'system-design', 0),
  ('Behavioral: conflict resolution',
   'Prepare a STAR-format story about resolving a technical disagreement with a teammate.',
   'todo', 'behavioral', 1),
  ('LeetCode: sliding window',
   'Practice sliding window pattern problems. Focus on variable-width windows and edge cases.',
   'todo', 'coding', 2)
) AS t(title, description, status_name, topic, sort_order);

-- 2. Task Manager
WITH tmpl AS (
  INSERT INTO collection_templates (name, description, icon, color, sr_enabled, default_view, is_system)
  VALUES (
    'Task Manager',
    'A simple project task board for tracking work items from backlog through completion.',
    'ListChecks',
    '#3b82f6',
    false,
    'list',
    true
  )
  RETURNING id
),
statuses AS (
  INSERT INTO template_statuses (template_id, name, color, sort_order)
  SELECT tmpl.id, s.name, s.color, s.sort_order
  FROM tmpl
  CROSS JOIN (VALUES
    ('backlog',     '#71717a', 0),
    ('todo',        '#3b82f6', 1),
    ('in-progress', '#f59e0b', 2),
    ('done',        '#22c55e', 3)
  ) AS s(name, color, sort_order)
)
INSERT INTO template_tasks (template_id, title, description, status_name, topic, sort_order)
SELECT tmpl.id, t.title, t.description, t.status_name, t.topic, t.sort_order
FROM tmpl
CROSS JOIN (VALUES
  ('Set up project structure',
   'Initialize the repository, configure build tools, and establish the directory layout.',
   'backlog', 'custom', 0),
  ('Write documentation',
   'Draft README, API docs, and contributor guidelines for the project.',
   'backlog', 'custom', 1),
  ('Review pull requests',
   'Review open PRs for code quality, test coverage, and adherence to team standards.',
   'backlog', 'custom', 2)
) AS t(title, description, status_name, topic, sort_order);

-- 3. Bug Tracker
WITH tmpl AS (
  INSERT INTO collection_templates (name, description, icon, color, sr_enabled, default_view, is_system)
  VALUES (
    'Bug Tracker',
    'Track bugs through triage, investigation, fix, and verification stages.',
    'Bug',
    '#ef4444',
    false,
    'board',
    true
  )
  RETURNING id
),
statuses AS (
  INSERT INTO template_statuses (template_id, name, color, sort_order)
  SELECT tmpl.id, s.name, s.color, s.sort_order
  FROM tmpl
  CROSS JOIN (VALUES
    ('triage',        '#71717a', 0),
    ('investigating', '#3b82f6', 1),
    ('fixing',        '#f59e0b', 2),
    ('in-review',     '#8b5cf6', 3),
    ('verified',      '#10b981', 4),
    ('closed',        '#22c55e', 5)
  ) AS s(name, color, sort_order)
)
INSERT INTO template_tasks (template_id, title, description, status_name, topic, sort_order)
SELECT tmpl.id, t.title, t.description, t.status_name, t.topic, t.sort_order
FROM tmpl
CROSS JOIN (VALUES
  ('Login page 500 error',
   'Users intermittently see a 500 error on the login page. Check auth middleware and session handling.',
   'triage', 'custom', 0),
  ('Dark mode contrast issue',
   'Several text elements have insufficient contrast ratio in dark mode. Audit against WCAG AA standards.',
   'triage', 'custom', 1)
) AS t(title, description, status_name, topic, sort_order);

-- 4. Learning Tracker
WITH tmpl AS (
  INSERT INTO collection_templates (name, description, icon, color, sr_enabled, default_view, is_system)
  VALUES (
    'Learning Tracker',
    'Track topics you are learning with spaced repetition to reinforce knowledge over time.',
    'BookOpen',
    '#22c55e',
    true,
    'board',
    true
  )
  RETURNING id
),
statuses AS (
  INSERT INTO template_statuses (template_id, name, color, sort_order)
  SELECT tmpl.id, s.name, s.color, s.sort_order
  FROM tmpl
  CROSS JOIN (VALUES
    ('to-learn',   '#71717a', 0),
    ('learning',   '#3b82f6', 1),
    ('practicing', '#f59e0b', 2),
    ('mastered',   '#22c55e', 3)
  ) AS s(name, color, sort_order)
)
INSERT INTO template_tasks (template_id, title, description, status_name, topic, sort_order)
SELECT tmpl.id, t.title, t.description, t.status_name, t.topic, t.sort_order
FROM tmpl
CROSS JOIN (VALUES
  ('TypeScript generics',
   'Learn generic types, constraints, conditional types, and mapped types in TypeScript.',
   'to-learn', 'custom', 0),
  ('React Server Components',
   'Understand the RSC architecture, server/client boundary, and streaming rendering patterns.',
   'to-learn', 'custom', 1)
) AS t(title, description, status_name, topic, sort_order);

-- 5. Reading List
WITH tmpl AS (
  INSERT INTO collection_templates (name, description, icon, color, sr_enabled, default_view, is_system)
  VALUES (
    'Reading List',
    'Keep track of books and papers you want to read, with notes and progress tracking.',
    'Library',
    '#f59e0b',
    false,
    'list',
    true
  )
  RETURNING id
),
statuses AS (
  INSERT INTO template_statuses (template_id, name, color, sort_order)
  SELECT tmpl.id, s.name, s.color, s.sort_order
  FROM tmpl
  CROSS JOIN (VALUES
    ('to-read',      '#71717a', 0),
    ('reading',      '#3b82f6', 1),
    ('taking-notes', '#f59e0b', 2),
    ('finished',     '#22c55e', 3)
  ) AS s(name, color, sort_order)
)
INSERT INTO template_tasks (template_id, title, description, status_name, topic, sort_order)
SELECT tmpl.id, t.title, t.description, t.status_name, t.topic, t.sort_order
FROM tmpl
CROSS JOIN (VALUES
  ('Designing Data-Intensive Applications',
   'Martin Kleppmann''s deep dive into distributed systems, replication, partitioning, and batch/stream processing.',
   'to-read', 'papers', 0),
  ('Clean Architecture',
   'Robert C. Martin''s guide to software architecture principles, dependency rules, and component design.',
   'to-read', 'papers', 1)
) AS t(title, description, status_name, topic, sort_order);
