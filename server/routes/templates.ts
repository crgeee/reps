import { Hono } from 'hono';
import sql from '../db/client.js';
import {
  validateUuid,
  buildUpdates,
  templateSchema,
  patchTemplateSchema,
  templateTaskInput,
  patchTemplateTaskSchema,
} from '../validation.js';
import { getUserById } from '../auth/users.js';

type AppEnv = { Variables: { userId: string } };
const templates = new Hono<AppEnv>();

interface TemplateRow {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  sr_enabled: boolean;
  default_view: string;
  is_system: boolean;
  user_id: string | null;
  created_at: string;
}

interface TemplateStatusRow {
  id: string;
  template_id: string;
  name: string;
  color: string | null;
  sort_order: number;
}

interface TemplateTaskRow {
  id: string;
  template_id: string;
  title: string;
  description: string | null;
  status_name: string;
  topic: string;
  sort_order: number;
}

interface TemplateTopicRow {
  id: string;
  template_id: string;
  name: string;
  color: string | null;
  sort_order: number;
}

function topicRowToTopic(row: TemplateTopicRow) {
  return {
    id: row.id,
    templateId: row.template_id,
    name: row.name,
    color: row.color,
    sortOrder: row.sort_order,
  };
}

function rowToTemplate(row: TemplateRow) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    icon: row.icon,
    color: row.color,
    srEnabled: row.sr_enabled,
    defaultView: row.default_view,
    isSystem: row.is_system,
    userId: row.user_id,
    createdAt: row.created_at,
  };
}

function statusRowToStatus(row: TemplateStatusRow) {
  return {
    id: row.id,
    templateId: row.template_id,
    name: row.name,
    color: row.color,
    sortOrder: row.sort_order,
  };
}

function taskRowToTask(row: TemplateTaskRow) {
  return {
    id: row.id,
    templateId: row.template_id,
    title: row.title,
    description: row.description,
    statusName: row.status_name,
    topic: row.topic,
    sortOrder: row.sort_order,
  };
}

// GET /templates — list system templates + user's own
templates.get('/', async (c) => {
  const userId = c.get('userId') as string;

  const rows = await sql<TemplateRow[]>`
    SELECT * FROM collection_templates
    WHERE is_system = true OR user_id = ${userId}
    ORDER BY is_system DESC, created_at ASC
  `;

  if (rows.length === 0) {
    c.header('Cache-Control', 'private, max-age=300');
    return c.json([]);
  }

  const templateIds = rows.map((r) => r.id);

  const [statusRows, taskRows, topicRows] = await Promise.all([
    sql<TemplateStatusRow[]>`
      SELECT * FROM template_statuses
      WHERE template_id = ANY(${templateIds})
      ORDER BY sort_order ASC
    `,
    sql<TemplateTaskRow[]>`
      SELECT * FROM template_tasks
      WHERE template_id = ANY(${templateIds})
      ORDER BY sort_order ASC
    `,
    sql<TemplateTopicRow[]>`
      SELECT * FROM template_topics
      WHERE template_id = ANY(${templateIds})
      ORDER BY sort_order ASC
    `,
  ]);

  const statusesByTemplate = new Map<string, ReturnType<typeof statusRowToStatus>[]>();
  for (const sr of statusRows) {
    const list = statusesByTemplate.get(sr.template_id) ?? [];
    list.push(statusRowToStatus(sr));
    statusesByTemplate.set(sr.template_id, list);
  }

  const tasksByTemplate = new Map<string, ReturnType<typeof taskRowToTask>[]>();
  for (const tr of taskRows) {
    const list = tasksByTemplate.get(tr.template_id) ?? [];
    list.push(taskRowToTask(tr));
    tasksByTemplate.set(tr.template_id, list);
  }

  const topicsByTemplate = new Map<string, ReturnType<typeof topicRowToTopic>[]>();
  for (const tr of topicRows) {
    const list = topicsByTemplate.get(tr.template_id) ?? [];
    list.push(topicRowToTopic(tr));
    topicsByTemplate.set(tr.template_id, list);
  }

  c.header('Cache-Control', 'private, max-age=300');
  return c.json(
    rows.map((row) => ({
      ...rowToTemplate(row),
      statuses: statusesByTemplate.get(row.id) ?? [],
      tasks: tasksByTemplate.get(row.id) ?? [],
      topics: topicsByTemplate.get(row.id) ?? [],
    })),
  );
});

