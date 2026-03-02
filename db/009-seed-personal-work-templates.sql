-- Seed Personal and Work system templates
-- (These were added to 008 after it had already been applied)

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
  ('Grocery shopping', NULL, 'todo', 'Errands', 0),
  ('Schedule dentist appointment', NULL, 'todo', 'Health', 1)
) AS t(title, description, status_name, topic, sort_order);

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
  ('Prepare sprint planning notes', NULL, 'todo', 'Meetings', 0),
  ('Follow up on design review', NULL, 'todo', 'Follow-ups', 1)
) AS t(title, description, status_name, topic, sort_order);

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
