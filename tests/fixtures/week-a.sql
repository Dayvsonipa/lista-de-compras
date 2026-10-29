-- LISTA CASA — SEMANA A — compra planejada para 31/10/2026
-- Cole TODO este arquivo no SQL Editor do Neon, no banco do Lista Casa.
-- Base: schema e API recuperados do projeto; não executado no banco de produção.
-- 48 itens pendentes, cada um com quantidade 1 (um lote).
-- Peso/volume/unidades estão no NOME. Ao comprar, informe o PREÇO TOTAL DO LOTE.
-- Ex.: Ovos — 24 unidades: quantidade 1, preço total dos 24 ovos.
-- Não informar preço por kg nem por ovo: o app multiplica preço por quantidade.
-- Alternativas, item opcional e lembrete de estoque foram mantidos como enviados.
-- Categorias: reutiliza nome exato ativo; cria os cinco grupos se necessário.
-- Produtos: reutiliza nome exato normalizado; não associa por semelhança.
-- Um lote diferente não herda automaticamente o histórico de outro peso/tamanho.
-- Reexecução: IDs fixos por família + lote + posição evitam duplicação, inclusive
-- após arquivamento. Não altere a chave do lote nem a ordem para tentar novamente.
-- Itens idênticos (mesmo nome e quantidade 1) já na lista também são preservados.
-- Nenhum item existente é apagado ou tem sua quantidade/preço alterados.
-- Se houver mais de um Dayvson, preencha v_email abaixo com o e-mail da conta.
-- O bloco é atômico: qualquer erro desfaz todas as inserções deste bloco.

DO $importacao$
DECLARE
  v_email text := ''; -- Opcional: e-mail exato da conta Dayvson.
  v_lote constant text := 'lista-casa-semana-a-2026-10-31-v1';
  v_user uuid;
  v_family uuid;
  v_count integer;
  v_category uuid;
  v_product uuid;
  v_item uuid;
  v_hash text;
  v_added integer := 0;
  v_skipped integer := 0;
  v_changed integer;
  r record;
