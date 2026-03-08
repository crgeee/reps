import sql from '../db/client.js';
import { encrypt, decrypt } from './encryption.js';
import { logger } from '../logger.js';
import type { AiProvider } from '../agent/provider.js';

export interface SavedAiKeyInfo {
  provider: AiProvider;
  model: string | null;
  keyPrefix: string;
  expiresAt: string;
  createdAt: string;
}

export interface DecryptedAiKey {
  provider: AiProvider;
  apiKey: string;
  model: string | null;
}

interface AiKeyRow {
  id: string;
  user_id: string;
  provider: AiProvider;
  model: string | null;
  encrypted_key: string;
  key_prefix: string;
  key_version: number;
  expires_at: string;
  created_at: string;
}

async function getValidKeyRow(userId: string): Promise<AiKeyRow | null> {
  const [row] = await sql<AiKeyRow[]>`
    SELECT * FROM user_ai_keys
    WHERE user_id = ${userId} AND expires_at > now()
  `;
  return row ?? null;
}

function rowToKeyInfo(row: AiKeyRow): SavedAiKeyInfo {
  return {
    provider: row.provider,
    model: row.model,
    keyPrefix: row.key_prefix,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  };
}

export async function saveAiKey(
  userId: string,
  provider: AiProvider,
  apiKey: string,
  model: string | null,
  expiryDays: number,
): Promise<SavedAiKeyInfo> {
  const encryptedKey = encrypt(apiKey);
  const keyPrefix = apiKey.slice(0, 5) + '...';
  const expiresAt = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000);

  const [row] = await sql<AiKeyRow[]>`
    INSERT INTO user_ai_keys (user_id, provider, model, encrypted_key, key_prefix, expires_at)
    VALUES (${userId}, ${provider}, ${model}, ${encryptedKey}, ${keyPrefix}, ${expiresAt})
    ON CONFLICT (user_id) DO UPDATE SET
      provider = EXCLUDED.provider,
      model = EXCLUDED.model,
      encrypted_key = EXCLUDED.encrypted_key,
      key_prefix = EXCLUDED.key_prefix,
      key_version = user_ai_keys.key_version + 1,
      expires_at = EXCLUDED.expires_at,
      created_at = now()
    RETURNING *
  `;

  if (!row) {
    throw new Error(`Failed to save AI key for user ${userId}: upsert returned no rows`);
  }

  return rowToKeyInfo(row);
}

export async function getAiKeyInfo(userId: string): Promise<SavedAiKeyInfo | null> {
  const row = await getValidKeyRow(userId);
  return row ? rowToKeyInfo(row) : null;
}

export async function getDecryptedAiKey(userId: string): Promise<DecryptedAiKey | null> {
  const row = await getValidKeyRow(userId);
  if (!row) return null;

  try {
    const apiKey = decrypt(row.encrypted_key);
    return { provider: row.provider, apiKey, model: row.model };
  } catch (err) {
    logger.error(
      { err, userId, keyVersion: row.key_version, provider: row.provider },
      'Failed to decrypt stored AI key',
    );
    return null;
  }
}

export async function deleteAiKey(userId: string): Promise<boolean> {
  const result = await sql`
    DELETE FROM user_ai_keys WHERE user_id = ${userId}
  `;
  return result.count > 0;
}

export async function cleanExpiredAiKeys(): Promise<number> {
  const result = await sql`
    DELETE FROM user_ai_keys WHERE expires_at <= now()
  `;
  return result.count;
}
