-- Add recurring task support
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS recurrence_type TEXT NOT NULL DEFAULT 'none'
    CHECK (recurrence_type IN ('none', 'daily', 'every-2-days', 'every-3-days', 'weekly', 'biweekly', 'monthly', 'quarterly', 'semi-annually')),
  ADD COLUMN IF NOT EXISTS recurrence_end DATE,
  ADD COLUMN IF NOT EXISTS recurrence_parent_id UUID REFERENCES tasks(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_recurrence_parent_id ON tasks (recurrence_parent_id);
