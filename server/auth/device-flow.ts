import sql from '../db/client.js';
import { hashToken, generateUserCode, generateDeviceCode } from './crypto.js';
import { createSession } from './sessions.js';

const DEVICE_CODE_EXPIRY_MINUTES = 10;

export interface DeviceAuthInitiation {
  userCode: string;
  deviceCode: string;
  verificationUri: string;
  expiresIn: number;
}

export async function initiateDeviceAuth(): Promise<DeviceAuthInitiation> {
  const userCode = generateUserCode();
  const deviceCode = generateDeviceCode();
  const deviceCodeHash = hashToken(deviceCode);
  const expiresAt = new Date(Date.now() + DEVICE_CODE_EXPIRY_MINUTES * 60 * 1000);
  const appUrl = process.env.APP_URL ?? 'https://reps-prep.duckdns.org';

  await sql`
    INSERT INTO device_auth_codes (user_code, device_code_hash, expires_at)
    VALUES (${userCode}, ${deviceCodeHash}, ${expiresAt.toISOString()})
  `;

  return {
    userCode,
    deviceCode,
    verificationUri: `${appUrl}/#device-approve`,
    expiresIn: DEVICE_CODE_EXPIRY_MINUTES * 60,
  };
}

export type PollResult =
  | { status: 'pending' }
  | { status: 'approved'; sessionToken: string }
  | { status: 'denied' }
  | { status: 'expired' };

export async function pollDeviceAuth(deviceCode: string): Promise<PollResult> {
  const deviceCodeHash = hashToken(deviceCode);

  const [row] = await sql<
    {
      id: string;
      approved: boolean;
      denied: boolean;
      expires_at: string;
      session_token_hash: string | null;
    }[]
  >`
    SELECT id, approved, denied, expires_at, session_token_hash
    FROM device_auth_codes
    WHERE device_code_hash = ${deviceCodeHash}
  `;

  if (!row) return { status: 'expired' };

  if (new Date(row.expires_at) <= new Date()) return { status: 'expired' };
  if (row.denied) return { status: 'denied' };

  if (row.approved && row.session_token_hash) {
    // Retrieve the raw session token that was stored alongside the hash
    // We need to return it — but we only store hashes. So during approve, we store
    // the raw token in a separate column temporarily.
    // Actually, let's reconsider: we store the session token hash. The CLI needs the raw token.
    // Solution: during approve, create session, store raw token encrypted...
    // Simpler: store the raw session token in the row (it's a one-time read, deleted after)
    const [tokenRow] = await sql<{ session_token_hash: string }[]>`
      SELECT session_token_hash FROM device_auth_codes WHERE id = ${row.id}
    `;

    // Delete the device code after successful retrieval
    await sql`DELETE FROM device_auth_codes WHERE id = ${row.id}`;

    return { status: 'approved', sessionToken: tokenRow.session_token_hash! };
  }

  return { status: 'pending' };
}

export async function approveDeviceAuth(
  userCode: string,
  userId: string,
  userAgent?: string,
  ipAddress?: string,
): Promise<boolean> {
  // Find the pending device code
  const [row] = await sql<{ id: string; expires_at: string }[]>`
    SELECT id, expires_at FROM device_auth_codes
    WHERE user_code = ${userCode.toUpperCase()} AND approved = false AND denied = false
  `;

  if (!row) return false;
  if (new Date(row.expires_at) <= new Date()) return false;

  // Create a session for the CLI
  const { token } = await createSession(userId, userAgent ?? 'CLI', ipAddress);

  // Store the raw token so the CLI can retrieve it via polling
  // This is intentionally the raw token (not hashed) — it's deleted after one poll
  await sql`
    UPDATE device_auth_codes
    SET approved = true, user_id = ${userId}, session_token_hash = ${token}
    WHERE id = ${row.id}
  `;

  return true;
}

export async function denyDeviceAuth(userCode: string): Promise<boolean> {
  const result = await sql`
    UPDATE device_auth_codes
    SET denied = true
    WHERE user_code = ${userCode.toUpperCase()} AND approved = false AND denied = false AND expires_at > now()
  `;
  return result.count > 0;
}

export async function cleanExpiredDeviceCodes(): Promise<number> {
  const result = await sql`DELETE FROM device_auth_codes WHERE expires_at <= now()`;
  return result.count;
}
