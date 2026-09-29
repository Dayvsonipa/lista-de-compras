import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { normalizeProductName } from "@/lib/validation";

export async function GET(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return Response.json({ error: "Faça login novamente." }, { status: 401 });
    if (!user.familyId) return Response.json({ error: "Entre em uma família primeiro." }, { status: 403 });
    const query = normalizeProductName(new URL(request.url).searchParams.get("q"));
    if (query.length < 2) return Response.json({ products: [] });
    const sql = db();
    const rows = await sql`SELECT id, name, brand, package_quantity, package_unit, barcode, match_level
      FROM global_products WHERE active = TRUE AND POSITION(${query} IN normalized_name) > 0
      ORDER BY name, id LIMIT 8`;
    return Response.json({ products: rows.map(row => ({
      id: String(row.id), name: String(row.name), globalProductId: String(row.id),
      categoryId: null, lastUnitPrice: null, lastPurchasedAt: null, updatedAt: "",
      source: "global", matchLevel: row.match_level,
    })) });
  } catch (error) {
    console.error("Erro ao consultar catálogo geral:", { code: (error as {code?: string}).code });
    return Response.json({ error: "Catálogo geral temporariamente indisponível." }, { status: 503 });
  }
}
