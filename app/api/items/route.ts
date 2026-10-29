import { baseUnit, baseQuantity, parseQuantity, validUnit, needsProductChoice } from "@/lib/measures";
import { ProductCatalogError, resolveFamilyProduct } from "@/lib/product-catalog";
import { randomUUID } from "node:crypto";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { cleanText } from "@/lib/validation";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function logItemsError(method: string, error: unknown, stage?: string) {
  const detail = error as {
    message?: string;
    code?: string;
    table?: string;
    column?: string;
    constraint?: string;
  } | null;

  console.error(`Erro em ${method} /api/items:`, {
    etapa: stage,
    mensagem: detail?.message ?? "Erro sem mensagem disponível",
    codigo: detail?.code,
    tabela: detail?.table,
    coluna: detail?.column,
    restricao: detail?.constraint,
  });
}

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
        si.quantity, si.unit, si.notes, si.price_basis, si.total_price_override,
        si.category_id,
        si.product_id,
        si.unit_price,
        si.completed,
        si.created_at,
        si.completed_at,
        si.updated_at,
        CASE WHEN si.completed THEN CASE WHEN si.price_basis IS NOT NULL THEN si.comparison_unit_price END ELSE previous.unit_price END AS previous_unit_price,
        added.name AS added_by_name,
        completed.name AS completed_by_name
      FROM shopping_items si
      JOIN users added ON added.id = si.added_by
      LEFT JOIN users completed ON completed.id = si.completed_by
      LEFT JOIN LATERAL (
        SELECT pi.unit_price FROM purchase_items pi
        WHERE pi.product_id=si.product_id AND pi.family_id=si.family_id
          AND pi.price_basis=CASE si.unit WHEN 'g' THEN 'kg' WHEN 'ml' THEN 'l' ELSE si.unit END
          AND pi.unit_price IS NOT NULL
        ORDER BY pi.purchased_at DESC,pi.id DESC LIMIT 1
      ) previous ON TRUE
      WHERE si.family_id = ${auth.user.familyId}
      ORDER BY si.completed ASC, si.created_at DESC
      LIMIT 300
    `;

    return Response.json({
      items: rows.map((row) => ({
        id: String(row.id),
        name: String(row.name),
        quantity: String(row.quantity ?? ""),
        totalPrice: row.total_price_override === null ? null : Number(row.total_price_override),
        unit: String(row.unit), notes: String(row.notes), priceBasis: row.price_basis ? String(row.price_basis) : null,
        categoryId: row.category_id ? String(row.category_id) : null,
        productId: row.product_id ? String(row.product_id) : null,
        previousUnitPrice: row.previous_unit_price === null ? null : Number(row.previous_unit_price),
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
  } catch (error) {
    logItemsError("GET", error);
    return Response.json({ error: "Não foi possível carregar a lista." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  let stage = "autenticar usuário";
  try {
    const auth = await familyUser();
    if ("error" in auth) return auth.error;

    stage = "ler e validar dados";
    const body = (await request.json()) as { id?: string; productId?: string; globalProductId?: string | null; name?: string; quantity?: string; unit?: string; notes?: string; measurementVersion?: number; replaceProduct?: boolean; measuredQuantity?: string; priceMode?: string; categoryId?: string | null };
    const name = cleanText(body.name, 120);
    const unit = body.unit ?? (body.measurementVersion === 2 ? "item" : "un");
    const quantity = validUnit(unit) ? parseQuantity(body.quantity, unit) : null;
    const notes = cleanText(body.notes, 240);
    const categoryId = typeof body.categoryId === "string" && UUID_PATTERN.test(body.categoryId) ? body.categoryId : null;
    if (!name) return Response.json({ error: "Informe o produto." }, { status: 400 });
    if (!quantity) return Response.json({ error: "Informe uma quantidade válida (até 9999; peso/volume aceitam 3 casas decimais)." }, { status: 400 });

    const id = typeof body.id === "string" && UUID_PATTERN.test(body.id) ? body.id : randomUUID();
    const requestedProductId = typeof body.productId === "string" && UUID_PATTERN.test(body.productId) ? body.productId : randomUUID();
    stage = "preparar conexão com o banco";
    const sql = db();
    if (categoryId) {
      stage = "validar categoria";
      const categoryRows = await sql`
        SELECT id FROM shopping_categories
        WHERE id = ${categoryId} AND family_id = ${auth.user.familyId} AND active = TRUE
        LIMIT 1
      `;
      if (categoryRows.length === 0) return Response.json({ error: "Categoria inválida." }, { status: 400 });
    }
    stage = "salvar produto em family_products";
    const productId = await resolveFamilyProduct({
      familyId: auth.user.familyId!, requestedId: requestedProductId, name, categoryId,
      globalProductId: typeof body.globalProductId === "string" && UUID_PATTERN.test(body.globalProductId) ? body.globalProductId : null,
    });

    stage = "inserir item em shopping_items";
    await sql`
      INSERT INTO shopping_items (id, family_id, category_id, product_id, name, quantity, added_by, unit, notes, measurement_version)
      VALUES (${id}, ${auth.user.familyId}, ${categoryId}, ${productId}, ${name}, ${quantity}, ${auth.user.id}, ${unit}, ${notes}, ${body.measurementVersion === 2 ? 2 : 1})
      ON CONFLICT (id) DO NOTHING
    `;

    return Response.json({ ok: true, id }, { status: 201 });
  } catch (error) {
    if (error instanceof ProductCatalogError) return Response.json({ error: error.message }, { status: error.status });
    logItemsError("POST", error, stage);
    return Response.json({ error: "Não foi possível adicionar o produto." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await familyUser();
    if ("error" in auth) return auth.error;

    const body = (await request.json()) as { id?: string; productId?: string; globalProductId?: string | null; name?: string; quantity?: string; unit?: string; notes?: string; measurementVersion?: number; replaceProduct?: boolean; measuredQuantity?: string; priceMode?: string; categoryId?: string | null; completed?: boolean; unitPrice?: string | number | null };
    if (typeof body.id !== "string" || !UUID_PATTERN.test(body.id)) {
      return Response.json({ error: "Alteração inválida." }, { status: 400 });
    }

    const sql = db();

    if (body.name !== undefined || body.quantity !== undefined || body.categoryId !== undefined || body.unit !== undefined || body.notes !== undefined) {
      const name = cleanText(body.name, 120);
      const unit = body.unit ?? (body.measurementVersion === 2 ? "item" : "un");
      const quantity = validUnit(unit) ? parseQuantity(body.quantity, unit) : null;
      const notes = cleanText(body.notes, 240);
      const categoryId = typeof body.categoryId === "string" && UUID_PATTERN.test(body.categoryId) ? body.categoryId : null;
      const requestedProductId = typeof body.productId === "string" && UUID_PATTERN.test(body.productId) ? body.productId : randomUUID();
      if (!name) return Response.json({ error: "Informe o produto." }, { status: 400 });
      if (!quantity) return Response.json({ error: "Informe uma quantidade válida (até 9999; peso/volume aceitam 3 casas decimais)." }, { status: 400 });

      if (categoryId) {
        const categoryRows = await sql`
          SELECT id FROM shopping_categories
          WHERE id = ${categoryId} AND family_id = ${auth.user.familyId} AND active = TRUE
          LIMIT 1
        `;
        if (categoryRows.length === 0) return Response.json({ error: "Categoria inválida." }, { status: 400 });
      }

      // Resolve only after checking the item belongs to this family and is editable.
      const existing = await sql`SELECT product_id, unit, notes, measurement_version FROM shopping_items
        WHERE id = ${body.id} AND family_id = ${auth.user.familyId} AND completed = FALSE`;
      if (existing.length && body.measurementVersion !== 2 && (existing[0].measurement_version === 2 || existing[0].unit !== "un" || existing[0].notes)) return Response.json({ error: "Atualize o aplicativo antes de alterar este item com medidas." }, { status: 409 });
      if (!existing.length) return Response.json({ error: "Produto não encontrado ou já comprado." }, { status: 404 });
      const productId = await resolveFamilyProduct({
        familyId: auth.user.familyId!,
        requestedId: body.replaceProduct ? requestedProductId : String(existing[0].product_id ?? requestedProductId),
        name, categoryId, rename: !body.replaceProduct,
      });

      const rows = await sql`
        UPDATE shopping_items
        SET name = ${name}, quantity = ${quantity}, unit = ${unit}, notes = ${notes}, measurement_version = ${body.measurementVersion === 2 ? 2 : 1}, category_id = ${categoryId}, product_id = ${productId}, updated_at = NOW()
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

    const current = await sql`SELECT quantity,unit,notes,name,measurement_version FROM shopping_items WHERE id=${body.id} AND family_id=${auth.user.familyId}`;
    if (!current.length) return Response.json({ error: "Produto não encontrado." }, { status: 404 });
    const row = current[0];
    if (body.measurementVersion !== 2 && (row.measurement_version === 2 || row.unit !== "un" || row.notes)) return Response.json({ error: "Atualize o aplicativo antes de alterar este item com medidas." }, { status: 409 });
    if (body.completed && needsProductChoice(String(row.name))) return Response.json({ error: "Edite o item e escolha o produto comprado antes de colocar no carrinho." }, { status: 400 });
    const quantity = parseQuantity(body.measuredQuantity ?? row.quantity, String(row.unit));
    if (!quantity) return Response.json({ error: "Quantidade inválida." }, { status: 400 });
    if (body.priceMode && !["unit", "total"].includes(body.priceMode)) return Response.json({ error: "Forma de preço inválida." }, { status: 400 });
    const entered = body.completed && auth.user.collectPricesOnPurchase ? parsePrice(body.unitPrice) : null;
    if (Number.isNaN(entered)) return Response.json({ error: "Informe um preço válido." }, { status: 400 });
    const basis = body.measurementVersion === 2 && row.unit !== "item" ? baseUnit(String(row.unit)) : null;
    const amount = baseQuantity(quantity, String(row.unit));
    const unitPrice = entered === null ? null : body.priceMode === "total" ? Number(entered) / amount : Number(entered);
    if (unitPrice !== null && (!Number.isFinite(unitPrice) || unitPrice > 9999999.99)) return Response.json({ error: "Preço por unidade acima do limite." }, { status: 400 });
    const rows = await sql`
      UPDATE shopping_items SET
        comparison_unit_price = CASE WHEN ${body.completed} AND ${basis}::text IS NOT NULL THEN
          CASE WHEN completed THEN comparison_unit_price ELSE
            (SELECT pi.unit_price FROM purchase_items pi WHERE pi.product_id=shopping_items.product_id
              AND pi.family_id=${auth.user.familyId} AND pi.price_basis=${basis} AND pi.unit_price IS NOT NULL
              ORDER BY pi.purchased_at DESC,pi.id DESC LIMIT 1) END ELSE NULL END,
        quantity=${quantity}, price_basis=CASE WHEN ${body.completed} THEN ${basis} ELSE NULL END,
        completed=${body.completed},
        completed_by=CASE WHEN ${body.completed} THEN ${auth.user.id}::uuid ELSE NULL END,
        completed_at=CASE WHEN ${body.completed} THEN COALESCE(completed_at,NOW()) ELSE NULL END,
        unit_price=${unitPrice}, total_price_override=${body.completed && body.priceMode === "total" ? entered : null}, updated_at=NOW()
      WHERE id=${body.id} AND family_id=${auth.user.familyId} RETURNING id
    `;

    if (rows.length === 0) return Response.json({ error: "Produto não encontrado." }, { status: 404 });
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof ProductCatalogError) return Response.json({ error: error.message }, { status: error.status });
    logItemsError("PATCH", error);
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
      return Response.json({ error: "Atualize o aplicativo e use Finalizar compra para preservar o histórico." }, { status: 409 });
    }

    if (typeof body.id !== "string" || !UUID_PATTERN.test(body.id)) {
      return Response.json({ error: "Produto inválido." }, { status: 400 });
    }

    await sql`
      DELETE FROM shopping_items
      WHERE id = ${body.id}
        AND family_id = ${auth.user.familyId}
        AND completed = FALSE
    `;
    return Response.json({ ok: true });
  } catch (error) {
    logItemsError("DELETE", error);
    return Response.json({ error: "Não foi possível remover o produto." }, { status: 500 });
  }
}
