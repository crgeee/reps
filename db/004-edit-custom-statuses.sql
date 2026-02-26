-- Drop hardcoded status CHECK constraint
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_status_check;

-- New task fields
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'none'
  CHECK (priority IN ('none', 'low', 'medium', 'high'));

-- Custom statuses per collection
CREATE TABLE IF NOT EXISTS collection_statuses (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID REFERENCES collections(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  color         TEXT,
  sort_order    INT NOT NULL DEFAULT 0,
  UNIQUE (collection_id, name)
);
CREATE INDEX IF NOT EXISTS idx_collection_statuses_collection ON collection_statuses(collection_id);

-- Seed defaults for existing collections
INSERT INTO collection_statuses (collection_id, name, color, sort_order)
SELECT c.id, s.name, s.color, s.sort_order
FROM collections c
CROSS JOIN (VALUES
  ('todo', '#71717a', 0),
  ('in-progress', '#3b82f6', 1),
  ('review', '#f59e0b', 2),
  ('done', '#22c55e', 3)
) AS s(name, color, sort_order)
ON CONFLICT (collection_id, name) DO NOTHING;
