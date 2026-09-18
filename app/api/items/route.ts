import { randomUUID } from "node:crypto";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { cleanText } from "@/lib/validation";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

function parseItemQuantity(value: unknown) {
  if (value === undefined || value === null || value === "") return "1";

  const raw = String(value).trim();
  if (!/^\d{1,3}$/.test(raw)) return null;

  const quantity = Number(raw);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 999) return null;
  return String(quantity);
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
        si.category_id,
        si.unit_price,
        si.completed,
        si.created_at,
        si.completed_at,
        si.updated_at,
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
        categoryId: row.category_id ? String(row.category_id) : null,
        unitPrice: row.unit_price === null ? null : Number(row.unit_price),
        completed: Boolean(row.completed),
        createdAt: String(row.created_at),
        completedAt: row.completed_at ? String(row.completed_at) : null,
        updatedAt: String(row.updated_at ?? row.created_at),
        addedBy: String(row.added_by_name),
        completedBy: row.completed_by_name ? String(row.completed_by_name) : null,
      })),
      collectPricesOnPurchase: auth.user.collectPricesOnPurchase,
    });
  } catch {
    return Response.json({ error: "Não foi possível carregar a lista." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await familyUser();
    if ("error" in auth) return auth.error;

    const body = (await request.json()) as { id?: string; name?: string; quantity?: string; categoryId?: string | null };
    const name = cleanText(body.name, 120);
    const quantity = parseItemQuantity(body.quantity);
    const categoryId = typeof body.categoryId === "string" && UUID_PATTERN.test(body.categoryId) ? body.categoryId : null;
    if (!name) return Response.json({ error: "Informe o produto." }, { status: 400 });
    if (!quantity) return Response.json({ error: "Informe uma quantidade entre 1 e 999." }, { status: 400 });

    const id = typeof body.id === "string" && UUID_PATTERN.test(body.id) ? body.id : randomUUID();
    const sql = db();
    if (categoryId) {
      const categoryRows = await sql`
        SELECT id FROM shopping_categories
        WHERE id = ${categoryId} AND family_id = ${auth.user.familyId} AND active = TRUE
        LIMIT 1
      `;
      if (categoryRows.length === 0) return Response.json({ error: "Categoria inválida." }, { status: 400 });
    }
    await sql`
      INSERT INTO shopping_items (id, family_id, category_id, name, quantity, added_by)
      VALUES (${id}, ${auth.user.familyId}, ${categoryId}, ${name}, ${quantity}, ${auth.user.id})
      ON CONFLICT (id) DO NOTHING
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

    const body = (await request.json()) as { id?: string; name?: string; quantity?: string; categoryId?: string | null; completed?: boolean; unitPrice?: string | number | null };
    if (typeof body.id !== "string") {
      return Response.json({ error: "Alteração inválida." }, { status: 400 });
    }

    const sql = db();

    if (body.name !== undefined || body.quantity !== undefined || body.categoryId !== undefined) {
      const name = cleanText(body.name, 120);
      const quantity = parseItemQuantity(body.quantity);
      const categoryId = typeof body.categoryId === "string" && UUID_PATTERN.test(body.categoryId) ? body.categoryId : null;
      if (!name) return Response.json({ error: "Informe o produto." }, { status: 400 });
      if (!quantity) return Response.json({ error: "Informe uma quantidade entre 1 e 999." }, { status: 400 });

      if (categoryId) {
        const categoryRows = await sql`
          SELECT id FROM shopping_categories
          WHERE id = ${categoryId} AND family_id = ${auth.user.familyId} AND active = TRUE
          LIMIT 1
        `;
        if (categoryRows.length === 0) return Response.json({ error: "Categoria inválida." }, { status: 400 });
      }

      const rows = await sql`
        UPDATE shopping_items
        SET name = ${name}, quantity = ${quantity}, category_id = ${categoryId}, updated_at = NOW()
        WHERE id = ${body.id}
          AND family_id = ${auth.user.familyId}
          AND completed = FALSE
        RETURNING id
      `;

      if (rows.length === 0) return Response.json({ error: "Produto não encontrado ou já comprado." }, { status: 404 });
      return Response.json({ ok: true });
    }

    if (typeof body.completed !== "boolean") {
      return Response.json({ error: "Alteração inválida." }, { status: 400 });
    }

    const unitPrice = body.completed && auth.user.collectPricesOnPurchase
      ? parsePrice(body.unitPrice)
      : null;
    if (Number.isNaN(unitPrice)) {
      return Response.json({ error: "Informe um preço válido, com no máximo duas casas decimais." }, { status: 400 });
    }

    const rows = await sql`
      UPDATE shopping_items
      SET
        completed = ${body.completed},
        completed_by = CASE WHEN ${body.completed} THEN ${auth.user.id}::uuid ELSE NULL END,
        completed_at = CASE WHEN ${body.completed} THEN NOW() ELSE NULL END,
        unit_price = CASE WHEN ${body.completed} THEN ${unitPrice}::numeric ELSE NULL END
        , updated_at = NOW()
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
