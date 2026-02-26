ALTER TABLE tasks ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'todo'
  CHECK (status IN ('todo', 'in-progress', 'review', 'done'));

UPDATE tasks SET status = 'done' WHERE completed = true;
