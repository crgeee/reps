-- Clean up old filename entries from before the rename.
-- The new filenames (001_schema.sql, 004b-multi-user-auth.sql) are already tracked
-- because the migrator ran them as "new" files on the first deploy after the rename.
DELETE FROM schema_migrations WHERE filename IN ('schema.sql', '004-multi-user-auth.sql');
