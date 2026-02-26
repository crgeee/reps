import { Resend } from 'resend';
import sql from '../db/client.js';
import { generateToken, hashToken } from './crypto.js';
import { createSession } from './sessions.js';
import { findUserByEmail, createUser } from './users.js';

const MAGIC_LINK_EXPIRY_MINUTES = 15;

let resendClient: Resend | null = null;

function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null;
  if (!resendClient) resendClient = new Resend(process.env.RESEND_API_KEY);
  return resendClient;
}

export async function sendMagicLink(email: string): Promise<void> {
  const token = generateToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + MAGIC_LINK_EXPIRY_MINUTES * 60 * 1000);

  await sql`
    INSERT INTO magic_link_tokens (email, token_hash, expires_at)
    VALUES (${email.toLowerCase()}, ${tokenHash}, ${expiresAt.toISOString()})
  `;

  const appUrl = process.env.APP_URL ?? 'https://reps-prep.duckdns.org';
  const verifyUrl = `${appUrl}/auth/verify?token=${token}`;
  const fromAddress = process.env.RESEND_FROM ?? 'reps <noreply@reps-prep.duckdns.org>';

  const client = getResend();
  if (client) {
    try {
      await client.emails.send({
        from: fromAddress,
        to: email.toLowerCase(),
        subject: 'Sign in to reps',
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 500px; margin: 0 auto; background: #18181b; color: #e4e4e7; padding: 32px; border-radius: 12px;">
            <h1 style="font-size: 24px; font-weight: 700; margin: 0 0 16px; color: #f4f4f5;">reps</h1>
            <p style="margin: 0 0 24px; color: #a1a1aa;">Click the button below to sign in. This link expires in ${MAGIC_LINK_EXPIRY_MINUTES} minutes.</p>
            <a href="${verifyUrl}" style="display: inline-block; padding: 12px 24px; background: #f4f4f5; color: #18181b; font-weight: 600; border-radius: 8px; text-decoration: none;">Sign in to reps</a>
            <p style="color: #52525b; font-size: 12px; margin-top: 24px;">If you didn't request this, you can safely ignore this email.</p>
          </div>
        `,
      });
    } catch (err) {
      console.error('[magic-link] Failed to send email:', err);
    }
  } else {
    // Console fallback for development
    console.log(`[magic-link] Verify URL for ${email}: ${verifyUrl}`);
  }
}

export async function verifyMagicLink(
  token: string,
  userAgent?: string,
  ipAddress?: string,
): Promise<{ sessionToken: string; userId: string; isNewUser: boolean } | null> {
  const tokenHash = hashToken(token);

  // Atomic: mark as used only if currently unused and not expired
  const [row] = await sql<{ email: string }[]>`
    UPDATE magic_link_tokens
    SET used = true
    WHERE token_hash = ${tokenHash} AND used = false AND expires_at > now()
    RETURNING email
  `;

  if (!row) return null;

  const email = row.email;
  let isNewUser = false;

  // Find or create user
  let user = await findUserByEmail(email);
  if (!user) {
    user = await createUser(email);
    isNewUser = true;
  }

  // Mark email as verified (they just clicked a link sent to this email)
  if (!user.emailVerified) {
    await sql`UPDATE users SET email_verified = true, updated_at = now() WHERE id = ${user.id}`;
  }

  const { token: sessionToken } = await createSession(user.id, userAgent, ipAddress);

  return { sessionToken, userId: user.id, isNewUser };
}
