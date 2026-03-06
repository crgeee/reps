BEGIN;

-- Convert recurrence_day from single INT to INT[] for multi-day weekly recurrence
ALTER TABLE tasks
  ALTER COLUMN recurrence_day TYPE INT[]
  USING CASE WHEN recurrence_day IS NOT NULL THEN ARRAY[recurrence_day] ELSE NULL END;

-- Update check constraint: each element must be 0-6
ALTER TABLE tasks
  DROP CONSTRAINT IF EXISTS tasks_recurrence_day_check;

ALTER TABLE tasks
  ADD CONSTRAINT tasks_recurrence_day_check
  CHECK (recurrence_day IS NULL OR (
    array_length(recurrence_day, 1) > 0
    AND recurrence_day <@ ARRAY[0,1,2,3,4,5,6]
  ));

COMMIT;
