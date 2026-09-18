-- Categorias por família e campos de controle usados pela sincronização offline.
-- Esta migração preserva todos os usuários, famílias, produtos e preços existentes.

CREATE TABLE IF NOT EXISTS shopping_categories (
  id UUID PRIMARY KEY,
  family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  name VARCHAR(60) NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE shopping_items
  ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES shopping_categories(id) ON DELETE SET NULL;

ALTER TABLE shopping_items
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE UNIQUE INDEX IF NOT EXISTS idx_shopping_categories_family_name
  ON shopping_categories (family_id, LOWER(name))
  WHERE active = TRUE;

CREATE INDEX IF NOT EXISTS idx_shopping_categories_family_order
  ON shopping_categories (family_id, active, sort_order, name);

CREATE INDEX IF NOT EXISTS idx_shopping_items_family_updated
  ON shopping_items (family_id, updated_at DESC);

-- Famílias que já existem recebem categorias iniciais. Os produtos antigos
-- permanecem em "Sem categoria" até serem editados pelo usuário.
INSERT INTO shopping_categories (id, family_id, name, sort_order, created_by)
SELECT gen_random_uuid(), f.id, defaults.name, defaults.sort_order, f.created_by
FROM families f
CROSS JOIN (
  VALUES
    ('Hortifruti', 10),
    ('Açougue', 20),
    ('Padaria', 30),
    ('Laticínios', 40),
    ('Mercearia', 50),
    ('Bebidas', 60),
    ('Limpeza', 70),
    ('Higiene', 80)
) AS defaults(name, sort_order)
WHERE NOT EXISTS (
  SELECT 1
  FROM shopping_categories sc
  WHERE sc.family_id = f.id
    AND LOWER(sc.name) = LOWER(defaults.name)
    AND sc.active = TRUE
);

SELECT
  (SELECT COUNT(*) FROM shopping_categories WHERE active = TRUE) AS active_categories,
  (SELECT data_type FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'shopping_items' AND column_name = 'category_id') AS category_id_type,
  (SELECT data_type FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'shopping_items' AND column_name = 'updated_at') AS updated_at_type;