// GET /templates/admin/all — admin only: list ALL templates
templates.get('/admin/all', async (c) => {
  const userId = c.get('userId') as string;
  const user = await getUserById(userId);
  if (!user?.isAdmin) return c.json({ error: 'Forbidden' }, 403);

  const rows = await sql<TemplateRow[]>`
    SELECT * FROM collection_templates ORDER BY is_system DESC, created_at ASC
  `;

  if (rows.length === 0) return c.json([]);

  const templateIds = rows.map((r) => r.id);

  const [statusRows, taskRows, topicRows] = await Promise.all([
    sql<TemplateStatusRow[]>`
      SELECT * FROM template_statuses
      WHERE template_id = ANY(${templateIds})
      ORDER BY sort_order ASC
    `,
    sql<TemplateTaskRow[]>`
      SELECT * FROM template_tasks
      WHERE template_id = ANY(${templateIds})
      ORDER BY sort_order ASC
    `,
    sql<TemplateTopicRow[]>`
      SELECT * FROM template_topics
      WHERE template_id = ANY(${templateIds})
      ORDER BY sort_order ASC
    `,
  ]);

  const statusesByTemplate = new Map<string, ReturnType<typeof statusRowToStatus>[]>();
  for (const sr of statusRows) {
    const list = statusesByTemplate.get(sr.template_id) ?? [];
    list.push(statusRowToStatus(sr));
    statusesByTemplate.set(sr.template_id, list);
  }

  const tasksByTemplate = new Map<string, ReturnType<typeof taskRowToTask>[]>();
  for (const tr of taskRows) {
    const list = tasksByTemplate.get(tr.template_id) ?? [];
    list.push(taskRowToTask(tr));
    tasksByTemplate.set(tr.template_id, list);
  }

  const topicsByTemplate = new Map<string, ReturnType<typeof topicRowToTopic>[]>();
  for (const tr of topicRows) {
    const list = topicsByTemplate.get(tr.template_id) ?? [];
    list.push(topicRowToTopic(tr));
    topicsByTemplate.set(tr.template_id, list);
  }

  return c.json(
    rows.map((row) => ({
      ...rowToTemplate(row),
      statuses: statusesByTemplate.get(row.id) ?? [],
      tasks: tasksByTemplate.get(row.id) ?? [],
      topics: topicsByTemplate.get(row.id) ?? [],
    })),
  );
});

