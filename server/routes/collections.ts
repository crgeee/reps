import { Hono } from 'hono';
import sql from '../db/client.js';
import {
  validateUuid,
  buildUpdates,
  collectionSchema,
  patchCollectionSchema,
  collectionStatusSchema,
  patchCollectionStatusSchema,
  collectionTopicSchema,
  patchCollectionTopicSchema,
  fromTemplateSchema,
} from '../validation.js';

type AppEnv = { Variables: { userId: string } };
const collections = new Hono<AppEnv>();

interface CollectionRow {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  sr_enabled: boolean;
  default_view: string | null;
  sort_order: number;
  created_at: string;
}

interface CollectionStatusRow {
  id: string;
  collection_id: string;
  name: string;
  color: string | null;
  sort_order: number;
}

function statusRowToStatus(row: CollectionStatusRow) {
  return {
    id: row.id,
    collectionId: row.collection_id,
    name: row.name,
    color: row.color,
    sortOrder: row.sort_order,
  };
}

interface CollectionTopicRow {
  id: string;
  collection_id: string;
  name: string;
  color: string | null;
  sort_order: number;
}

function topicRowToTopic(row: CollectionTopicRow) {
  return {
    id: row.id,
    collectionId: row.collection_id,
    name: row.name,
    color: row.color,
    sortOrder: row.sort_order,
  };
}

function rowToCollection(row: CollectionRow) {
  return {
    id: row.id,
    name: row.name,
    icon: row.icon,
    color: row.color,
    srEnabled: row.sr_enabled,
    defaultView: row.default_view ?? 'list',
    sortOrder: row.sort_order,
    createdAt: row.created_at,
  };
}

// GET /collections
collections.get('/', async (c) => {
  const userId = c.get('userId') as string;
  const userFilter = userId ? sql`WHERE user_id = ${userId}` : sql``;
  const rows = await sql<CollectionRow[]>`
    SELECT * FROM collections ${userFilter} ORDER BY sort_order ASC, created_at ASC
  `;
  const collectionIds = rows.map((r) => r.id);
  if (collectionIds.length === 0) return c.json([]);

  const [statusRows, topicRows] = await Promise.all([
    sql<CollectionStatusRow[]>`
      SELECT * FROM collection_statuses WHERE collection_id = ANY(${collectionIds}) ORDER BY sort_order ASC
    `,
    sql<CollectionTopicRow[]>`
      SELECT * FROM collection_topics WHERE collection_id = ANY(${collectionIds}) ORDER BY sort_order ASC
    `,
  ]);

  const statusesByCollection = new Map<string, ReturnType<typeof statusRowToStatus>[]>();
  for (const sr of statusRows) {
    const list = statusesByCollection.get(sr.collection_id) ?? [];
    list.push(statusRowToStatus(sr));
    statusesByCollection.set(sr.collection_id, list);
  }

  const topicsByCollection = new Map<string, ReturnType<typeof topicRowToTopic>[]>();
  for (const tr of topicRows) {
    const list = topicsByCollection.get(tr.collection_id) ?? [];
    list.push(topicRowToTopic(tr));
    topicsByCollection.set(tr.collection_id, list);
  }

  return c.json(
    rows.map((row) => ({
      ...rowToCollection(row),
      statuses: statusesByCollection.get(row.id) ?? [],
      topics: topicsByCollection.get(row.id) ?? [],
    })),
  );
});

// POST /collections
collections.post('/', async (c) => {
  const userId = c.get('userId') as string;
  const raw = await c.req.json();
  const parsed = collectionSchema.safeParse(raw);
  if (!parsed.success)
    return c.json({ error: 'Validation failed', details: parsed.error.issues }, 400);
  const body = parsed.data;

  const [row] = await sql<CollectionRow[]>`
    INSERT INTO collections (name, icon, color, sr_enabled, sort_order, user_id)
    VALUES (${body.name}, ${body.icon ?? null}, ${body.color ?? null}, ${body.srEnabled ?? true}, ${body.sortOrder ?? 0}, ${userId ?? null})
    RETURNING *
  `;
  return c.json({ ...rowToCollection(row), statuses: [], topics: [] }, 201);
});

