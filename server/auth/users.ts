import sql from "../db/client.js";

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
  dailyReviewGoal: number;
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
  daily_review_goal: number;
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
    dailyReviewGoal: row.daily_review_goal,
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
    dailyReviewGoal?: number;
  },
): Promise<User | null> {
  const fieldMap: Record<string, string> = {
    displayName: "display_name",
    timezone: "timezone",
    theme: "theme",
    notifyDaily: "notify_daily",
    notifyWeekly: "notify_weekly",
    dailyReviewGoal: "daily_review_goal",
  };

  const dbUpdates: Record<string, unknown> = {};
  for (const [camel, snake] of Object.entries(fieldMap)) {
    if (camel in updates) {
      dbUpdates[snake] = (updates as Record<string, unknown>)[camel];
    }
  }

  if (Object.keys(dbUpdates).length === 0) return getUserById(id);

  dbUpdates["updated_at"] = new Date().toISOString();

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
  updates: { isAdmin?: boolean; isBlocked?: boolean },
): Promise<User | null> {
  const fieldMap: Record<string, string> = {
    isAdmin: "is_admin",
    isBlocked: "is_blocked",
  };

  const dbUpdates: Record<string, unknown> = {};
  for (const [camel, snake] of Object.entries(fieldMap)) {
    if (camel in updates) {
      dbUpdates[snake] = (updates as Record<string, unknown>)[camel];
    }
  }

  if (Object.keys(dbUpdates).length === 0) return getUserById(id);

  dbUpdates["updated_at"] = new Date().toISOString();

  const [row] = await sql<UserRow[]>`
    UPDATE users SET ${sql(dbUpdates)} WHERE id = ${id} RETURNING *
  `;

  return row ? rowToUser(row) : null;
}
