-- Presentation-only ordering for orders created after this migration.
-- Legacy orders (order_format_version IS NULL) are never updated, renumbered or backfilled.
-- Rollback (safe, presentation only):
--   DROP TRIGGER IF EXISTS zz_order_item_position ON public.order_items;
--   DROP TRIGGER IF EXISTS orders_format_version_insert ON public.orders;
--   DROP TRIGGER IF EXISTS orders_format_version_update ON public.orders;
--   DROP FUNCTION IF EXISTS public.trg_order_item_position(); DROP FUNCTION IF EXISTS public.trg_orders_format_version();
--   restore insert_order_items_secure / replace_manual_order_items from 0034 (item_position keys are then ignored).
--   Columns may stay (nullable, unused) or be dropped afterwards.

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS order_format_version smallint;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS last_item_position integer;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS item_position integer;

COMMENT ON COLUMN public.orders.order_format_version IS 'NULL = legacy order (original behaviour). 2 = items carry a deterministic item_position (presentation ordering only).';
COMMENT ON COLUMN public.orders.last_item_position IS 'Highest item_position ever assigned in this order (format 2). Positions are never reused.';
COMMENT ON COLUMN public.order_items.item_position IS 'Original insertion position inside the order (format 2 only). Presentation only; never affects price, quantity or stock.';

ALTER TABLE public.order_items ADD CONSTRAINT order_items_item_position_positive CHECK (item_position IS NULL OR item_position >= 1);
CREATE UNIQUE INDEX IF NOT EXISTS order_items_order_position_uidx ON public.order_items (order_id, item_position) WHERE item_position IS NOT NULL;

-- Every new order, from every creation path, is format 2. Version is immutable afterwards.
CREATE OR REPLACE FUNCTION public.trg_orders_format_version()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.order_format_version := 2;
    NEW.last_item_position := 0;
  ELSE
    NEW.order_format_version := OLD.order_format_version;
    IF OLD.order_format_version IS NULL THEN
      NEW.last_item_position := OLD.last_item_position;
    ELSE
      NEW.last_item_position := GREATEST(COALESCE(OLD.last_item_position, 0), COALESCE(NEW.last_item_position, 0));
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER orders_format_version_insert BEFORE INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.trg_orders_format_version();
CREATE TRIGGER orders_format_version_update BEFORE UPDATE OF order_format_version, last_item_position ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.trg_orders_format_version();

-- Single source for item positions (runs after validate_order_item_trigger).
CREATE OR REPLACE FUNCTION public.trg_order_item_position()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_version smallint; v_last integer;
BEGIN
  SELECT o.order_format_version, o.last_item_position INTO v_version, v_last
    FROM public.orders o WHERE o.id = NEW.order_id FOR UPDATE;
  IF v_version IS NULL OR v_version < 2 THEN
    NEW.item_position := NULL; -- legacy: never positioned
    RETURN NEW;
  END IF;
  -- An existing position is only kept when it was already assigned in this order and is free now
  -- (an edit re-inserting the same line). Anything else gets the next final position.
  IF NEW.item_position IS NOT NULL AND NEW.item_position BETWEEN 1 AND COALESCE(v_last, 0)
     AND NOT EXISTS (SELECT 1 FROM public.order_items i WHERE i.order_id = NEW.order_id AND i.item_position = NEW.item_position) THEN
    RETURN NEW;
  END IF;
  UPDATE public.orders SET last_item_position = COALESCE(last_item_position, 0) + 1
   WHERE id = NEW.order_id RETURNING last_item_position INTO NEW.item_position;
  RETURN NEW;
END $$;

CREATE TRIGGER zz_order_item_position BEFORE INSERT ON public.order_items
  FOR EACH ROW EXECUTE FUNCTION public.trg_order_item_position();

REVOKE ALL ON FUNCTION public.trg_orders_format_version() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_order_item_position() FROM PUBLIC, anon, authenticated;

