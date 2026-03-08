import sql from '../db/client.js';

export interface User {
  id: string;
  email: string;
  displayName: string | null;
  emailVerified: boolean;
  isAdmin: boolean;
  isBlocked: boolean;
  timezone: string;
  theme: string;
  notifyDaily: boolean;
  notifyWeekly: boolean;
  notifyReviewDue: boolean;
  notifyStreak: boolean;
  notifyAiComplete: boolean;
  notifyTaskAlerts: boolean;
  dailyReviewGoal: number;
  timeFormat: string;
  dateFormat: string;
  startOfWeek: number;
  language: string;
  mcpEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

interface UserRow {
  id: string;
  email: string;
  display_name: string | null;
  email_verified: boolean;
  is_admin: boolean;
  is_blocked: boolean;
  timezone: string;
  theme: string;
  notify_daily: boolean;
  notify_weekly: boolean;
  notify_review_due: boolean;
  notify_streak: boolean;
  notify_ai_complete: boolean;
  notify_task_alerts: boolean;
  daily_review_goal: number;
  time_format: string;
  date_format: string;
  start_of_week: number;
  language: string;
  mcp_enabled: boolean;
  created_at: string;
  updated_at: string;
}

function rowToUser(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    emailVerified: row.email_verified,
    isAdmin: row.is_admin,
    isBlocked: row.is_blocked,
    timezone: row.timezone,
    theme: row.theme,
    notifyDaily: row.notify_daily,
    notifyWeekly: row.notify_weekly,
    notifyReviewDue: row.notify_review_due,
    notifyStreak: row.notify_streak,
    notifyAiComplete: row.notify_ai_complete,
    notifyTaskAlerts: row.notify_task_alerts,
    dailyReviewGoal: row.daily_review_goal,
    timeFormat: row.time_format,
    dateFormat: row.date_format,
    startOfWeek: row.start_of_week,
    language: row.language,
    mcpEnabled: row.mcp_enabled,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function findUserByEmail(email: string): Promise<User | null> {
  const [row] = await sql<UserRow[]>`
    SELECT * FROM users WHERE email = ${email.toLowerCase()}
  `;
  return row ? rowToUser(row) : null;
}

export async function createUser(email: string, displayName?: string): Promise<User> {
  const [row] = await sql<UserRow[]>`
    INSERT INTO users (email, display_name)
    VALUES (${email.toLowerCase()}, ${displayName ?? null})
    RETURNING *
  `;
  return rowToUser(row);
}

export async function getUserById(id: string): Promise<User | null> {
  const [row] = await sql<UserRow[]>`SELECT * FROM users WHERE id = ${id}`;
  return row ? rowToUser(row) : null;
}

export async function updateUserProfile(
  id: string,
  updates: {
    displayName?: string | null;
    timezone?: string;
    theme?: string;
    notifyDaily?: boolean;
    notifyWeekly?: boolean;
    notifyReviewDue?: boolean;
    notifyStreak?: boolean;
    notifyAiComplete?: boolean;
    notifyTaskAlerts?: boolean;
    dailyReviewGoal?: number;
    timeFormat?: string;
    dateFormat?: string;
    startOfWeek?: number;
    language?: string;
  },
): Promise<User | null> {
  const fieldMap: Record<string, string> = {
    displayName: 'display_name',
    timezone: 'timezone',
    theme: 'theme',
    notifyDaily: 'notify_daily',
    notifyWeekly: 'notify_weekly',
    notifyReviewDue: 'notify_review_due',
    notifyStreak: 'notify_streak',
    notifyAiComplete: 'notify_ai_complete',
    notifyTaskAlerts: 'notify_task_alerts',
    dailyReviewGoal: 'daily_review_goal',
    timeFormat: 'time_format',
    dateFormat: 'date_format',
    startOfWeek: 'start_of_week',
    language: 'language',
  };

  const dbUpdates: Record<string, unknown> = {};
  for (const [camel, snake] of Object.entries(fieldMap)) {
    if (camel in updates) {
      dbUpdates[snake] = (updates as Record<string, unknown>)[camel];
    }
  }

  if (Object.keys(dbUpdates).length === 0) return getUserById(id);

  dbUpdates['updated_at'] = new Date().toISOString();

  const [row] = await sql<UserRow[]>`
    UPDATE users SET ${sql(dbUpdates)} WHERE id = ${id} RETURNING *
  `;

  return row ? rowToUser(row) : null;
}

export async function listUsers(): Promise<User[]> {
  const rows = await sql<UserRow[]>`SELECT * FROM users ORDER BY created_at ASC`;
  return rows.map(rowToUser);
}

export async function adminUpdateUser(
  id: string,
  updates: { isAdmin?: boolean; isBlocked?: boolean; mcpEnabled?: boolean },
): Promise<User | null> {
  const fieldMap: Record<string, string> = {
    isAdmin: 'is_admin',
    isBlocked: 'is_blocked',
    mcpEnabled: 'mcp_enabled',
  };

  const dbUpdates: Record<string, unknown> = {};
  for (const [camel, snake] of Object.entries(fieldMap)) {
    if (camel in updates) {
      dbUpdates[snake] = (updates as Record<string, unknown>)[camel];
    }
  }

  if (Object.keys(dbUpdates).length === 0) return getUserById(id);

  dbUpdates['updated_at'] = new Date().toISOString();

  const [row] = await sql<UserRow[]>`
    UPDATE users SET ${sql(dbUpdates)} WHERE id = ${id} RETURNING *
  `;

  return row ? rowToUser(row) : null;
}
