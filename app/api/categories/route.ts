import { randomUUID } from "node:crypto";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { cleanText } from "@/lib/validation";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function familyUser() {
  const user = await getSessionUser();
  if (!user) return { error: Response.json({ error: "Faça login novamente." }, { status: 401 }) };
  if (!user.familyId) return { error: Response.json({ error: "Entre em uma família primeiro." }, { status: 403 }) };
  return { user };
}

export async function GET() {
  try {
    const auth = await familyUser();
    if ("error" in auth) return auth.error;
    const sql = db();
    const rows = await sql`
      SELECT id, name, sort_order, updated_at
      FROM shopping_categories
      WHERE family_id = ${auth.user.familyId}
        AND active = TRUE
      ORDER BY sort_order ASC, name ASC
    `;

    return Response.json({
      categories: rows.map((row) => ({
        id: String(row.id),
        name: String(row.name),
        sortOrder: Number(row.sort_order),
        updatedAt: String(row.updated_at),
      })),
    });
  } catch {
    return Response.json({ error: "Não foi possível carregar as categorias." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await familyUser();
    if ("error" in auth) return auth.error;
    const body = (await request.json()) as { id?: string; name?: string };
    const id = typeof body.id === "string" && UUID_PATTERN.test(body.id) ? body.id : randomUUID();
    const name = cleanText(body.name, 60);
    if (name.length < 2) return Response.json({ error: "Informe o nome da categoria." }, { status: 400 });

    const sql = db();
    const rows = await sql`
      INSERT INTO shopping_categories (id, family_id, name, sort_order, created_by)
      VALUES (
        ${id},
        ${auth.user.familyId},
        ${name},
        COALESCE((SELECT MAX(sort_order) + 10 FROM shopping_categories WHERE family_id = ${auth.user.familyId}), 10),
        ${auth.user.id}
      )
      ON CONFLICT (id) DO NOTHING
      RETURNING id, name, sort_order, updated_at
    `;

    if (rows.length === 0) return Response.json({ ok: true, id });
    return Response.json({
      ok: true,
      category: {
        id: String(rows[0].id),
        name: String(rows[0].name),
        sortOrder: Number(rows[0].sort_order),
        updatedAt: String(rows[0].updated_at),
      },
    }, { status: 201 });
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
    if (code === "23505") return Response.json({ error: "Essa categoria já existe." }, { status: 409 });
    return Response.json({ error: "Não foi possível criar a categoria." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await familyUser();
    if ("error" in auth) return auth.error;
    const body = (await request.json()) as { id?: string; name?: string };
    const name = cleanText(body.name, 60);
    if (typeof body.id !== "string" || !UUID_PATTERN.test(body.id) || name.length < 2) {
      return Response.json({ error: "Categoria inválida." }, { status: 400 });
    }

    const sql = db();
    const rows = await sql`
      UPDATE shopping_categories
      SET name = ${name}, updated_at = NOW()
      WHERE id = ${body.id}
        AND family_id = ${auth.user.familyId}
        AND active = TRUE
      RETURNING id
    `;
    if (rows.length === 0) return Response.json({ error: "Categoria não encontrada." }, { status: 404 });
    return Response.json({ ok: true });
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
    if (code === "23505") return Response.json({ error: "Essa categoria já existe." }, { status: 409 });
    return Response.json({ error: "Não foi possível editar a categoria." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await familyUser();
    if ("error" in auth) return auth.error;
    const body = (await request.json()) as { id?: string };
    if (typeof body.id !== "string" || !UUID_PATTERN.test(body.id)) {
      return Response.json({ error: "Categoria inválida." }, { status: 400 });
    }

    const sql = db();
    await sql`
      UPDATE shopping_items
      SET category_id = NULL, updated_at = NOW()
      WHERE family_id = ${auth.user.familyId}
        AND category_id = ${body.id}
    `;
    await sql`
      UPDATE shopping_categories
      SET active = FALSE, updated_at = NOW()
      WHERE id = ${body.id}
        AND family_id = ${auth.user.familyId}
    `;
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Não foi possível remover a categoria." }, { status: 500 });
  }
}