// POST /collections/from-template
collections.post('/from-template', async (c) => {
  const userId = c.get('userId') as string;
  const raw = await c.req.json();
  const parsed = fromTemplateSchema.safeParse(raw);
  if (!parsed.success)
    return c.json({ error: 'Validation failed', details: parsed.error.issues }, 400);
  const body = parsed.data;

  // Load template (must be system or owned by user)
  const [template] = await sql<
    {
      id: string;
      name: string;
      icon: string | null;
      color: string | null;
      sr_enabled: boolean;
      default_view: string;
    }[]
  >`
    SELECT * FROM collection_templates WHERE id = ${body.templateId}
    AND (is_system = true OR user_id = ${userId})
  `;
  if (!template) return c.json({ error: 'Template not found' }, 404);

  const templateStatuses = await sql<{ name: string; color: string | null; sort_order: number }[]>`
    SELECT name, color, sort_order FROM template_statuses WHERE template_id = ${template.id} ORDER BY sort_order ASC
  `;
  const templateTasks = await sql<
    { title: string; description: string | null; status_name: string; topic: string }[]
  >`
    SELECT title, description, status_name, topic FROM template_tasks WHERE template_id = ${template.id} ORDER BY sort_order ASC
  `;
  const templateTopics = await sql<{ name: string; color: string | null; sort_order: number }[]>`
    SELECT name, color, sort_order FROM template_topics WHERE template_id = ${template.id} ORDER BY sort_order ASC
  `;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await sql.begin(async (tx: any) => {
    const collName = body.name ?? template.name;
    const collColor = body.color ?? template.color;
    const [col] = await tx<CollectionRow[]>`
      INSERT INTO collections (name, icon, color, sr_enabled, default_view, sort_order, user_id)
      VALUES (${collName}, ${template.icon}, ${collColor}, ${template.sr_enabled}, ${template.default_view}, 0, ${userId ?? null})
      RETURNING *
    `;

    const createdStatuses = [];
    for (const s of templateStatuses) {
      const [statusRow] = await tx<CollectionStatusRow[]>`
        INSERT INTO collection_statuses (collection_id, name, color, sort_order)
        VALUES (${col.id}, ${s.name}, ${s.color}, ${s.sort_order})
        RETURNING *
      `;
      createdStatuses.push(statusRowToStatus(statusRow));
    }

    const createdTopics = [];
    for (const t of templateTopics) {
      const [topicRow] = await tx<CollectionTopicRow[]>`
        INSERT INTO collection_topics (collection_id, name, color, sort_order)
        VALUES (${col.id}, ${t.name}, ${t.color}, ${t.sort_order})
        RETURNING *
      `;
      createdTopics.push(topicRowToTopic(topicRow));
    }

    const today = new Date().toISOString().split('T')[0];
    for (const t of templateTasks) {
      await tx`
        INSERT INTO tasks (id, topic, title, description, status, collection_id, next_review, created_at, user_id)
        VALUES (gen_random_uuid(), ${t.topic}, ${t.title}, ${t.description}, ${t.status_name}, ${col.id}, ${today}, ${today}, ${userId ?? null})
      `;
    }

    return { ...rowToCollection(col), statuses: createdStatuses, topics: createdTopics };
  });

  return c.json(result, 201);
});

// PATCH /collections/:id
collections.patch('/:id', async (c) => {
  const userId = c.get('userId') as string;
  const id = c.req.param('id');
  if (!validateUuid(id)) return c.json({ error: 'Invalid ID format' }, 400);
  const raw = await c.req.json();
  const parsed = patchCollectionSchema.safeParse(raw);
  if (!parsed.success)
    return c.json({ error: 'Validation failed', details: parsed.error.issues }, 400);
  const body = parsed.data;

  const updates = buildUpdates(body as Record<string, unknown>, {
    name: 'name',
    icon: 'icon',
    color: 'color',
    srEnabled: 'sr_enabled',
    defaultView: 'default_view',
    sortOrder: 'sort_order',
  });

  if (Object.keys(updates).length === 0) return c.json({ error: 'No valid fields' }, 400);

  const userWhere = userId ? sql`AND user_id = ${userId}` : sql``;
  const [row] = await sql<CollectionRow[]>`
    UPDATE collections SET ${sql(updates)} WHERE id = ${id} ${userWhere} RETURNING *
  `;
  if (!row) return c.json({ error: 'Collection not found' }, 404);
  return c.json(rowToCollection(row));
});

