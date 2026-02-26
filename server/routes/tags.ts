import { Hono } from "hono";
import sql from "../db/client.js";
import { validateUuid, tagSchema, patchTagSchema } from "../validation.js";

const tags = new Hono();

interface TagRow {
  id: string;
  name: string;
  color: string | null;
}

function rowToTag(row: TagRow) {
  return { id: row.id, name: row.name, color: row.color };
}

// GET /tags
tags.get("/", async (c) => {
  const rows = await sql<TagRow[]>`SELECT * FROM tags ORDER BY name ASC`;
  return c.json(rows.map(rowToTag));
});

// POST /tags
tags.post("/", async (c) => {
  const raw = await c.req.json();
  const parsed = tagSchema.safeParse(raw);
  if (!parsed.success) return c.json({ error: "Validation failed", details: parsed.error.issues }, 400);

  const [row] = await sql<TagRow[]>`
    INSERT INTO tags (name, color) VALUES (${parsed.data.name}, ${parsed.data.color ?? null}) RETURNING *
  `;
  return c.json(rowToTag(row), 201);
});

// PATCH /tags/:id
tags.patch("/:id", async (c) => {
  const id = c.req.param("id");
  if (!validateUuid(id)) return c.json({ error: "Invalid ID format" }, 400);
  const raw = await c.req.json();
  const parsed = patchTagSchema.safeParse(raw);
  if (!parsed.success) return c.json({ error: "Validation failed", details: parsed.error.issues }, 400);

  const updates: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) updates.name = parsed.data.name;
  if (parsed.data.color !== undefined) updates.color = parsed.data.color;
  if (Object.keys(updates).length === 0) return c.json({ error: "No valid fields" }, 400);

  const [row] = await sql<TagRow[]>`UPDATE tags SET ${sql(updates)} WHERE id = ${id} RETURNING *`;
  if (!row) return c.json({ error: "Tag not found" }, 404);
  return c.json(rowToTag(row));
});

// DELETE /tags/:id
tags.delete("/:id", async (c) => {
  const id = c.req.param("id");
  if (!validateUuid(id)) return c.json({ error: "Invalid ID format" }, 400);
  const [row] = await sql<TagRow[]>`DELETE FROM tags WHERE id = ${id} RETURNING *`;
  if (!row) return c.json({ error: "Tag not found" }, 404);
  return c.json({ deleted: true, id });
});

export default tags;
