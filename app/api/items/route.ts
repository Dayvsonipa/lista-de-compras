import { randomUUID } from "node:crypto";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { cleanText } from "@/lib/validation";

function parsePrice(value: unknown) {
  if (value === null || value === undefined) return null;

  const raw = String(value).trim().replace(/^R\$\s*/i, "").replace(/\s/g, "");
  if (!raw) return null;

  const normalized = raw.includes(",")
    ? raw.replace(/\./g, "").replace(",", ".")
    : raw;

  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return Number.NaN;

  const price = Number(normalized);
  if (!Number.isFinite(price) || price < 0 || price > 9_999_999_999.99) return Number.NaN;
  return price.toFixed(2);
}

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
      SELECT
        si.id,
        si.name,
        si.quantity,
        si.price,
        si.completed,
        si.created_at,
        si.completed_at,
        added.name AS added_by_name,
        completed.name AS completed_by_name
      FROM shopping_items si
      JOIN users added ON added.id = si.added_by
      LEFT JOIN users completed ON completed.id = si.completed_by
      WHERE si.family_id = ${auth.user.familyId}
      ORDER BY si.completed ASC, si.created_at DESC
      LIMIT 300
    `;

    return Response.json({
      items: rows.map((row) => ({
        id: String(row.id),
        name: String(row.name),
        quantity: String(row.quantity ?? ""),
        price: row.price === null ? null : Number(row.price),
        completed: Boolean(row.completed),
        createdAt: String(row.created_at),
        completedAt: row.completed_at ? String(row.completed_at) : null,
        addedBy: String(row.added_by_name),
        completedBy: row.completed_by_name ? String(row.completed_by_name) : null,
      })),
    });
  } catch {
    return Response.json({ error: "Não foi possível carregar a lista." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await familyUser();
    if ("error" in auth) return auth.error;

    const body = (await request.json()) as { name?: string; quantity?: string; price?: string | number };
    const name = cleanText(body.name, 120);
    const quantity = cleanText(body.quantity, 40);
    const price = parsePrice(body.price);
    if (!name) return Response.json({ error: "Informe o produto." }, { status: 400 });
    if (Number.isNaN(price)) return Response.json({ error: "Informe um preço válido, com no máximo duas casas decimais." }, { status: 400 });

    const id = randomUUID();
    const sql = db();
    await sql`
      INSERT INTO shopping_items (id, family_id, name, quantity, price, added_by)
      VALUES (${id}, ${auth.user.familyId}, ${name}, ${quantity}, ${price}, ${auth.user.id})
    `;

    return Response.json({ ok: true, id }, { status: 201 });
  } catch {
    return Response.json({ error: "Não foi possível adicionar o produto." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await familyUser();
    if ("error" in auth) return auth.error;

    const body = (await request.json()) as { id?: string; completed?: boolean };
    if (typeof body.id !== "string" || typeof body.completed !== "boolean") {
      return Response.json({ error: "Alteração inválida." }, { status: 400 });
    }

    const sql = db();
    const rows = await sql`
      UPDATE shopping_items
      SET
        completed = ${body.completed},
        completed_by = CASE WHEN ${body.completed} THEN ${auth.user.id}::uuid ELSE NULL END,
        completed_at = CASE WHEN ${body.completed} THEN NOW() ELSE NULL END
      WHERE id = ${body.id}
        AND family_id = ${auth.user.familyId}
      RETURNING id
    `;

    if (rows.length === 0) return Response.json({ error: "Produto não encontrado." }, { status: 404 });
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Não foi possível atualizar o produto." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await familyUser();
    if ("error" in auth) return auth.error;

    const body = (await request.json()) as { id?: string; clearCompleted?: boolean };
    const sql = db();

    if (body.clearCompleted) {
      await sql`
        DELETE FROM shopping_items
        WHERE family_id = ${auth.user.familyId}
          AND completed = TRUE
      `;
      return Response.json({ ok: true });
    }

    if (typeof body.id !== "string") {
      return Response.json({ error: "Produto inválido." }, { status: 400 });
    }

    await sql`
      DELETE FROM shopping_items
      WHERE id = ${body.id}
        AND family_id = ${auth.user.familyId}
    `;
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Não foi possível remover o produto." }, { status: 500 });
  }
}
