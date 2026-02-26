-- Calendar subscription tokens for iCal feed access
CREATE TABLE IF NOT EXISTS calendar_tokens (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token      TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