// POST /templates — create custom template
templates.post('/', async (c) => {
  const userId = c.get('userId') as string;
  const raw = await c.req.json();
  const parsed = templateSchema.safeParse(raw);
  if (!parsed.success)
    return c.json({ error: 'Validation failed', details: parsed.error.issues }, 400);
  const body = parsed.data;

  // Non-admin users limited to 1 custom template
  const user = await getUserById(userId);
  if (!user?.isAdmin) {
    const [{ count }] = await sql<[{ count: string }]>`
      SELECT COUNT(*)::text as count FROM collection_templates
      WHERE user_id = ${userId} AND is_system = false
    `;
    if (parseInt(count, 10) >= 1) {
      return c.json({ error: 'Non-admin users can create at most 1 custom template' }, 403);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await sql.begin(async (tx: any) => {
    const [row] = await tx<TemplateRow[]>`
      INSERT INTO collection_templates (name, description, icon, color, sr_enabled, default_view, is_system, user_id)
      VALUES (
        ${body.name},
        ${body.description ?? null},
        ${body.icon ?? null},
        ${body.color ?? null},
        ${body.srEnabled ?? true},
        ${body.defaultView ?? 'list'},
        false,
        ${userId}
      )
      RETURNING *
    `;

    const statuses: ReturnType<typeof statusRowToStatus>[] = [];
    if (body.statuses && body.statuses.length > 0) {
      for (let i = 0; i < body.statuses.length; i++) {
        const s = body.statuses[i];
        const [sr] = await tx<TemplateStatusRow[]>`
          INSERT INTO template_statuses (template_id, name, color, sort_order)
          VALUES (${row.id}, ${s.name}, ${s.color ?? null}, ${s.sortOrder ?? i})
          RETURNING *
        `;
        statuses.push(statusRowToStatus(sr));
      }
    }

    const tasks: ReturnType<typeof taskRowToTask>[] = [];
    if (body.tasks && body.tasks.length > 0) {
      for (let i = 0; i < body.tasks.length; i++) {
        const t = body.tasks[i];
        const [tr] = await tx<TemplateTaskRow[]>`
          INSERT INTO template_tasks (template_id, title, description, status_name, topic, sort_order)
          VALUES (${row.id}, ${t.title}, ${t.description ?? null}, ${t.statusName}, ${t.topic}, ${t.sortOrder ?? i})
          RETURNING *
        `;
        tasks.push(taskRowToTask(tr));
      }
    }

    const topics: ReturnType<typeof topicRowToTopic>[] = [];
    if (body.topics && body.topics.length > 0) {
      for (let i = 0; i < body.topics.length; i++) {
        const t = body.topics[i];
        const [tr] = await tx<TemplateTopicRow[]>`
          INSERT INTO template_topics (template_id, name, color, sort_order)
          VALUES (${row.id}, ${t.name}, ${t.color ?? null}, ${t.sortOrder ?? i})
          RETURNING *
        `;
        topics.push(topicRowToTopic(tr));
      }
    }

    return { ...rowToTemplate(row), statuses, tasks, topics };
  });

  return c.json(result, 201);
});

// PATCH /templates/:id — update template
templates.patch('/:id', async (c) => {
  const userId = c.get('userId') as string;
  const id = c.req.param('id');
  if (!validateUuid(id)) return c.json({ error: 'Invalid ID format' }, 400);

  const raw = await c.req.json();
  const parsed = patchTemplateSchema.safeParse(raw);
  if (!parsed.success)
    return c.json({ error: 'Validation failed', details: parsed.error.issues }, 400);
  const body = parsed.data;

  const updates = buildUpdates(body as Record<string, unknown>, {
    name: 'name',
    description: 'description',
    icon: 'icon',
    color: 'color',
    srEnabled: 'sr_enabled',
    defaultView: 'default_view',
  });

  if (Object.keys(updates).length === 0) return c.json({ error: 'No valid fields' }, 400);

  const user = await getUserById(userId);
  const userWhere = user?.isAdmin ? sql`` : sql`AND user_id = ${userId}`;

  const [row] = await sql<TemplateRow[]>`
    UPDATE collection_templates SET ${sql(updates)} WHERE id = ${id} ${userWhere} RETURNING *
  `;
  if (!row) return c.json({ error: 'Template not found' }, 404);
  return c.json(rowToTemplate(row));
});

// DELETE /templates/:id — delete template
templates.delete('/:id', async (c) => {
  const userId = c.get('userId') as string;
  const id = c.req.param('id');
  if (!validateUuid(id)) return c.json({ error: 'Invalid ID format' }, 400);

  const user = await getUserById(userId);
  const userWhere = user?.isAdmin ? sql`` : sql`AND user_id = ${userId} AND is_system = false`;

  const [row] = await sql<TemplateRow[]>`
    DELETE FROM collection_templates WHERE id = ${id} ${userWhere} RETURNING *
  `;
  if (!row) return c.json({ error: 'Template not found' }, 404);
  return c.json({ deleted: true, id });
});

// Helper: verify template write access (non-admins can only modify their own templates)
async function verifyTemplateWriteAccess(
  templateId: string,
  userId: string,
): Promise<TemplateRow | null> {
  const user = await getUserById(userId);
  const userWhere = user?.isAdmin ? sql`` : sql`AND user_id = ${userId} AND is_system = false`;
  const [row] = await sql<TemplateRow[]>`
    SELECT * FROM collection_templates WHERE id = ${templateId} ${userWhere}
  `;
  return row ?? null;
}

// POST /templates/:id/tasks — add task to template
templates.post('/:id/tasks', async (c) => {
  const userId = c.get('userId') as string;
  const id = c.req.param('id');
  if (!validateUuid(id)) return c.json({ error: 'Invalid ID format' }, 400);

  const template = await verifyTemplateWriteAccess(id, userId);
  if (!template) return c.json({ error: 'Template not found' }, 404);

  const raw = await c.req.json();
  const parsed = templateTaskInput.safeParse(raw);
  if (!parsed.success)
    return c.json({ error: 'Validation failed', details: parsed.error.issues }, 400);
  const body = parsed.data;

  // Validate statusName references a defined template status
  const statusRows = await sql<TemplateStatusRow[]>`
    SELECT * FROM template_statuses WHERE template_id = ${id}
  `;
  const validNames = new Set(statusRows.map((s) => s.name));
  if (!validNames.has(body.statusName)) {
    return c.json(
      { error: `statusName "${body.statusName}" does not match any template status` },
      400,
    );
  }

  const [row] = await sql<TemplateTaskRow[]>`
    INSERT INTO template_tasks (template_id, title, description, status_name, topic, sort_order)
    VALUES (${id}, ${body.title}, ${body.description ?? null}, ${body.statusName}, ${body.topic ?? 'custom'}, ${body.sortOrder ?? 0})
    RETURNING *
  `;
  return c.json(taskRowToTask(row), 201);
});

// PATCH /templates/:id/tasks/:taskId — update template task
templates.patch('/:id/tasks/:taskId', async (c) => {
  const userId = c.get('userId') as string;
  const id = c.req.param('id');
  const taskId = c.req.param('taskId');
  if (!validateUuid(id) || !validateUuid(taskId))
    return c.json({ error: 'Invalid ID format' }, 400);

  const template = await verifyTemplateWriteAccess(id, userId);
  if (!template) return c.json({ error: 'Template not found' }, 404);

  const raw = await c.req.json();
  const parsed = patchTemplateTaskSchema.safeParse(raw);
  if (!parsed.success)
    return c.json({ error: 'Validation failed', details: parsed.error.issues }, 400);
  const body = parsed.data;

  const updates = buildUpdates(body as Record<string, unknown>, {
    title: 'title',
    description: 'description',
    statusName: 'status_name',
    topic: 'topic',
    sortOrder: 'sort_order',
  });

  if (Object.keys(updates).length === 0) return c.json({ error: 'No valid fields' }, 400);

  const [row] = await sql<TemplateTaskRow[]>`
    UPDATE template_tasks SET ${sql(updates)}
    WHERE id = ${taskId} AND template_id = ${id}
    RETURNING *
  `;
  if (!row) return c.json({ error: 'Template task not found' }, 404);
  return c.json(taskRowToTask(row));
});

// DELETE /templates/:id/tasks/:taskId — delete template task
templates.delete('/:id/tasks/:taskId', async (c) => {
  const userId = c.get('userId') as string;
  const id = c.req.param('id');
  const taskId = c.req.param('taskId');
  if (!validateUuid(id) || !validateUuid(taskId))
    return c.json({ error: 'Invalid ID format' }, 400);

  const template = await verifyTemplateWriteAccess(id, userId);
  if (!template) return c.json({ error: 'Template not found' }, 404);

  const [row] = await sql<TemplateTaskRow[]>`
    DELETE FROM template_tasks
    WHERE id = ${taskId} AND template_id = ${id}
    RETURNING *
  `;
  if (!row) return c.json({ error: 'Template task not found' }, 404);
  return c.json({ deleted: true, id: taskId });
});

export default templates;
