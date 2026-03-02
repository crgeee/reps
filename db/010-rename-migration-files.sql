-- Track renamed migration files so they are not re-run on existing databases
UPDATE schema_migrations SET filename = '001_schema.sql' WHERE filename = 'schema.sql';
UPDATE schema_migrations SET filename = '004b-multi-user-auth.sql' WHERE filename = '004-multi-user-auth.sql';