-- Same body as before; only forwards an optional item_position (validated by the trigger).
CREATE OR REPLACE FUNCTION public.insert_order_items_secure(p_order_id uuid, p_items jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_order RECORD; v_item jsonb; v_variations jsonb; v_mode text;
  v_variant_id uuid; v_sku text; v_snapshot jsonb; v_item_id uuid; v_qty integer; v_pid uuid; v_pos integer;
BEGIN
  IF p_order_id IS NULL THEN RAISE EXCEPTION 'order_id is required'; END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN RAISE EXCEPTION 'items must be a non-empty array'; END IF;
  SELECT id, store_owner_id, status, created_at INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found: %', p_order_id; END IF;
  IF EXISTS (SELECT 1 FROM public.order_items WHERE order_id = p_order_id) THEN RAISE EXCEPTION 'Order already has items'; END IF;

  FOR v_item IN SELECT e FROM jsonb_array_elements(p_items) WITH ORDINALITY AS t(e, ord) ORDER BY ord LOOP
    v_variations := NULL; v_sku := NULL; v_variant_id := NULL; v_mode := NULL; v_snapshot := NULL; v_pos := NULL;
    IF v_item ? 'variations' AND v_item->'variations' IS NOT NULL AND jsonb_typeof(v_item->'variations') = 'object' AND v_item->'variations' <> '{}'::jsonb THEN
      v_variations := v_item->'variations';
    END IF;
    IF jsonb_typeof(v_item->'item_position') = 'number' AND (v_item->>'item_position') ~ '^[0-9]{1,9}$' THEN
      v_pos := (v_item->>'item_position')::integer;
    END IF;
    v_qty := (v_item->>'quantity')::integer;
    v_pid := NULLIF(v_item->>'product_id', '')::uuid;
    IF v_pid IS NULL THEN
      -- Free item: no stock movement (validate_order_item restricts it to manual orders).
      INSERT INTO public.order_items (order_id, product_id, product_name, product_price, quantity, subtotal, variations, item_position)
      VALUES (p_order_id, NULL, v_item->>'product_name', (v_item->>'product_price')::numeric, v_qty, (v_item->>'subtotal')::numeric, v_variations, v_pos);
      CONTINUE;
    END IF;
    v_variant_id := NULLIF(v_item->>'variant_id', '')::uuid;
    SELECT r.o_mode, r.o_sku, r.o_snapshot INTO v_mode, v_sku, v_snapshot
      FROM public.reserve_order_item_stock(v_order.store_owner_id, p_order_id, v_pid, v_variant_id, v_qty) r;
    IF v_mode <> 'variant' THEN v_variant_id := NULL; END IF;
    v_variations := COALESCE(v_snapshot, v_variations);
    INSERT INTO public.order_items (order_id, product_id, product_name, product_price, quantity, subtotal, variations, variant_id, variant_sku, item_position)
    VALUES (p_order_id, v_pid, v_item->>'product_name', (v_item->>'product_price')::numeric, v_qty, (v_item->>'subtotal')::numeric, v_variations, v_variant_id, v_sku, v_pos)
    RETURNING id INTO v_item_id;
    INSERT INTO public.order_stock_movements (store_id, order_id, order_item_id, variant_id, product_id, quantity, kind, reason)
    VALUES (v_order.store_owner_id, p_order_id, v_item_id, v_variant_id, v_pid, v_qty, 'reserve', 'order_created');
  END LOOP;
END;
$function$;

-- Same behaviour as before; for format-2 orders keeps only positions this order already holds
-- (first occurrence wins), so edits never reuse removed positions or invent new ones.
CREATE OR REPLACE FUNCTION public.replace_manual_order_items(p_order_id uuid, p_items jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_owner uuid; v_version smallint; v_items jsonb := p_items;
BEGIN
  SELECT store_owner_id, order_format_version INTO v_owner, v_version FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF v_owner IS NULL OR v_owner IS DISTINCT FROM public.merchant_request_store_id() THEN RAISE EXCEPTION 'Pedido não encontrado para esta loja'; END IF;
  IF public.is_legacy_stock_order(p_order_id) THEN
    IF public.order_items_unchanged(p_order_id, p_items) THEN RETURN; END IF;
    RAISE EXCEPTION 'Pedido anterior ao novo controle de estoque: os produtos e quantidades não podem ser alterados. Você ainda pode editar cliente, pagamento e observações sem mudar os itens.';
  END IF;
  IF jsonb_typeof(p_items) = 'array' THEN
    SELECT COALESCE(jsonb_agg(CASE WHEN k.keep THEN k.e ELSE k.e - 'item_position' END ORDER BY k.ord), '[]'::jsonb)
      INTO v_items
      FROM (
        SELECT s.e, s.ord,
               (v_version >= 2 AND s.pos IS NOT NULL
                AND EXISTS (SELECT 1 FROM public.order_items i WHERE i.order_id = p_order_id AND i.item_position = s.pos)
                AND row_number() OVER (PARTITION BY s.pos ORDER BY s.ord) = 1) AS keep
          FROM (
            SELECT t.e, t.ord,
                   CASE WHEN jsonb_typeof(t.e->'item_position') = 'number' AND (t.e->>'item_position') ~ '^[0-9]{1,9}$'
                        THEN (t.e->>'item_position')::integer END AS pos
              FROM jsonb_array_elements(p_items) WITH ORDINALITY AS t(e, ord)
          ) s
      ) k;
  END IF;
  PERFORM public.restore_order_variant_stock(p_order_id, 'manual_edit');
  DELETE FROM public.order_items WHERE order_id = p_order_id;
  PERFORM public.insert_order_items_secure(p_order_id, v_items);
END $function$;