// DELETE /collections/:id
collections.delete('/:id', async (c) => {
  const userId = c.get('userId') as string;
  const id = c.req.param('id');
  if (!validateUuid(id)) return c.json({ error: 'Invalid ID format' }, 400);

  const userWhere = userId ? sql`AND user_id = ${userId}` : sql``;
  const [row] = await sql<
    CollectionRow[]
  >`DELETE FROM collections WHERE id = ${id} ${userWhere} RETURNING *`;
  if (!row) return c.json({ error: 'Collection not found' }, 404);

  return c.json({ deleted: true, id });
});

// Helper: verify collection ownership
async function verifyCollectionOwnership(collectionId: string, userId: string): Promise<boolean> {
  const [row] = await sql<{ id: string }[]>`
    SELECT id FROM collections WHERE id = ${collectionId} AND user_id = ${userId}
  `;
  return !!row;
}

// GET /collections/:id/statuses
collections.get('/:id/statuses', async (c) => {
  const userId = c.get('userId') as string;
  const id = c.req.param('id');
  if (!validateUuid(id)) return c.json({ error: 'Invalid ID format' }, 400);

  if (!(await verifyCollectionOwnership(id, userId)))
    return c.json({ error: 'Collection not found' }, 404);

  const rows = await sql<CollectionStatusRow[]>`
    SELECT * FROM collection_statuses WHERE collection_id = ${id} ORDER BY sort_order ASC
  `;
  return c.json(rows.map(statusRowToStatus));
});

// POST /collections/:id/statuses
collections.post('/:id/statuses', async (c) => {
  const userId = c.get('userId') as string;
  const id = c.req.param('id');
  if (!validateUuid(id)) return c.json({ error: 'Invalid ID format' }, 400);

  if (!(await verifyCollectionOwnership(id, userId)))
    return c.json({ error: 'Collection not found' }, 404);

  const raw = await c.req.json();
  const parsed = collectionStatusSchema.safeParse(raw);
  if (!parsed.success)
    return c.json({ error: 'Validation failed', details: parsed.error.issues }, 400);
  const body = parsed.data;

  try {
    const [row] = await sql<CollectionStatusRow[]>`
      INSERT INTO collection_statuses (collection_id, name, color, sort_order)
      VALUES (${id}, ${body.name}, ${body.color ?? null}, ${body.sortOrder ?? 0})
      RETURNING *
    `;
    return c.json(statusRowToStatus(row), 201);
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'code' in err && err.code === '23505') {
      return c.json({ error: `A status named "${body.name}" already exists` }, 409);
    }
    throw err;
  }
});

// PATCH /collections/:id/statuses/:sid
collections.patch('/:id/statuses/:sid', async (c) => {
  const userId = c.get('userId') as string;
  const id = c.req.param('id');
  const sid = c.req.param('sid');
  if (!validateUuid(id) || !validateUuid(sid)) return c.json({ error: 'Invalid ID format' }, 400);

  if (!(await verifyCollectionOwnership(id, userId)))
    return c.json({ error: 'Collection not found' }, 404);

  const raw = await c.req.json();
  const parsed = patchCollectionStatusSchema.safeParse(raw);
  if (!parsed.success)
    return c.json({ error: 'Validation failed', details: parsed.error.issues }, 400);
  const body = parsed.data;

  const updates = buildUpdates(body as Record<string, unknown>, {
    name: 'name',
    color: 'color',
    sortOrder: 'sort_order',
  });

  if (Object.keys(updates).length === 0) return c.json({ error: 'No valid fields' }, 400);

  const [row] = await sql<CollectionStatusRow[]>`
    UPDATE collection_statuses SET ${sql(updates)} WHERE id = ${sid} AND collection_id = ${id} RETURNING *
  `;
  if (!row) return c.json({ error: 'Status not found' }, 404);
  return c.json(statusRowToStatus(row));
});

// DELETE /collections/:id/statuses/:sid
collections.delete('/:id/statuses/:sid', async (c) => {
  const userId = c.get('userId') as string;
  const id = c.req.param('id');
  const sid = c.req.param('sid');
  if (!validateUuid(id) || !validateUuid(sid)) return c.json({ error: 'Invalid ID format' }, 400);

  if (!(await verifyCollectionOwnership(id, userId)))
    return c.json({ error: 'Collection not found' }, 404);

  const [status] = await sql<CollectionStatusRow[]>`
    SELECT * FROM collection_statuses WHERE id = ${sid} AND collection_id = ${id}
  `;
  if (!status) return c.json({ error: 'Status not found' }, 404);

  const [fallback] = await sql<CollectionStatusRow[]>`
    SELECT * FROM collection_statuses
    WHERE collection_id = ${id} AND id != ${sid}
    ORDER BY sort_order ASC
    LIMIT 1
  `;

  if (fallback) {
    await sql`
      UPDATE tasks SET status = ${fallback.name}
      WHERE collection_id = ${id} AND status = ${status.name}
    `;
  }

  await sql`DELETE FROM collection_statuses WHERE id = ${sid} AND collection_id = ${id}`;
  return c.json({ deleted: true, id: sid });
});

