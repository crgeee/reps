import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import sql from '../db/client.js';

const KEY_PREFIX = 'reps_mcp_';
const BCRYPT_ROUNDS = 10;
const DEFAULT_TTL_DAYS = 90;

export interface McpKey {
  id: string;
  userId: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  lastUsedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

function rowToMcpKey(row: Record<string, unknown>): McpKey {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    name: row.name as string,
    keyPrefix: row.key_prefix as string,
    scopes: row.scopes as string[],
    lastUsedAt: row.last_used_at ? String(row.last_used_at) : null,
    expiresAt: row.expires_at ? String(row.expires_at) : null,
    revokedAt: row.revoked_at ? String(row.revoked_at) : null,
    createdAt: String(row.created_at),
  };
}

export async function createMcpKey(
  userId: string,
  name: string,
  scopes: string[] = ['read'],
  ttlDays: number = DEFAULT_TTL_DAYS,
): Promise<{ key: McpKey; rawKey: string }> {
  const rawToken = randomBytes(32).toString('hex');
  const rawKey = `${KEY_PREFIX}${rawToken}`;
  const keyPrefix = rawKey.slice(0, 16);
  const keyHash = await bcrypt.hash(rawKey, BCRYPT_ROUNDS);

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + ttlDays);

  const [row] = await sql`
    INSERT INTO mcp_keys (user_id, name, key_hash, key_prefix, scopes, expires_at)
    VALUES (${userId}, ${name}, ${keyHash}, ${keyPrefix}, ${scopes}, ${expiresAt.toISOString()})
    RETURNING id, user_id, name, key_prefix, scopes, last_used_at, expires_at, revoked_at, created_at
  `;

  return { key: rowToMcpKey(row), rawKey };
}

export async function listMcpKeys(userId: string): Promise<McpKey[]> {
  const rows = await sql`
    SELECT id, user_id, name, key_prefix, scopes, last_used_at, expires_at, revoked_at, created_at
    FROM mcp_keys
    WHERE user_id = ${userId}
    ORDER BY created_at DESC
  `;

  return rows.map(rowToMcpKey);
}

export async function revokeMcpKey(userId: string, keyId: string): Promise<McpKey | null> {
  const [row] = await sql`
    UPDATE mcp_keys
    SET revoked_at = now()
    WHERE id = ${keyId} AND user_id = ${userId} AND revoked_at IS NULL
    RETURNING id, user_id, name, key_prefix, scopes, last_used_at, expires_at, revoked_at, created_at
  `;

  return row ? rowToMcpKey(row) : null;
}

export async function validateMcpKey(
  rawKey: string,
): Promise<{ userId: string; keyId: string; scopes: string[] } | null> {
  if (!rawKey.startsWith(KEY_PREFIX)) {
    return null;
  }

  const keyPrefix = rawKey.slice(0, 16);

  const rows = await sql`
    SELECT id, user_id, key_hash, scopes
    FROM mcp_keys
    WHERE key_prefix = ${keyPrefix}
      AND revoked_at IS NULL
      AND (expires_at IS NULL OR expires_at > now())
  `;

  for (const row of rows) {
    const match = await bcrypt.compare(rawKey, row.key_hash as string);
    if (match) {
      // Update last_used_at fire-and-forget
      sql`UPDATE mcp_keys SET last_used_at = now() WHERE id = ${row.id}`.catch(() => {});

      return {
        userId: row.user_id as string,
        keyId: row.id as string,
        scopes: row.scopes as string[],
      };
    }
  }

  return null;
}