BEGIN
  SELECT count(*) INTO v_count FROM users u
  WHERE (btrim(v_email) <> '' AND lower(u.email) = lower(btrim(v_email)))
     OR (btrim(v_email) = '' AND lower(btrim(u.name)) ~ '^dayvson([[:space:]]|$)');
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'Encontradas % contas para Dayvson. Preencha v_email com o e-mail exato e execute novamente. Nada foi inserido.', v_count;
  END IF;
  SELECT u.id INTO v_user FROM users u
  WHERE (btrim(v_email) <> '' AND lower(u.email) = lower(btrim(v_email)))
     OR (btrim(v_email) = '' AND lower(btrim(u.name)) ~ '^dayvson([[:space:]]|$)');

  SELECT count(*) INTO v_count FROM family_members WHERE user_id = v_user;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'A conta precisa pertencer a exatamente uma família. Nada foi inserido.';
  END IF;
  SELECT family_id INTO v_family FROM family_members WHERE user_id = v_user;
  -- Serializa duas execuções simultâneas desta mesma importação/família.
  PERFORM pg_advisory_xact_lock(hashtextextended(v_family::text || v_lote, 0));

  -- A API recuperada mostra no máximo 300 itens. Verificação conservadora.
  SELECT count(*) INTO v_count FROM shopping_items WHERE family_id = v_family;
  IF v_count > 252 THEN
    RAISE EXCEPTION 'A família já possui % itens. Com 48 novos, pode ultrapassar o limite de 300 da tela. Revise a lista antes de importar.', v_count;
  END IF;

  FOR r IN SELECT * FROM (VALUES
      (1, 'Carnes, peixes e ovos', 'Carne moída — 600 g', 'carne moída — 600 g'),
      (2, 'Carnes, peixes e ovos', 'Filé de tilápia — 600 g', 'filé de tilápia — 600 g'),
      (3, 'Carnes, peixes e ovos', 'Filé de frango — 1,6 kg', 'filé de frango — 1,6 kg'),
      (4, 'Carnes, peixes e ovos', 'Costelinha suína — 900 g', 'costelinha suína — 900 g'),
      (5, 'Carnes, peixes e ovos', 'Bifes bovinos — 600 g', 'bifes bovinos — 600 g'),
      (6, 'Carnes, peixes e ovos', 'Ovos — 24 unidades', 'ovos — 24 unidades'),
      (7, 'Arroz, feijão e massas', 'Arroz — 1,5 kg', 'arroz — 1,5 kg'),
      (8, 'Arroz, feijão e massas', 'Feijão — 1 kg', 'feijão — 1 kg'),
      (9, 'Arroz, feijão e massas', 'Macarrão — 500 g', 'macarrão — 500 g'),
      (10, 'Arroz, feijão e massas', 'Pão francês — 12 unidades', 'pão francês — 12 unidades'),
      (11, 'Arroz, feijão e massas', 'Pão de forma — 1 pacote', 'pão de forma — 1 pacote'),
      (12, 'Arroz, feijão e massas', 'Pão de queijo — 700 g', 'pão de queijo — 700 g'),
      (13, 'Arroz, feijão e massas', 'Goma de tapioca — 500 g', 'goma de tapioca — 500 g'),
      (14, 'Arroz, feijão e massas', 'Farinha de trigo — 500 g', 'farinha de trigo — 500 g'),
      (15, 'Arroz, feijão e massas', 'Aveia ou granola — 250 g', 'aveia ou granola — 250 g'),
      (16, 'Arroz, feijão e massas', 'Batata palha — 300 g', 'batata palha — 300 g'),
      (17, 'Legumes e verduras', 'Batata inglesa — 2 kg', 'batata inglesa — 2 kg'),
      (18, 'Legumes e verduras', 'Mandioca — 700 g', 'mandioca — 700 g'),
      (19, 'Legumes e verduras', 'Cenoura — 1 kg', 'cenoura — 1 kg'),
      (20, 'Legumes e verduras', 'Abobrinha — 2 unidades', 'abobrinha — 2 unidades'),
      (21, 'Legumes e verduras', 'Brócolis — 1 maço', 'brócolis — 1 maço'),
      (22, 'Legumes e verduras', 'Couve — 2 maços', 'couve — 2 maços'),
      (23, 'Legumes e verduras', 'Alface — 1 pé', 'alface — 1 pé'),
      (24, 'Legumes e verduras', 'Tomate — 5 unidades', 'tomate — 5 unidades'),
      (25, 'Legumes e verduras', 'Pepino — 2 unidades', 'pepino — 2 unidades'),
      (26, 'Legumes e verduras', 'Cebola — 700 g', 'cebola — 700 g'),
      (27, 'Legumes e verduras', 'Alho — 2 cabeças', 'alho — 2 cabeças'),
      (28, 'Legumes e verduras', 'Cheiro-verde — 1 maço', 'cheiro-verde — 1 maço'),
      (29, 'Frutas e bebidas', 'Banana — 14 unidades', 'banana — 14 unidades'),
      (30, 'Frutas e bebidas', 'Mamão — 2 unidades', 'mamão — 2 unidades'),
      (31, 'Frutas e bebidas', 'Maçã — 5 unidades', 'maçã — 5 unidades'),
      (32, 'Frutas e bebidas', 'Uva — 500 g', 'uva — 500 g'),
      (33, 'Frutas e bebidas', 'Morango — 1 bandeja', 'morango — 1 bandeja'),
      (34, 'Frutas e bebidas', 'Tangerina — 4 unidades', 'tangerina — 4 unidades'),
      (35, 'Frutas e bebidas', 'Laranja — 5 unidades', 'laranja — 5 unidades'),
      (36, 'Frutas e bebidas', 'Limão para limonada — 12 unidades', 'limão para limonada — 12 unidades'),
      (37, 'Frutas e bebidas', 'Leite — 5 litros', 'leite — 5 litros'),
      (38, 'Frutas e bebidas', 'Iogurte natural — 1,5 kg', 'iogurte natural — 1,5 kg'),
      (39, 'Laticínios e complementos', 'Queijo muçarela — 600 g', 'queijo muçarela — 600 g'),
      (40, 'Laticínios e complementos', 'Requeijão — 1 copo', 'requeijão — 1 copo'),
      (41, 'Laticínios e complementos', 'Creme de leite — 4 caixas', 'creme de leite — 4 caixas'),
      (42, 'Laticínios e complementos', 'Milho para fricassê — 1 lata', 'milho para fricassê — 1 lata'),
      (43, 'Laticínios e complementos', 'Champignon (opcional) — 1 vidro', 'champignon (opcional) — 1 vidro'),
      (44, 'Laticínios e complementos', 'Molho de tomate — 2 sachês', 'molho de tomate — 2 sachês'),
      (45, 'Laticínios e complementos', 'Fermento químico — 1 pote pequeno', 'fermento químico — 1 pote pequeno'),
      (46, 'Laticínios e complementos', 'Manteiga ou margarina — 250 g', 'manteiga ou margarina — 250 g'),
      (47, 'Laticínios e complementos', 'Óleo ou azeite — 1 unidade', 'óleo ou azeite — 1 unidade'),
      (48, 'Laticínios e complementos', 'Sal e temperos — Conferir estoque', 'sal e temperos — conferir estoque')
  ) AS lista(ordem, categoria, nome, normalizado) ORDER BY ordem
  LOOP
    -- UUID estável com versão/variante aceitas pela API do app.
    v_hash := md5(v_family::text || ':' || v_lote || ':' || r.ordem::text);
    v_hash := overlay(overlay(v_hash placing '4' from 13 for 1) placing '8' from 17 for 1);
    v_item := v_hash::uuid;

    IF EXISTS (SELECT 1 FROM shopping_items WHERE id = v_item)
       OR EXISTS (SELECT 1 FROM purchase_items WHERE id = v_item)
       OR EXISTS (SELECT 1 FROM shopping_items
                  WHERE family_id = v_family AND lower(btrim(name)) = r.normalizado
                    AND quantity = '1') THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    SELECT id INTO v_category FROM shopping_categories
    WHERE family_id = v_family AND active = TRUE AND lower(name) = lower(r.categoria);
    IF v_category IS NULL THEN
      INSERT INTO shopping_categories (id, family_id, name, sort_order, created_by)
      SELECT gen_random_uuid(), v_family, r.categoria, COALESCE(max(sort_order), 0) + 1, v_user
      FROM shopping_categories WHERE family_id = v_family
      ON CONFLICT (family_id, lower(name)) WHERE active = TRUE DO NOTHING;
      SELECT id INTO v_category FROM shopping_categories
      WHERE family_id = v_family AND active = TRUE AND lower(name) = lower(r.categoria);
    END IF;

    INSERT INTO family_products (id, family_id, name, normalized_name, category_id)
    VALUES (gen_random_uuid(), v_family, r.nome, r.normalizado, v_category)
    ON CONFLICT (family_id, normalized_name) DO NOTHING;
    SELECT id INTO v_product FROM family_products
    WHERE family_id = v_family AND normalized_name = r.normalizado;

    INSERT INTO shopping_items
      (id, family_id, category_id, product_id, name, quantity, added_by, completed, unit_price)
    VALUES
      (v_item, v_family, v_category, v_product, r.nome, '1', v_user, FALSE, NULL)
    ON CONFLICT (id) DO NOTHING;
    GET DIAGNOSTICS v_changed = ROW_COUNT;
    v_added := v_added + v_changed;
    v_skipped := v_skipped + (1 - v_changed);
  END LOOP;
  RAISE NOTICE 'Semana A: % itens adicionados e % já existentes/arquivados preservados. Autor: %, família: %.', v_added, v_skipped, v_user, v_family;
END
$importacao$;
