/**
 * Multi-user migration: creates default user and backfills user_id on all tables.
 *
 * Run after 004-multi-user-auth.sql migration:
 *   node --env-file=.env --import=tsx/esm server/db/migrate-users.ts
 */
import sql from './client.js';

async function migrateUsers(): Promise<void> {
  console.log('Starting multi-user data migration...');

  // 1. Determine default user email
  const email = process.env.DIGEST_EMAIL_TO ?? 'admin@reps-prep.duckdns.org';
  console.log(`  Default user email: ${email}`);

  // 2. Create default user (or find existing)
  let userId: string;
  const [existing] = await sql<{ id: string }[]>`SELECT id FROM users WHERE email = ${email}`;
  if (existing) {
    userId = existing.id;
    console.log(`  Found existing user: ${userId}`);
  } else {
    const [created] = await sql<{ id: string }[]>`
      INSERT INTO users (email, display_name, email_verified, is_admin)
      VALUES (${email}, 'Admin', true, true)
      RETURNING id
    `;
    userId = created.id;
    console.log(`  Created default user: ${userId}`);
  }

  // 3. Backfill user_id on all tables where NULL
  const tables = ['tasks', 'collections', 'tags', 'agent_logs', 'mock_sessions', 'review_events'];
  for (const table of tables) {
    const result = await sql.unsafe(`UPDATE ${table} SET user_id = $1 WHERE user_id IS NULL`, [
      userId,
    ]);
    console.log(`  ${table}: backfilled ${result.count} row(s)`);
  }

  // 4. Make user_id NOT NULL (except agent_logs which allows NULL)
  const notNullTables = ['tasks', 'collections', 'tags', 'mock_sessions', 'review_events'];
  for (const table of notNullTables) {
    try {
      await sql.unsafe(`ALTER TABLE ${table} ALTER COLUMN user_id SET NOT NULL`);
      console.log(`  ${table}: user_id set to NOT NULL`);
    } catch (err) {
      console.warn(
        `  ${table}: could not set NOT NULL (may already be set):`,
        (err as Error).message,
      );
    }
  }

  // 5. Add per-user unique constraints
  try {
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_tags_user_name ON tags(user_id, name)`;
    console.log('  Added UNIQUE(user_id, name) on tags');
  } catch (err) {
    console.warn('  Could not add tags unique index:', (err as Error).message);
  }

  console.log('\nMigration complete.');
  console.log(`\nDefault user ID (set as LEGACY_USER_ID in .env): ${userId}`);
  console.log(`\nAdd to your .env file:\n  LEGACY_USER_ID=${userId}`);

  await sql.end();
}

migrateUsers().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
