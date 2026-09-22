-- Catálogo familiar e histórico permanente de compras.
-- Execute depois de 003_categories_and_offline_sync.sql.
-- A migração preserva usuários, famílias, produtos atuais, preços e categorias.

CREATE TABLE IF NOT EXISTS family_products (
  id UUID PRIMARY KEY,
  family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  name VARCHAR(120) NOT NULL,
  normalized_name VARCHAR(140) NOT NULL,
  category_id UUID REFERENCES shopping_categories(id) ON DELETE SET NULL,
  last_unit_price NUMERIC(12, 2),
  last_purchased_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT family_products_last_price_nonnegative CHECK (last_unit_price IS NULL OR last_unit_price >= 0),
  UNIQUE (family_id, normalized_name)
);

ALTER TABLE shopping_items
  ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES family_products(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS purchase_sessions (
  id UUID PRIMARY KEY,
  family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  purchased_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  purchased_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  total_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT purchase_sessions_total_nonnegative CHECK (total_amount >= 0)
);

CREATE TABLE IF NOT EXISTS purchase_items (
  id UUID PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES purchase_sessions(id) ON DELETE CASCADE,
  family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  product_id UUID REFERENCES family_products(id) ON DELETE SET NULL,
  product_name VARCHAR(120) NOT NULL,
  category_name VARCHAR(60),
  quantity INTEGER NOT NULL,
  unit_price NUMERIC(12, 2),
  total_price NUMERIC(14, 2),
  purchased_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  purchased_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT purchase_items_quantity_positive CHECK (quantity > 0),
  CONSTRAINT purchase_items_unit_price_nonnegative CHECK (unit_price IS NULL OR unit_price >= 0),
  CONSTRAINT purchase_items_total_nonnegative CHECK (total_price IS NULL OR total_price >= 0)
);

CREATE INDEX IF NOT EXISTS idx_family_products_family_name
  ON family_products (family_id, normalized_name);

CREATE INDEX IF NOT EXISTS idx_purchase_sessions_family_date
  ON purchase_sessions (family_id, purchased_at DESC);

CREATE INDEX IF NOT EXISTS idx_purchase_items_product_date
  ON purchase_items (family_id, product_id, purchased_at DESC);

INSERT INTO family_products (id, family_id, name, normalized_name, category_id, last_unit_price, last_purchased_at)
SELECT
  gen_random_uuid(),
  si.family_id,
  MIN(si.name),
  LOWER(REGEXP_REPLACE(TRIM(si.name), '\s+', ' ', 'g')),
  (ARRAY_AGG(si.category_id ORDER BY si.created_at DESC) FILTER (WHERE si.category_id IS NOT NULL))[1],
  NULL::numeric,
  NULL::timestamptz
FROM shopping_items si
GROUP BY si.family_id, LOWER(REGEXP_REPLACE(TRIM(si.name), '\s+', ' ', 'g'))
ON CONFLICT (family_id, normalized_name) DO NOTHING;

UPDATE shopping_items si
SET product_id = fp.id
FROM family_products fp
WHERE si.product_id IS NULL
  AND fp.family_id = si.family_id
  AND fp.normalized_name = LOWER(REGEXP_REPLACE(TRIM(si.name), '\s+', ' ', 'g'));

SELECT
  (SELECT COUNT(*) FROM family_products) AS catalog_products,
  (SELECT data_type FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'shopping_items' AND column_name = 'product_id') AS product_id_type,
  (SELECT COUNT(*) FROM purchase_sessions) AS saved_purchases,
  (SELECT COUNT(*) FROM purchase_items) AS saved_purchase_items;
