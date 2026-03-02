-- Add user preference columns for date/time formatting and locale
ALTER TABLE users ADD COLUMN IF NOT EXISTS time_format TEXT DEFAULT '12h' CHECK (time_format IN ('12h', '24h'));
ALTER TABLE users ADD COLUMN IF NOT EXISTS date_format TEXT DEFAULT 'MM/DD/YYYY' CHECK (date_format IN ('MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD'));
ALTER TABLE users ADD COLUMN IF NOT EXISTS start_of_week INT DEFAULT 0 CHECK (start_of_week IN (0, 1));
ALTER TABLE users ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'en' CHECK (language IN ('en'));
