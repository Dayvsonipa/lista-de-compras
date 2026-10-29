-- Execute antes de publicar o código. Não infere unidades dos preços antigos.
BEGIN;
ALTER TABLE shopping_items ADD COLUMN IF NOT EXISTS unit text NOT NULL DEFAULT 'un';
ALTER TABLE shopping_items ADD COLUMN IF NOT EXISTS notes text NOT NULL DEFAULT '';
ALTER TABLE shopping_items ADD COLUMN IF NOT EXISTS price_basis text;
ALTER TABLE shopping_items ADD COLUMN IF NOT EXISTS total_price_override numeric(14,2);
ALTER TABLE shopping_items ADD COLUMN IF NOT EXISTS measurement_version integer NOT NULL DEFAULT 1;
ALTER TABLE purchase_items ALTER COLUMN quantity TYPE numeric(12,3) USING quantity::numeric;
ALTER TABLE purchase_items ADD COLUMN IF NOT EXISTS unit text NOT NULL DEFAULT 'un';
ALTER TABLE purchase_items ADD COLUMN IF NOT EXISTS notes text NOT NULL DEFAULT '';
ALTER TABLE purchase_items ADD COLUMN IF NOT EXISTS price_basis text;
ALTER TABLE family_products ADD COLUMN IF NOT EXISTS last_price_basis text;
ALTER TABLE shopping_items ALTER COLUMN unit_price TYPE numeric(18,6);
ALTER TABLE shopping_items ALTER COLUMN comparison_unit_price TYPE numeric(18,6);
ALTER TABLE purchase_items ALTER COLUMN unit_price TYPE numeric(18,6);
ALTER TABLE family_products ALTER COLUMN last_unit_price TYPE numeric(18,6);
CREATE INDEX IF NOT EXISTS idx_purchase_items_price_basis ON purchase_items(family_id,product_id,price_basis,purchased_at DESC);

CREATE OR REPLACE FUNCTION archive_measured_purchase(p_family uuid, p_user uuid, p_session uuid, p_ids uuid[])
RETURNS integer LANGUAGE plpgsql AS $function$
DECLARE r record; n integer := 0; q numeric; amount numeric; total numeric;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM family_members WHERE family_id=p_family AND user_id=p_user) THEN
    RAISE EXCEPTION 'Usuário fora da família';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_family::text, 0));
  IF EXISTS (SELECT 1 FROM purchase_sessions WHERE id=p_session AND family_id<>p_family) THEN
    RAISE EXCEPTION 'Sessão inválida';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM shopping_items WHERE family_id=p_family AND completed AND id=ANY(p_ids)) THEN RETURN 0; END IF;
  INSERT INTO purchase_sessions(id,family_id,purchased_by,purchased_at,total_amount)
  VALUES(p_session,p_family,p_user,now(),0) ON CONFLICT(id) DO NOTHING;
  FOR r IN SELECT si.*, sc.name AS category_name FROM shopping_items si
    LEFT JOIN shopping_categories sc ON sc.id=si.category_id
    WHERE si.family_id=p_family AND si.completed AND si.id=ANY(p_ids)
    ORDER BY si.completed_at ASC NULLS LAST,si.id FOR UPDATE OF si
  LOOP
    IF r.quantity !~ '^\d+(\.\d{1,3})?$' OR r.quantity::numeric<=0 THEN RAISE EXCEPTION 'Quantidade inválida: %',r.name; END IF;
    q := r.quantity::numeric;
    amount := CASE WHEN r.price_basis IS NOT NULL AND r.unit IN ('g','ml') THEN q/1000 ELSE q END;
    total := coalesce(r.total_price_override,round(r.unit_price*amount,2));
    IF EXISTS(SELECT 1 FROM purchase_items WHERE id=r.id AND (family_id<>p_family OR session_id<>p_session)) THEN
      RAISE EXCEPTION 'Item já arquivado em outra sessão';
    END IF;
    INSERT INTO purchase_items(id,session_id,family_id,product_id,product_name,category_name,
      quantity,unit,notes,price_basis,unit_price,total_price,purchased_by,purchased_at)
    VALUES(r.id,p_session,p_family,r.product_id,r.name,r.category_name,q,r.unit,r.notes,r.price_basis,
      r.unit_price,total,coalesce(r.completed_by,p_user),coalesce(r.completed_at,now())) ON CONFLICT(id) DO NOTHING;
    IF r.product_id IS NOT NULL AND r.unit_price IS NOT NULL THEN
      UPDATE family_products SET last_unit_price=r.unit_price,last_price_basis=r.price_basis,
        last_purchased_at=coalesce(r.completed_at,now()),updated_at=now()
      WHERE id=r.product_id AND family_id=p_family
        AND (last_purchased_at IS NULL OR last_purchased_at<=coalesce(r.completed_at,now()));
    END IF;
    DELETE FROM shopping_items WHERE id=r.id AND family_id=p_family;
    n := n+1;
  END LOOP;
  UPDATE purchase_sessions SET total_amount=coalesce((SELECT sum(total_price) FROM purchase_items WHERE session_id=p_session AND family_id=p_family),0)
  WHERE id=p_session AND family_id=p_family;
  RETURN n;
END;
$function$;
COMMIT;
