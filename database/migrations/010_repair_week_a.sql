-- CORREÇÃO DA SEMANA A. Execute após 009 e após atualizar o app em todos os aparelhos.
-- Sincronize as alterações offline antes. Não rode a importação antiga novamente.
-- Só altera IDs determinísticos da importação original, pendentes, ainda com nome
-- original e quantidade 1. Comprados, históricos e itens editados são preservados.
-- Nome exato normalizado reutiliza o produto; sem correspondência exata cria novo.
-- Não associa marcas/tipos por semelhança. Histórico sem unidade continua sem setas.
-- A primeira execução é PRÉVIA: v_aplicar=false não grava nada.
-- Leia os avisos. Para aplicar, altere SOMENTE v_aplicar para true e execute inteiro.
DO $repair$
DECLARE
  v_aplicar boolean := false;
  v_email text := ''; -- Preencha se houver mais de uma conta Dayvson.
  v_user uuid; v_family uuid; n integer; r record; old_item record;
  hash text; item_id uuid; product_id_new uuid;
  v_lote constant text := 'lista-casa-semana-a-2026-10-31-v1';
BEGIN
  SELECT count(*) INTO n FROM users WHERE
    (v_email<>'' AND lower(email)=lower(v_email)) OR
    (v_email='' AND lower(btrim(name)) ~ '^dayvson([[:space:]]|$)');
  IF n<>1 THEN RAISE EXCEPTION 'Informe o e-mail exato de Dayvson em v_email.'; END IF;
  SELECT id INTO v_user FROM users WHERE
    (v_email<>'' AND lower(email)=lower(v_email)) OR
    (v_email='' AND lower(btrim(name)) ~ '^dayvson([[:space:]]|$)');
  SELECT count(*) INTO n FROM family_members WHERE user_id=v_user;
  IF n<>1 THEN RAISE EXCEPTION 'Família não identificada de forma única.'; END IF;
  SELECT family_id INTO v_family FROM family_members WHERE user_id=v_user;
  PERFORM pg_advisory_xact_lock(hashtextextended(v_family::text,0));
  n := 0;
  FOR r IN SELECT * FROM (VALUES
  (1, 'Carne moída — 600 g', 'Carne moída', '0.6', 'kg', ''),
  (2, 'Filé de tilápia — 600 g', 'Filé de tilápia', '0.6', 'kg', ''),
  (3, 'Filé de frango — 1,6 kg', 'Filé de frango', '1.6', 'kg', ''),
  (4, 'Costelinha suína — 900 g', 'Costelinha suína', '0.9', 'kg', ''),
  (5, 'Bifes bovinos — 600 g', 'Bifes bovinos', '0.6', 'kg', ''),
  (6, 'Ovos — 24 unidades', 'Ovos', '24', 'un', ''),
  (7, 'Arroz — 1,5 kg', 'Arroz', '1.5', 'kg', ''),
  (8, 'Feijão — 1 kg', 'Feijão', '1', 'kg', ''),
  (9, 'Macarrão — 500 g', 'Macarrão', '500', 'g', ''),
  (10, 'Pão francês — 12 unidades', 'Pão francês', '12', 'un', ''),
  (11, 'Pão de forma — 1 pacote', 'Pão de forma', '1', 'pacote', ''),
  (12, 'Pão de queijo — 700 g', 'Pão de queijo', '700', 'g', ''),
  (13, 'Goma de tapioca — 500 g', 'Goma de tapioca', '500', 'g', ''),
  (14, 'Farinha de trigo — 500 g', 'Farinha de trigo', '500', 'g', ''),
  (15, 'Aveia ou granola — 250 g', 'Aveia ou granola', '250', 'g', 'Escolha o produto antes de comprar'),
  (16, 'Batata palha — 300 g', 'Batata palha', '300', 'g', ''),
  (17, 'Batata inglesa — 2 kg', 'Batata inglesa', '2', 'kg', ''),
  (18, 'Mandioca — 700 g', 'Mandioca', '700', 'g', ''),
  (19, 'Cenoura — 1 kg', 'Cenoura', '1', 'kg', ''),
  (20, 'Abobrinha — 2 unidades', 'Abobrinha', '2', 'un', ''),
  (21, 'Brócolis — 1 maço', 'Brócolis', '1', 'maço', ''),
  (22, 'Couve — 2 maços', 'Couve', '2', 'maço', ''),
  (23, 'Alface — 1 pé', 'Alface', '1', 'pé', ''),
  (24, 'Tomate — 5 unidades', 'Tomate', '5', 'un', ''),
  (25, 'Pepino — 2 unidades', 'Pepino', '2', 'un', ''),
  (26, 'Cebola — 700 g', 'Cebola', '700', 'g', ''),
  (27, 'Alho — 2 cabeças', 'Alho', '2', 'cabeça', ''),
  (28, 'Cheiro-verde — 1 maço', 'Cheiro-verde', '1', 'maço', ''),
  (29, 'Banana — 14 unidades', 'Banana', '14', 'un', ''),
  (30, 'Mamão — 2 unidades', 'Mamão', '2', 'un', ''),
  (31, 'Maçã — 5 unidades', 'Maçã', '5', 'un', ''),
  (32, 'Uva — 500 g', 'Uva', '500', 'g', ''),
  (33, 'Morango — 1 bandeja', 'Morango', '1', 'bandeja', ''),
  (34, 'Tangerina — 4 unidades', 'Tangerina', '4', 'un', ''),
  (35, 'Laranja — 5 unidades', 'Laranja', '5', 'un', ''),
  (36, 'Limão para limonada — 12 unidades', 'Limão', '12', 'un', 'Para limonada'),
  (37, 'Leite — 5 litros', 'Leite', '5', 'l', ''),
  (38, 'Iogurte natural — 1,5 kg', 'Iogurte natural', '1.5', 'kg', ''),
  (39, 'Queijo muçarela — 600 g', 'Queijo muçarela', '600', 'g', ''),
  (40, 'Requeijão — 1 copo', 'Requeijão', '1', 'copo', ''),
  (41, 'Creme de leite — 4 caixas', 'Creme de leite', '4', 'caixa', ''),
  (42, 'Milho para fricassê — 1 lata', 'Milho', '1', 'lata', 'Para fricassê; enlatado'),
  (43, 'Champignon (opcional) — 1 vidro', 'Champignon', '1', 'vidro', 'Opcional'),
  (44, 'Molho de tomate — 2 sachês', 'Molho de tomate', '2', 'sachê', ''),
  (45, 'Fermento químico — 1 pote pequeno', 'Fermento químico', '1', 'pote', 'Pote pequeno'),
  (46, 'Manteiga ou margarina — 250 g', 'Manteiga ou margarina', '250', 'g', 'Escolha o produto antes de comprar'),
  (47, 'Óleo ou azeite — 1 unidade', 'Óleo ou azeite', '1', 'un', 'Escolha o produto antes de comprar'),
  (48, 'Sal e temperos — Conferir estoque', 'Sal e temperos', '1', 'un', 'Conferir estoque; escolha um produto por item antes de comprar')
  ) AS items(pos,old_name,new_name,qty,unit,notes) ORDER BY pos LOOP
    hash := md5(v_family::text || ':' || v_lote || ':' || r.pos::text);
    item_id := overlay(overlay(hash placing '4' from 13 for 1) placing '8' from 17 for 1)::uuid;
    SELECT * INTO old_item FROM shopping_items WHERE id=item_id AND family_id=v_family
      AND added_by=v_user AND completed=FALSE AND name=r.old_name AND quantity='1'
      AND unit='un' AND notes='' AND measurement_version=1 FOR UPDATE;
    IF NOT FOUND THEN CONTINUE; END IF;
    RAISE NOTICE '%: % -> % | % % | %',r.pos,r.old_name,r.new_name,r.qty,r.unit,r.notes;
    n := n+1;
    IF NOT v_aplicar THEN CONTINUE; END IF;
    INSERT INTO family_products(id,family_id,name,normalized_name,category_id)
    VALUES(gen_random_uuid(),v_family,r.new_name,lower(r.new_name),old_item.category_id)
    ON CONFLICT(family_id,normalized_name) DO NOTHING;
    SELECT id INTO product_id_new FROM family_products WHERE family_id=v_family AND normalized_name=lower(r.new_name);
    UPDATE shopping_items SET product_id=product_id_new,name=r.new_name,quantity=r.qty,
      unit=r.unit,notes=r.notes,measurement_version=2,updated_at=now()
    WHERE id=item_id AND family_id=v_family AND completed=FALSE;
    -- Remove apenas cadastros órfãos desta importação, nunca comprados.
    DELETE FROM family_products fp WHERE fp.id=old_item.product_id AND fp.family_id=v_family
      AND fp.name=r.old_name AND fp.last_purchased_at IS NULL AND fp.last_unit_price IS NULL
      AND fp.global_product_id IS NULL
      AND NOT EXISTS(SELECT 1 FROM shopping_items WHERE product_id=fp.id)
      AND NOT EXISTS(SELECT 1 FROM purchase_items WHERE product_id=fp.id);
  END LOOP;
  RAISE NOTICE 'Aplicar: %. Itens elegíveis: %. Demais itens preservados.',v_aplicar,n;
END;
$repair$;
