import { Hono } from 'hono';
import sql from '../db/client.js';
import {
  validateUuid,
  buildUpdates,
  collectionSchema,
  patchCollectionSchema,
  collectionStatusSchema,
  patchCollectionStatusSchema,
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
  const statusRows = await sql<CollectionStatusRow[]>`
    SELECT * FROM collection_statuses ORDER BY sort_order ASC
  `;
  const statusesByCollection = new Map<string, ReturnType<typeof statusRowToStatus>[]>();
  for (const sr of statusRows) {
    const list = statusesByCollection.get(sr.collection_id) ?? [];
    list.push(statusRowToStatus(sr));
    statusesByCollection.set(sr.collection_id, list);
  }
  return c.json(
    rows.map((row) => ({
      ...rowToCollection(row),
      statuses: statusesByCollection.get(row.id) ?? [],
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
  return c.json(rowToCollection(row), 201);
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
  const [template] = await sql<{
    id: string; name: string; icon: string | null; color: string | null;
    sr_enabled: boolean; default_view: string;
  }[]>`
    SELECT * FROM collection_templates WHERE id = ${body.templateId}
    AND (is_system = true OR user_id = ${userId})
  `;
  if (!template) return c.json({ error: 'Template not found' }, 404);

  const templateStatuses = await sql<{ name: string; color: string | null; sort_order: number }[]>`
    SELECT name, color, sort_order FROM template_statuses WHERE template_id = ${template.id} ORDER BY sort_order ASC
  `;
  const templateTasks = await sql<{ title: string; description: string | null; status_name: string; topic: string }[]>`
    SELECT title, description, status_name, topic FROM template_tasks WHERE template_id = ${template.id} ORDER BY sort_order ASC
  `;

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

    const today = new Date().toISOString().split('T')[0];
    for (const t of templateTasks) {
      await tx`
        INSERT INTO tasks (id, topic, title, description, status, collection_id, next_review, created_at, user_id)
        VALUES (gen_random_uuid(), ${t.topic}, ${t.title}, ${t.description}, ${t.status_name}, ${col.id}, ${today}, ${today}, ${userId ?? null})
      `;
    }

    return { ...rowToCollection(col), statuses: createdStatuses };
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

// GET /collections/:id/statuses
collections.get('/:id/statuses', async (c) => {
  const id = c.req.param('id');
  if (!validateUuid(id)) return c.json({ error: 'Invalid ID format' }, 400);

  const rows = await sql<CollectionStatusRow[]>`
    SELECT * FROM collection_statuses WHERE collection_id = ${id} ORDER BY sort_order ASC
  `;
  return c.json(rows.map(statusRowToStatus));
});

// POST /collections/:id/statuses
collections.post('/:id/statuses', async (c) => {
  const id = c.req.param('id');
  if (!validateUuid(id)) return c.json({ error: 'Invalid ID format' }, 400);

  const [collection] = await sql<CollectionRow[]>`SELECT id FROM collections WHERE id = ${id}`;
  if (!collection) return c.json({ error: 'Collection not found' }, 404);

  const raw = await c.req.json();
  const parsed = collectionStatusSchema.safeParse(raw);
  if (!parsed.success)
    return c.json({ error: 'Validation failed', details: parsed.error.issues }, 400);
  const body = parsed.data;

  const [row] = await sql<CollectionStatusRow[]>`
    INSERT INTO collection_statuses (collection_id, name, color, sort_order)
    VALUES (${id}, ${body.name}, ${body.color ?? null}, ${body.sortOrder ?? 0})
    RETURNING *
  `;
  return c.json(statusRowToStatus(row), 201);
});

// PATCH /collections/:id/statuses/:sid
collections.patch('/:id/statuses/:sid', async (c) => {
  const id = c.req.param('id');
  const sid = c.req.param('sid');
  if (!validateUuid(id) || !validateUuid(sid)) return c.json({ error: 'Invalid ID format' }, 400);

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
  const id = c.req.param('id');
  const sid = c.req.param('sid');
  if (!validateUuid(id) || !validateUuid(sid)) return c.json({ error: 'Invalid ID format' }, 400);

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

export default collections;
