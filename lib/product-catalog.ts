import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { normalizeProductName } from "@/lib/validation";

export class ProductCatalogError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

// The ID is family-owned. A changed display name must not replace its history.
export async function resolveFamilyProduct(input: {
  familyId: string; requestedId: string; name: string; categoryId: string | null;
  globalProductId?: string | null; rename?: boolean;
}) {
  const sql = db();
  const owned = await sql`SELECT id, global_product_id FROM family_products
    WHERE id = ${input.requestedId} AND family_id = ${input.familyId}`;
  if (owned.length) {
    if (input.rename) {
      try {
        await sql`UPDATE family_products SET name = ${input.name},
          normalized_name = ${normalizeProductName(input.name)},
          category_id = ${input.categoryId}, updated_at = NOW()
          WHERE id = ${input.requestedId} AND family_id = ${input.familyId}`;
      } catch (error) {
        if ((error as { code?: string }).code === "23505") {
          throw new ProductCatalogError("Já existe outro produto com esse nome na família. Escolha um nome diferente.", 409);
        }
        throw error;
      }
    }
    return input.requestedId;
  }
  if (input.globalProductId) {
    const catalog = await sql`SELECT id FROM global_products WHERE id = ${input.globalProductId} AND active = TRUE`;
    if (!catalog.length) throw new ProductCatalogError("Produto do catálogo indisponível.");
    const linked = await sql`SELECT id FROM family_products
      WHERE family_id = ${input.familyId} AND global_product_id = ${input.globalProductId}
      ORDER BY created_at, id LIMIT 1`;
    if (linked.length) return String(linked[0].id);
  }
  // Never accept another family's ID as an update target.
  const occupied = await sql`SELECT id FROM family_products WHERE id = ${input.requestedId}`;
  const id = occupied.length ? randomUUID() : input.requestedId;
  const rows = await sql`INSERT INTO family_products
    (id, family_id, name, normalized_name, category_id, global_product_id)
    VALUES (${id}, ${input.familyId}, ${input.name}, ${normalizeProductName(input.name)},
      ${input.categoryId}, ${input.globalProductId ?? null})
    ON CONFLICT (family_id, normalized_name) DO UPDATE
    SET global_product_id = COALESCE(family_products.global_product_id, EXCLUDED.global_product_id), updated_at = NOW()
    RETURNING id`;
  return String(rows[0].id);
}
