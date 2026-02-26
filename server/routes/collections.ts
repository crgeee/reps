import { Hono } from "hono";
import sql from "../db/client.js";
import { validateUuid, collectionSchema, patchCollectionSchema } from "../validation.js";

const collections = new Hono();

interface CollectionRow {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  sr_enabled: boolean;
  sort_order: number;
  created_at: string;
}

function rowToCollection(row: CollectionRow) {
  return {
    id: row.id,
    name: row.name,
    icon: row.icon,
    color: row.color,
    srEnabled: row.sr_enabled,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
  };
}

// GET /collections
collections.get("/", async (c) => {
  const rows = await sql<CollectionRow[]>`
    SELECT * FROM collections ORDER BY sort_order ASC, created_at ASC
  `;
  return c.json(rows.map(rowToCollection));
});

// POST /collections
collections.post("/", async (c) => {
  const raw = await c.req.json();
  const parsed = collectionSchema.safeParse(raw);
  if (!parsed.success) return c.json({ error: "Validation failed", details: parsed.error.issues }, 400);
  const body = parsed.data;

  const [row] = await sql<CollectionRow[]>`
    INSERT INTO collections (name, icon, color, sr_enabled, sort_order)
    VALUES (${body.name}, ${body.icon ?? null}, ${body.color ?? null}, ${body.srEnabled ?? true}, ${body.sortOrder ?? 0})
    RETURNING *
  `;
  return c.json(rowToCollection(row), 201);
});

// PATCH /collections/:id
collections.patch("/:id", async (c) => {
  const id = c.req.param("id");
  if (!validateUuid(id)) return c.json({ error: "Invalid ID format" }, 400);
  const raw = await c.req.json();
  const parsed = patchCollectionSchema.safeParse(raw);
  if (!parsed.success) return c.json({ error: "Validation failed", details: parsed.error.issues }, 400);
  const body = parsed.data;

  const fieldMap: Record<string, string> = {
    name: "name",
    icon: "icon",
    color: "color",
    srEnabled: "sr_enabled",
    sortOrder: "sort_order",
  };

  const updates: Record<string, unknown> = {};
  for (const [camel, snake] of Object.entries(fieldMap)) {
    if (camel in body) updates[snake] = (body as Record<string, unknown>)[camel];
  }

  if (Object.keys(updates).length === 0) return c.json({ error: "No valid fields" }, 400);

  const [row] = await sql<CollectionRow[]>`
    UPDATE collections SET ${sql(updates)} WHERE id = ${id} RETURNING *
  `;
  if (!row) return c.json({ error: "Collection not found" }, 404);
  return c.json(rowToCollection(row));
});

// DELETE /collections/:id
collections.delete("/:id", async (c) => {
  const id = c.req.param("id");
  if (!validateUuid(id)) return c.json({ error: "Invalid ID format" }, 400);

  const [row] = await sql<CollectionRow[]>`DELETE FROM collections WHERE id = ${id} RETURNING *`;
  if (!row) return c.json({ error: "Collection not found" }, 404);

  return c.json({ deleted: true, id });
});

export default collections;
