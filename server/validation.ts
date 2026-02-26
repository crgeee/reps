import { z } from "zod";

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function validateUuid(id: string): boolean {
  return UUID_RE.test(id);
}

export const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const topicEnum = z.enum(["coding", "system-design", "behavioral", "papers", "custom"]);
export const uuidStr = z.string().regex(UUID_RE);
export const statusEnum = z.string().min(1).max(100);
export const priorityEnum = z.enum(["none", "low", "medium", "high"]);

export const collectionSchema = z.object({
  name: z.string().min(1).max(200),
  icon: z.string().max(10).optional(),
  color: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
  srEnabled: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(1000).optional(),
});

export const patchCollectionSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  icon: z.string().max(10).nullable().optional(),
  color: z.string().regex(/^#[0-9a-f]{6}$/i).nullable().optional(),
  srEnabled: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(1000).optional(),
});

export const tagSchema = z.object({
  name: z.string().min(1).max(100),
  color: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
});

export const patchTagSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  color: z.string().regex(/^#[0-9a-f]{6}$/i).nullable().optional(),
});

export const collectionStatusSchema = z.object({
  name: z.string().min(1).max(100),
  color: z.string().regex(/^#[0-9a-f]{6}$/i).nullable().optional(),
  sortOrder: z.number().int().min(0).max(1000).optional(),
});

export const patchCollectionStatusSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  color: z.string().regex(/^#[0-9a-f]{6}$/i).nullable().optional(),
  sortOrder: z.number().int().min(0).max(1000).optional(),
});

export const difficultyEnum = z.enum(["easy", "medium", "hard"]);

export const mockStartSchema = z.object({
  topic: topicEnum.optional(),
  difficulty: difficultyEnum.optional(),
  collectionId: uuidStr.optional(),
});

export const mockRespondSchema = z.object({
  sessionId: uuidStr,
  answer: z.string().min(1).max(10000),
});

export function buildUpdates(
  body: Record<string, unknown>,
  fieldMap: Record<string, string>
): Record<string, unknown> {
  const updates: Record<string, unknown> = {};
  for (const [camel, snake] of Object.entries(fieldMap)) {
    if (camel in body) {
      updates[snake] = body[camel];
    }
  }
  return updates;
}
