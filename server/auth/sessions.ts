import sql from "../db/client.js";
import { generateToken, hashToken } from "./crypto.js";

const SESSION_DURATION_DAYS = 30;
const SLIDING_WINDOW_DAYS = 15;

interface SessionRow {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: string;
  created_at: string;
  last_used_at: string;
  user_agent: string | null;
  ip_address: string | null;
}

export interface SessionInfo {
  id: string;
  userId: string;
  expiresAt: string;
  createdAt: string;
  lastUsedAt: string;
  userAgent: string | null;
  ipAddress: string | null;
}

export async function createSession(
  userId: string,
  userAgent?: string,
  ipAddress?: string,
): Promise<{ token: string; session: SessionInfo }> {
  const token = generateToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000);

  const [row] = await sql<SessionRow[]>`
    INSERT INTO sessions (user_id, token_hash, expires_at, user_agent, ip_address)
    VALUES (${userId}, ${tokenHash}, ${expiresAt.toISOString()}, ${userAgent ?? null}, ${ipAddress ?? null})
    RETURNING *
  `;

  return {
    token,
    session: rowToSession(row),
  };
}

export async function validateSession(token: string): Promise<SessionInfo | null> {
  const tokenHash = hashToken(token);

  const [row] = await sql<SessionRow[]>`
    SELECT * FROM sessions WHERE token_hash = ${tokenHash} AND expires_at > now()
  `;

  if (!row) return null;

  const session = rowToSession(row);

  // Sliding window: extend if within 15 days of expiry
  const expiresAt = new Date(row.expires_at);
  const daysUntilExpiry = (expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24);

  if (daysUntilExpiry < SLIDING_WINDOW_DAYS) {
    const newExpiry = new Date(Date.now() + SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000);
    await sql`
      UPDATE sessions SET expires_at = ${newExpiry.toISOString()}, last_used_at = now()
      WHERE id = ${row.id}
    `;
  } else {
    await sql`UPDATE sessions SET last_used_at = now() WHERE id = ${row.id}`;
  }

  return session;
}

export async function deleteSession(sessionId: string): Promise<void> {
  await sql`DELETE FROM sessions WHERE id = ${sessionId}`;
}

export async function deleteSessionByToken(token: string): Promise<void> {
  const tokenHash = hashToken(token);
  await sql`DELETE FROM sessions WHERE token_hash = ${tokenHash}`;
}

export async function deleteAllUserSessions(userId: string): Promise<void> {
  await sql`DELETE FROM sessions WHERE user_id = ${userId}`;
}

export async function getUserSessions(userId: string): Promise<SessionInfo[]> {
  const rows = await sql<SessionRow[]>`
    SELECT * FROM sessions WHERE user_id = ${userId} AND expires_at > now()
    ORDER BY last_used_at DESC
  `;
  return rows.map(rowToSession);
}

export async function cleanExpiredSessions(): Promise<number> {
  const result = await sql`DELETE FROM sessions WHERE expires_at <= now()`;
  return result.count;
}

function rowToSession(row: SessionRow): SessionInfo {
  return {
    id: row.id,
    userId: row.user_id,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    lastUsedAt: row.last_used_at,
    userAgent: row.user_agent,
    ipAddress: row.ip_address,
  };
}