// POST /collections/:id/topics
collections.post('/:id/topics', async (c) => {
  const userId = c.get('userId') as string;
  const id = c.req.param('id');
  if (!validateUuid(id)) return c.json({ error: 'Invalid ID format' }, 400);

  if (!(await verifyCollectionOwnership(id, userId)))
    return c.json({ error: 'Collection not found' }, 404);

  const raw = await c.req.json();
  const parsed = collectionTopicSchema.safeParse(raw);
  if (!parsed.success)
    return c.json({ error: 'Validation failed', details: parsed.error.issues }, 400);
  const body = parsed.data;

  try {
    const [row] = await sql<CollectionTopicRow[]>`
      INSERT INTO collection_topics (collection_id, name, color, sort_order)
      VALUES (${id}, ${body.name}, ${body.color ?? null}, ${body.sortOrder ?? 0})
      RETURNING *
    `;
    return c.json(topicRowToTopic(row), 201);
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'code' in err && err.code === '23505') {
      return c.json({ error: `A topic named "${body.name}" already exists` }, 409);
    }
    throw err;
  }
});

// PATCH /collections/:id/topics/:tid
collections.patch('/:id/topics/:tid', async (c) => {
  const userId = c.get('userId') as string;
  const id = c.req.param('id');
  const tid = c.req.param('tid');
  if (!validateUuid(id) || !validateUuid(tid)) return c.json({ error: 'Invalid ID format' }, 400);

  if (!(await verifyCollectionOwnership(id, userId)))
    return c.json({ error: 'Collection not found' }, 404);

  const raw = await c.req.json();
  const parsed = patchCollectionTopicSchema.safeParse(raw);
  if (!parsed.success)
    return c.json({ error: 'Validation failed', details: parsed.error.issues }, 400);
  const body = parsed.data;

  const updates = buildUpdates(body as Record<string, unknown>, {
    name: 'name',
    color: 'color',
    sortOrder: 'sort_order',
  });

  if (Object.keys(updates).length === 0) return c.json({ error: 'No valid fields' }, 400);

  const [row] = await sql<CollectionTopicRow[]>`
    UPDATE collection_topics SET ${sql(updates)} WHERE id = ${tid} AND collection_id = ${id} RETURNING *
  `;
  if (!row) return c.json({ error: 'Topic not found' }, 404);
  return c.json(topicRowToTopic(row));
});

// DELETE /collections/:id/topics/:tid
collections.delete('/:id/topics/:tid', async (c) => {
  const userId = c.get('userId') as string;
  const id = c.req.param('id');
  const tid = c.req.param('tid');
  if (!validateUuid(id) || !validateUuid(tid)) return c.json({ error: 'Invalid ID format' }, 400);

  if (!(await verifyCollectionOwnership(id, userId)))
    return c.json({ error: 'Collection not found' }, 404);

  const [topic] = await sql<CollectionTopicRow[]>`
    SELECT * FROM collection_topics WHERE id = ${tid} AND collection_id = ${id}
  `;
  if (!topic) return c.json({ error: 'Topic not found' }, 404);

  const [fallback] = await sql<CollectionTopicRow[]>`
    SELECT * FROM collection_topics
    WHERE collection_id = ${id} AND id != ${tid}
    ORDER BY sort_order ASC
    LIMIT 1
  `;

  if (fallback) {
    await sql`
      UPDATE tasks SET topic = ${fallback.name}
      WHERE collection_id = ${id} AND topic = ${topic.name}
    `;
  } else {
    await sql`
      UPDATE tasks SET topic = NULL
      WHERE collection_id = ${id} AND topic = ${topic.name}
    `;
  }

  await sql`DELETE FROM collection_topics WHERE id = ${tid} AND collection_id = ${id}`;
  return c.json({ deleted: true, id: tid });
});

export default collections;
