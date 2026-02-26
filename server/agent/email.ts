import { Resend } from 'resend';
import { getDailyBriefingData } from './shared.js';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

let resendClient: Resend | null = null;

function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null;
  if (!resendClient) resendClient = new Resend(process.env.RESEND_API_KEY);
  return resendClient;
}

export async function sendDailyDigest(userId?: string, userEmail?: string): Promise<void> {
  const client = getResend();
  const to = userEmail ?? process.env.DIGEST_EMAIL_TO;

  if (!client || !to) {
    console.log(
      '[email] Resend not configured (missing RESEND_API_KEY or email), skipping daily digest',
    );
    return;
  }

  let data;
  try {
    data = await getDailyBriefingData(undefined, userId);
  } catch (err) {
    console.error('[email] Failed to fetch briefing data:', err);
    return;
  }

  const dueList =
    data.dueToday.length > 0
      ? data.dueToday
          .map((t) => `<li><strong>[${escapeHtml(t.topic)}]</strong> ${escapeHtml(t.title)}</li>`)
          .join('')
      : '<li>No reviews due today!</li>';

  const streakText =
    data.streak.current > 0
      ? `You're on a ${data.streak.current}-day streak!`
      : 'Start a new streak today!';

  const weakestText = data.weakestTopic
    ? `Your weakest area is <strong>${escapeHtml(data.weakestTopic.topic)}</strong> (avg ease: ${data.weakestTopic.avgEase}).`
    : '';

  const dateStr = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  const reviewCount = data.dueToday.length;
  const subject = `reps: ${reviewCount} review${reviewCount === 1 ? '' : 's'} due today`;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; background: #18181b; color: #e4e4e7; padding: 32px; border-radius: 12px;">
      <h1 style="font-size: 24px; font-weight: 700; margin: 0 0 8px; color: #f4f4f5;">reps &mdash; daily digest</h1>
      <p style="color: #a1a1aa; margin: 0 0 24px; font-size: 14px;">${dateStr}</p>

      <div style="background: #27272a; padding: 16px; border-radius: 8px; margin-bottom: 16px; border-left: 3px solid #6366f1;">
        <p style="margin: 0; font-size: 18px; font-weight: 600;">${streakText}</p>
      </div>

      <h2 style="font-size: 14px; font-weight: 600; color: #a1a1aa; text-transform: uppercase; letter-spacing: 0.05em; margin: 0 0 8px;">Due for Review (${reviewCount})</h2>
      <ul style="padding-left: 20px; margin: 0 0 16px; color: #e4e4e7; line-height: 1.8;">
        ${dueList}
      </ul>

      ${
        weakestText
          ? `<div style="background: #27272a; padding: 12px 16px; border-radius: 8px; border-left: 3px solid #fbbf24; margin-top: 16px;">
          <p style="color: #fbbf24; margin: 0; font-size: 14px;">${weakestText}</p>
        </div>`
          : ''
      }

      <p style="color: #52525b; font-size: 12px; margin-top: 24px; padding-top: 16px; border-top: 1px solid #27272a;">
        Sent from reps &mdash; your interview prep tracker
      </p>
    </div>
  `;

  try {
    await client.emails.send({
      from: process.env.RESEND_FROM ?? 'reps <noreply@localhost>',
      to,
      subject,
      html,
    });
    console.log('[email] Daily digest sent to', to);
  } catch (err) {
    console.error('[email] Failed to send daily digest:', err);
  }
}
