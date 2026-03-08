import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { z } from 'zod';

const zodUuid = z.string().uuid();

/**
 * Extracts UUIDs from INSERT/VALUES statements only (not WHERE clauses).
 * This validates data being written, not old references being cleaned up.
 */
function extractInsertUuids(sql: string): { uuid: string; line: number }[] {
  const results: { uuid: string; line: number }[] = [];
  const lines = sql.split('\n');
  let inInsert = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (/^\s*INSERT\s+INTO/i.test(line)) inInsert = true;
    if (inInsert && /;\s*$/.test(line)) inInsert = false;

    if (inInsert) {
      const uuidMatches = line.matchAll(
        /'([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})'/gi,
      );
      for (const match of uuidMatches) {
        results.push({ uuid: match[1]!, line: i + 1 });
      }
    }
  }

  return results;
}

describe('seed SQL UUID validation', () => {
  const dbDir = join(import.meta.dirname, '../../db');
  // Only validate seed/data files (016+), not schema migrations (001-015)
  // which may use UUIDs that don't pass through Zod validation
  const sqlFiles = readdirSync(dbDir)
    .filter((f) => f.endsWith('.sql'))
    .filter((f) => {
      const num = parseInt(f.split('-')[0] ?? '', 10);
      return num >= 16;
    });

  for (const file of sqlFiles) {
    it(`${file} — all INSERT UUIDs pass Zod validation`, () => {
      const content = readFileSync(join(dbDir, file), 'utf-8');
      const uuids = extractInsertUuids(content);

      for (const { uuid, line } of uuids) {
        const result = zodUuid.safeParse(uuid);
        expect(result.success, `Invalid UUID in ${file}:${line}: ${uuid}`).toBe(true);
      }
    });
  }
});
