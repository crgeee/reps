import { z } from "zod";

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function validateUuid(id: string): boolean {
  return UUID_RE.test(id);
}

export const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const topicEnum = z.enum(["coding", "system-design", "behavioral", "papers", "custom"]);
export const uuidStr = z.string().regex(UUID_RE);
export const statusEnum = z.enum(["todo", "in-progress", "review", "done"]);
