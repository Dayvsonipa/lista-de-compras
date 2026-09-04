-- O campo price guarda o preço por unidade.
-- Atualiza bancos existentes sem apagar usuários, famílias ou produtos.
ALTER TABLE shopping_items
  ADD COLUMN IF NOT EXISTS price NUMERIC(12, 2);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'shopping_items_price_nonnegative'
      AND conrelid = 'shopping_items'::regclass
  ) THEN
    ALTER TABLE shopping_items
      ADD CONSTRAINT shopping_items_price_nonnegative
      CHECK (price IS NULL OR price >= 0);
  END IF;
END
$$;

-- Confirma que a nova coluna foi criada corretamente.
SELECT
  column_name,
  data_type,
  numeric_precision,
  numeric_scale,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'shopping_items'
  AND column_name = 'price';
