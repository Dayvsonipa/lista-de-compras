import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function PATCH(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return Response.json({ error: "Faça login novamente." }, { status: 401 });
    if (!user.familyId) return Response.json({ error: "Entre em uma família primeiro." }, { status: 403 });
    if (user.role !== "owner") {
      return Response.json({ error: "Somente quem criou a família pode alterar esta configuração." }, { status: 403 });
    }

    const body = (await request.json()) as { collectPricesOnPurchase?: boolean };
    if (typeof body.collectPricesOnPurchase !== "boolean") {
      return Response.json({ error: "Configuração inválida." }, { status: 400 });
    }

    const sql = db();
    const rows = await sql`
      UPDATE families
      SET collect_prices_on_purchase = ${body.collectPricesOnPurchase}
      WHERE id = ${user.familyId}
        AND created_by = ${user.id}
      RETURNING collect_prices_on_purchase
    `;

    if (rows.length === 0) {
      return Response.json({ error: "Não foi possível alterar a configuração." }, { status: 403 });
    }

    return Response.json({
      ok: true,
      collectPricesOnPurchase: Boolean(rows[0].collect_prices_on_purchase),
    });
  } catch {
    return Response.json({ error: "Não foi possível salvar a configuração." }, { status: 500 });
  }
}
