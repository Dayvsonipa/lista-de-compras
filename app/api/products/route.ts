import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) return Response.json({ error: "Faça login novamente." }, { status: 401 });
    if (!user.familyId) return Response.json({ error: "Entre em uma família primeiro." }, { status: 403 });

    const sql = db();
    const rows = await sql`
      SELECT id, name, category_id, last_unit_price, last_purchased_at, updated_at
      FROM family_products
      WHERE family_id = ${user.familyId}
      ORDER BY last_purchased_at DESC NULLS LAST, name ASC
      LIMIT 600
    `;

    return Response.json({
      products: rows.map((row) => ({
        id: String(row.id),
        name: String(row.name),
        categoryId: row.category_id ? String(row.category_id) : null,
        lastUnitPrice: row.last_unit_price === null ? null : Number(row.last_unit_price),
        lastPurchasedAt: row.last_purchased_at ? String(row.last_purchased_at) : null,
        updatedAt: String(row.updated_at),
      })),
    });
  } catch {
    return Response.json({ error: "Não foi possível carregar o catálogo de produtos." }, { status: 500 });
  }
}
