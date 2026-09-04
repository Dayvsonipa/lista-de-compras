-- Ativa a configuração de preços por família.
ALTER TABLE families
  ADD COLUMN IF NOT EXISTS collect_prices_on_purchase BOOLEAN NOT NULL DEFAULT FALSE;

-- Reaproveita com segurança a coluna da versão experimental, quando ela existe.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'shopping_items'
      AND column_name = 'price'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'shopping_items'
      AND column_name = 'unit_price'
  ) THEN
    ALTER TABLE shopping_items RENAME COLUMN price TO unit_price;

    -- Os valores experimentais eram informados antes da compra e não representam
    -- necessariamente preços efetivamente pagos.
    UPDATE shopping_items SET unit_price = NULL;
  ELSIF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'shopping_items'
      AND column_name = 'unit_price'
  ) THEN
    ALTER TABLE shopping_items ADD COLUMN unit_price NUMERIC(12, 2);
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'shopping_items_price_nonnegative'
      AND conrelid = 'shopping_items'::regclass
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'shopping_items'
      AND column_name = 'price'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'shopping_items_unit_price_nonnegative'
      AND conrelid = 'shopping_items'::regclass
  ) THEN
    ALTER TABLE shopping_items
      RENAME CONSTRAINT shopping_items_price_nonnegative
      TO shopping_items_unit_price_nonnegative;
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'shopping_items_unit_price_nonnegative'
      AND conrelid = 'shopping_items'::regclass
  ) THEN
    ALTER TABLE shopping_items
      ADD CONSTRAINT shopping_items_unit_price_nonnegative
      CHECK (unit_price IS NULL OR unit_price >= 0);
  END IF;
END
$$;

SELECT
  (SELECT data_type
   FROM information_schema.columns
   WHERE table_schema = 'public'
     AND table_name = 'shopping_items'
     AND column_name = 'unit_price') AS unit_price_type,
  (SELECT data_type
   FROM information_schema.columns
   WHERE table_schema = 'public'
     AND table_name = 'families'
     AND column_name = 'collect_prices_on_purchase') AS family_setting_type;
