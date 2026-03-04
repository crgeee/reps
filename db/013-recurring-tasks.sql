-- Flexible recurrence: interval + unit + day replaces fixed recurrence_type enum
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS recurrence_interval INT CHECK (recurrence_interval > 0 AND recurrence_interval <= 365),
  ADD COLUMN IF NOT EXISTS recurrence_unit TEXT CHECK (recurrence_unit IN ('day', 'week', 'month')),
  ADD COLUMN IF NOT EXISTS recurrence_day INT CHECK (recurrence_day >= 0 AND recurrence_day <= 6),
  ADD COLUMN IF NOT EXISTS recurrence_end DATE,
  ADD COLUMN IF NOT EXISTS recurrence_parent_id UUID REFERENCES tasks(id) ON DELETE SET NULL;

-- Both interval and unit must be set together, or both null
ALTER TABLE tasks ADD CONSTRAINT recurrence_valid
  CHECK ((recurrence_interval IS NULL) = (recurrence_unit IS NULL));

CREATE INDEX IF NOT EXISTS idx_tasks_recurrence_parent_id ON tasks (recurrence_parent_id);
