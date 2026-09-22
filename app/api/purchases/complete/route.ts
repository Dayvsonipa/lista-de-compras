import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return Response.json({ error: "Faça login novamente." }, { status: 401 });
    if (!user.familyId) return Response.json({ error: "Entre em uma família primeiro." }, { status: 403 });

    const body = (await request.json()) as { sessionId?: string; itemIds?: string[] };
    if (typeof body.sessionId !== "string" || !UUID_PATTERN.test(body.sessionId)) {
      return Response.json({ error: "Compra inválida." }, { status: 400 });
    }
    const itemIds = Array.isArray(body.itemIds)
      ? [...new Set(body.itemIds.filter((id) => typeof id === "string" && UUID_PATTERN.test(id)))].slice(0, 300)
      : [];
    if (itemIds.length === 0) return Response.json({ ok: true, archived: 0 });

    const sql = db();
    const selected = await sql`
      SELECT
        si.id,
        si.product_id,
        si.name,
        si.quantity,
        si.unit_price,
        si.completed_by,
        si.completed_at,
        sc.name AS category_name
      FROM shopping_items si
      LEFT JOIN shopping_categories sc ON sc.id = si.category_id
      WHERE si.family_id = ${user.familyId}
        AND si.completed = TRUE
        AND si.id = ANY(${itemIds}::uuid[])
      ORDER BY si.completed_at ASC NULLS LAST
    `;

    if (selected.length === 0) return Response.json({ ok: true, archived: 0 });

    await sql`
      INSERT INTO purchase_sessions (id, family_id, purchased_by, purchased_at, total_amount)
      VALUES (${body.sessionId}, ${user.familyId}, ${user.id}, NOW(), 0)
      ON CONFLICT (id) DO NOTHING
    `;

    for (const row of selected) {
      const rawQuantity = String(row.quantity ?? "1");
      const quantity = /^\d+$/.test(rawQuantity) && Number(rawQuantity) > 0 ? Number(rawQuantity) : 1;
      const unitPrice = row.unit_price === null ? null : Number(row.unit_price);
      const totalPrice = unitPrice === null ? null : Math.round((unitPrice * quantity + Number.EPSILON) * 100) / 100;
      const purchasedBy = row.completed_by ? String(row.completed_by) : user.id;
      const purchasedAt = row.completed_at ? String(row.completed_at) : new Date().toISOString();

      await sql`
        INSERT INTO purchase_items (
          id, session_id, family_id, product_id, product_name, category_name,
          quantity, unit_price, total_price, purchased_by, purchased_at
        ) VALUES (
          ${String(row.id)}, ${body.sessionId}, ${user.familyId}, ${row.product_id ? String(row.product_id) : null},
          ${String(row.name)}, ${row.category_name ? String(row.category_name) : null},
          ${quantity}, ${unitPrice}, ${totalPrice}, ${purchasedBy}, ${purchasedAt}
        )
        ON CONFLICT (id) DO NOTHING
      `;

      if (row.product_id && unitPrice !== null) {
        await sql`
          UPDATE family_products
          SET last_unit_price = ${unitPrice}, last_purchased_at = ${purchasedAt}, updated_at = NOW()
          WHERE id = ${String(row.product_id)}
            AND family_id = ${user.familyId}
        `;
      }
    }

    await sql`
      UPDATE purchase_sessions ps
      SET total_amount = COALESCE((
        SELECT SUM(pi.total_price)
        FROM purchase_items pi
        WHERE pi.session_id = ps.id
      ), 0)
      WHERE ps.id = ${body.sessionId}
        AND ps.family_id = ${user.familyId}
    `;

    await sql`
      DELETE FROM shopping_items
      WHERE family_id = ${user.familyId}
        AND completed = TRUE
        AND id = ANY(${itemIds}::uuid[])
    `;

    return Response.json({ ok: true, archived: selected.length });
  } catch {
    return Response.json({ error: "Não foi possível arquivar esta compra." }, { status: 500 });
  }
}
