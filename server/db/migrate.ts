import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sql from './client.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbDir = resolve(__dirname, '../../db');

async function ensureTrackingTable(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename    TEXT PRIMARY KEY,
      applied_at  TIMESTAMPTZ DEFAULT now()
    )
  `;
}

async function getAppliedMigrations(): Promise<Set<string>> {
  const rows = await sql<{ filename: string }[]>`
    SELECT filename FROM schema_migrations
  `;
  return new Set(rows.map((r) => r.filename));
}

async function isExistingDatabase(): Promise<boolean> {
  const rows = await sql<{ exists: boolean }[]>`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'tasks'
    )
  `;
  return rows[0].exists;
}

async function seedExistingMigrations(files: string[]): Promise<void> {
  console.log('  Seeding schema_migrations with existing files...');
  for (const file of files) {
    await sql`
      INSERT INTO schema_migrations (filename)
      VALUES (${file})
      ON CONFLICT DO NOTHING
    `;
  }
  console.log(`  Seeded ${files.length} existing migration(s).`);
}

async function migrate(): Promise<void> {
  console.log('Running migrations...');

  try {
    await ensureTrackingTable();

    const files = readdirSync(dbDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    const applied = await getAppliedMigrations();

    // First run on existing database: seed all current files as already-applied
    if (applied.size === 0 && (await isExistingDatabase())) {
      await seedExistingMigrations(files);
      console.log('Migrations completed (seeded existing — no new migrations to run).');
      return;
    }

    const pending = files.filter((f) => !applied.has(f));

    if (pending.length === 0) {
      console.log('No new migrations to run.');
      return;
    }

    for (const file of pending) {
      console.log(`  Running ${file}...`);
      const content = readFileSync(resolve(dbDir, file), 'utf-8');

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await sql.begin(async (tx: any) => {
        await tx.unsafe(content);
        await tx`
          INSERT INTO schema_migrations (filename)
          VALUES (${file})
        `;
      });
    }

    console.log(`Migrations completed successfully (${pending.length} applied).`);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

migrate();
