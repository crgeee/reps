import { z } from 'zod';

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function validateUuid(id: string): boolean {
  return UUID_RE.test(id);
}

export const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const topicEnum = z.string().min(1).max(100);
export const uuidStr = z.string().regex(UUID_RE);
export const statusEnum = z.string().min(1).max(100);
export const priorityEnum = z.enum(['none', 'low', 'medium', 'high']);

export const collectionSchema = z.object({
  name: z.string().min(1).max(200),
  icon: z.string().max(10).optional(),
  color: z
    .string()
    .regex(/^#[0-9a-f]{6}$/i)
    .optional(),
  srEnabled: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(1000).optional(),
});

export const patchCollectionSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  icon: z.string().max(10).nullable().optional(),
  color: z
    .string()
    .regex(/^#[0-9a-f]{6}$/i)
    .nullable()
    .optional(),
  srEnabled: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(1000).optional(),
});

export const tagSchema = z.object({
  name: z.string().min(1).max(100),
  color: z
    .string()
    .regex(/^#[0-9a-f]{6}$/i)
    .optional(),
});

export const patchTagSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  color: z
    .string()
    .regex(/^#[0-9a-f]{6}$/i)
    .nullable()
    .optional(),
});

export const collectionStatusSchema = z.object({
  name: z.string().min(1).max(100),
  color: z
    .string()
    .regex(/^#[0-9a-f]{6}$/i)
    .nullable()
    .optional(),
  sortOrder: z.number().int().min(0).max(1000).optional(),
});

export const patchCollectionStatusSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  color: z
    .string()
    .regex(/^#[0-9a-f]{6}$/i)
    .nullable()
    .optional(),
  sortOrder: z.number().int().min(0).max(1000).optional(),
});

export const collectionTopicSchema = z.object({
  name: z.string().min(1).max(100),
  color: z
    .string()
    .regex(/^#[0-9a-f]{6}$/i)
    .nullable()
    .optional(),
  sortOrder: z.number().int().min(0).max(1000).optional(),
});

export const patchCollectionTopicSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  color: z
    .string()
    .regex(/^#[0-9a-f]{6}$/i)
    .nullable()
    .optional(),
  sortOrder: z.number().int().min(0).max(1000).optional(),
});

export const difficultyEnum = z.enum(['easy', 'medium', 'hard']);

export const mockStartSchema = z.object({
  topic: topicEnum.optional(),
  difficulty: difficultyEnum.optional(),
  collectionId: uuidStr.optional(),
});

export const mockRespondSchema = z.object({
  sessionId: uuidStr,
  answer: z.string().min(1).max(10000),
});

export const templateStatusInput = z.object({
  name: z.string().min(1).max(100),
  color: z
    .string()
    .regex(/^#[0-9a-f]{6}$/i)
    .nullable()
    .optional(),
  sortOrder: z.number().int().min(0).max(1000).optional(),
});

export const templateTopicInput = z.object({
  name: z.string().min(1).max(100),
  color: z
    .string()
    .regex(/^#[0-9a-f]{6}$/i)
    .nullable()
    .optional(),
  sortOrder: z.number().int().min(0).max(1000).optional(),
});

export const templateTaskInput = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(2000).nullable().optional(),
  statusName: z.string().min(1).max(100),
  topic: topicEnum.optional(),
  sortOrder: z.number().int().min(0).max(1000).optional(),
});

export const templateSchema = z
  .object({
    name: z.string().min(1).max(200),
    description: z.string().max(500).nullable().optional(),
    icon: z.string().max(10).optional(),
    color: z
      .string()
      .regex(/^#[0-9a-f]{6}$/i)
      .optional(),
    srEnabled: z.boolean().optional(),
    defaultView: z.enum(['list', 'board']).optional(),
    statuses: z.array(templateStatusInput).min(1).max(20),
    tasks: z.array(templateTaskInput).max(10).optional(),
    topics: z.array(templateTopicInput).max(20).optional(),
  })
  .refine(
    (data) => {
      if (!data.tasks || data.tasks.length === 0) return true;
      const statusNames = new Set(data.statuses.map((s) => s.name));
      return data.tasks.every((t) => statusNames.has(t.statusName));
    },
    { message: 'Task statusName must reference a defined status name' },
  );

export const patchTemplateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(500).nullable().optional(),
  icon: z.string().max(10).nullable().optional(),
  color: z
    .string()
    .regex(/^#[0-9a-f]{6}$/i)
    .nullable()
    .optional(),
  srEnabled: z.boolean().optional(),
  defaultView: z.enum(['list', 'board']).optional(),
});

export const patchTemplateTaskSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(2000).nullable().optional(),
  statusName: z.string().min(1).max(100).optional(),
  topic: topicEnum.optional(),
  sortOrder: z.number().int().min(0).max(1000).optional(),
});

export const fromTemplateSchema = z.object({
  templateId: z.string().regex(UUID_RE),
  name: z.string().min(1).max(200).optional(),
  color: z
    .string()
    .regex(/^#[0-9a-f]{6}$/i)
    .optional(),
});

export function buildUpdates(
  body: Record<string, unknown>,
  fieldMap: Record<string, string>,
): Record<string, unknown> {
  const updates: Record<string, unknown> = {};
  for (const [camel, snake] of Object.entries(fieldMap)) {
    if (camel in body) {
      updates[snake] = body[camel];
    }
  }
  return updates;
}
