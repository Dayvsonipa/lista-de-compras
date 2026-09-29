-- Execute no Neon antes de publicar os arquivos. Pode executar novamente.
BEGIN;
CREATE TABLE IF NOT EXISTS global_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(120) NOT NULL,
  normalized_name VARCHAR(140) NOT NULL UNIQUE,
  brand VARCHAR(80),
  package_quantity NUMERIC(12,3),
  package_unit VARCHAR(10),
  barcode VARCHAR(14) UNIQUE,
  match_level VARCHAR(10) NOT NULL DEFAULT 'generic' CHECK (match_level IN ('generic', 'exact')),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (package_quantity IS NULL OR package_quantity > 0),
  CHECK (match_level <> 'exact' OR (brand IS NOT NULL AND package_quantity IS NOT NULL AND package_unit IS NOT NULL))
);
ALTER TABLE family_products ADD COLUMN IF NOT EXISTS global_product_id UUID
  REFERENCES global_products(id) ON DELETE SET NULL;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'shopping_items' AND column_name = 'comparison_unit_price') THEN
    ALTER TABLE shopping_items ADD COLUMN comparison_unit_price NUMERIC(12,2);
    UPDATE shopping_items si SET comparison_unit_price = fp.last_unit_price
      FROM family_products fp WHERE si.completed = TRUE AND si.product_id = fp.id AND si.family_id = fp.family_id;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_family_products_global ON family_products(family_id, global_product_id);
-- Exemplos genéricos, sem marca: sugestões de cadastro, NÃO equivalências exatas entre mercados.
-- Produtos privados das famílias não são publicados automaticamente neste catálogo.
INSERT INTO global_products(name, normalized_name, package_quantity, package_unit) VALUES
 ('Arroz 5 kg','arroz 5 kg',5,'kg'),
 ('Arroz 1 kg','arroz 1 kg',1,'kg'),
 ('Feijão 1 kg','feijão 1 kg',1,'kg'),
 ('Açúcar 1 kg','açúcar 1 kg',1,'kg'),
 ('Café 500 g','café 500 g',500,'g'),
 ('Leite 1 L','leite 1 l',1,'l'),
 ('Óleo de soja 900 ml','óleo de soja 900 ml',900,'ml'),
 ('Macarrão 500 g','macarrão 500 g',500,'g'),
 ('Sal 1 kg','sal 1 kg',1,'kg'),
 ('Farinha de trigo 1 kg','farinha de trigo 1 kg',1,'kg'),
 ('Detergente 500 ml','detergente 500 ml',500,'ml'),
 ('Shampoo 350 ml','shampoo 350 ml',350,'ml'),
 ('Condicionador 350 ml','condicionador 350 ml',350,'ml'),
 ('Sabonete 90 g','sabonete 90 g',90,'g')
ON CONFLICT (normalized_name) DO NOTHING;
COMMIT;
