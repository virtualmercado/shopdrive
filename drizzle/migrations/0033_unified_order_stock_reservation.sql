-- Additive: simple products share order_stock_movements (variant_id NULL, product_id set).
ALTER TABLE public.order_stock_movements ADD COLUMN IF NOT EXISTS product_id uuid REFERENCES public.products(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_osm_product ON public.order_stock_movements(product_id);

-- Central reservation for any item (simple or variant). Conditional UPDATE = row lock, no oversell.
CREATE OR REPLACE FUNCTION public.reserve_order_item_stock(p_store_owner_id uuid, p_order_id uuid, p_product_id uuid, p_variant_id uuid, p_qty integer, OUT o_mode text, OUT o_sku text, OUT o_snapshot jsonb)
RETURNS record LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_name text; v_stock int;
BEGIN
  IF COALESCE(p_qty,0) <= 0 THEN RAISE EXCEPTION 'Quantidade inválida'; END IF;
  SELECT inventory_mode, name INTO o_mode, v_name FROM public.products WHERE id = p_product_id AND user_id = p_store_owner_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Produto inválido para esta loja: %', p_product_id; END IF;
  IF o_mode = 'variant' THEN
    SELECT r.o_sku, r.o_snapshot INTO o_sku, o_snapshot FROM public.reserve_order_item_variant(p_store_owner_id, p_order_id, p_product_id, p_variant_id, p_qty) r;
  ELSE
    UPDATE public.products SET stock = stock - p_qty
     WHERE id = p_product_id AND user_id = p_store_owner_id AND stock >= p_qty
    RETURNING stock INTO v_stock;
    IF NOT FOUND THEN
      SELECT stock INTO v_stock FROM public.products WHERE id = p_product_id;
      RAISE EXCEPTION 'Estoque insuficiente para "%": disponível %, solicitado %.', v_name, GREATEST(COALESCE(v_stock,0),0), p_qty USING ERRCODE = 'P0001';
    END IF;
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.reserve_order_item_stock(uuid,uuid,uuid,uuid,integer) FROM PUBLIC, anon, authenticated;

-- Restore (generalized, still once per item thanks to UNIQUE(order_item_id, kind)).
CREATE OR REPLACE FUNCTION public.restore_order_variant_stock(p_order_id uuid, p_reason text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE m record; v_ins uuid; v_count int := 0;
BEGIN
  FOR m IN SELECT r.* FROM public.order_stock_movements r
            WHERE r.order_id = p_order_id AND r.kind = 'reserve'
              AND NOT EXISTS (SELECT 1 FROM public.order_stock_movements x WHERE x.order_item_id = r.order_item_id AND x.kind = 'restore')
            FOR UPDATE
  LOOP
    v_ins := NULL;
    INSERT INTO public.order_stock_movements (store_id, order_id, order_item_id, variant_id, product_id, quantity, kind, reason)
    VALUES (m.store_id, m.order_id, m.order_item_id, m.variant_id, m.product_id, m.quantity, 'restore', p_reason)
    ON CONFLICT (order_item_id, kind) DO NOTHING RETURNING id INTO v_ins;
    IF v_ins IS NOT NULL THEN
      IF m.variant_id IS NOT NULL THEN
        UPDATE public.product_variants SET stock_quantity = stock_quantity + m.quantity WHERE id = m.variant_id AND store_id = m.store_id;
      ELSIF m.product_id IS NOT NULL THEN
        UPDATE public.products SET stock = stock + m.quantity WHERE id = m.product_id AND user_id = m.store_id AND inventory_mode <> 'variant';
      END IF;
      v_count := v_count + 1;
    END IF;
  END LOOP;
  RETURN v_count;
END $$;

-- Checkout: every item reserved inside the same transaction as the order.
CREATE OR REPLACE FUNCTION public.create_checkout_order(p_store_owner_id uuid, p_customer_id uuid DEFAULT NULL::uuid, p_customer_name text DEFAULT ''::text, p_customer_email text DEFAULT ''::text, p_customer_phone text DEFAULT ''::text, p_customer_address text DEFAULT NULL::text, p_delivery_method text DEFAULT NULL::text, p_payment_method text DEFAULT NULL::text, p_subtotal numeric DEFAULT 0, p_delivery_fee numeric DEFAULT 0, p_total_amount numeric DEFAULT 0, p_status text DEFAULT 'pending'::text, p_payment_status text DEFAULT 'pending'::text, p_notes text DEFAULT NULL::text, p_order_source text DEFAULT 'store'::text, p_checkout_origin text DEFAULT 'checkout_guest'::text, p_is_guest_order boolean DEFAULT true, p_items jsonb DEFAULT '[]'::jsonb)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_order public.orders%ROWTYPE;
  v_item jsonb; v_variations jsonb;
  v_auth_uid uuid := auth.uid();
  v_order_source text := COALESCE(NULLIF(trim(p_order_source), ''), 'store');
  v_payment_status text := COALESCE(NULLIF(trim(p_payment_status), ''), 'pending');
  v_checkout_origin text := COALESCE(NULLIF(trim(p_checkout_origin), ''), CASE WHEN COALESCE(p_is_guest_order, true) THEN 'checkout_guest' ELSE 'checkout_customer' END);
  v_mode text; v_variant_id uuid; v_sku text; v_snapshot jsonb; v_item_id uuid; v_qty integer; v_pid uuid;
BEGIN
  IF p_store_owner_id IS NULL OR NOT public.is_active_store(p_store_owner_id) THEN RAISE EXCEPTION 'Loja indisponível para receber pedidos'; END IF;
  IF trim(COALESCE(p_customer_name, '')) = '' OR length(trim(COALESCE(p_customer_name, ''))) < 3 THEN RAISE EXCEPTION 'Nome do cliente é obrigatório'; END IF;
  IF trim(COALESCE(p_customer_phone, '')) = '' OR length(regexp_replace(COALESCE(p_customer_phone, ''), '\D', '', 'g')) < 10 THEN RAISE EXCEPTION 'Telefone do cliente é obrigatório'; END IF;
  IF p_customer_id IS NOT NULL AND v_auth_uid IS DISTINCT FROM p_customer_id THEN RAISE EXCEPTION 'Cliente autenticado inválido para o pedido'; END IF;
  IF v_order_source NOT IN ('store', 'catalog', 'manual') THEN v_order_source := 'store'; END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN RAISE EXCEPTION 'Itens do pedido são obrigatórios'; END IF;
  IF COALESCE(p_subtotal, 0) < 0 OR COALESCE(p_delivery_fee, 0) < 0 OR COALESCE(p_total_amount, 0) < 0 THEN RAISE EXCEPTION 'Valores do pedido inválidos'; END IF;

  INSERT INTO public.orders (store_owner_id, customer_id, customer_name, customer_email, customer_phone, customer_address,
    delivery_method, payment_method, subtotal, delivery_fee, total_amount, status, payment_status, notes, order_source, checkout_origin, is_guest_order)
  VALUES (p_store_owner_id, p_customer_id, trim(p_customer_name), COALESCE(trim(p_customer_email), ''),
    trim(p_customer_phone), p_customer_address, p_delivery_method, p_payment_method,
    COALESCE(p_subtotal, 0), COALESCE(p_delivery_fee, 0), COALESCE(p_total_amount, 0),
    COALESCE(NULLIF(trim(p_status), ''), 'pending'), v_payment_status,
    NULLIF(trim(COALESCE(p_notes, '')), ''), v_order_source, v_checkout_origin, COALESCE(p_is_guest_order, p_customer_id IS NULL))
  RETURNING * INTO v_order;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_variations := NULL; v_sku := NULL; v_variant_id := NULL; v_mode := NULL; v_snapshot := NULL;
    IF v_item ? 'variations' AND v_item->'variations' IS NOT NULL AND jsonb_typeof(v_item->'variations') = 'object' AND v_item->'variations' <> '{}'::jsonb THEN
      v_variations := v_item->'variations';
    END IF;
    v_pid := (v_item->>'product_id')::uuid;
    PERFORM 1 FROM public.products p WHERE p.id = v_pid AND p.user_id = p_store_owner_id AND p.is_active = true;
    IF NOT FOUND THEN RAISE EXCEPTION 'Produto inválido para esta loja: %', v_item->>'product_id'; END IF;
    v_qty := (v_item->>'quantity')::integer;
    v_variant_id := NULLIF(v_item->>'variant_id', '')::uuid;
    SELECT r.o_mode, r.o_sku, r.o_snapshot INTO v_mode, v_sku, v_snapshot
      FROM public.reserve_order_item_stock(p_store_owner_id, v_order.id, v_pid, v_variant_id, v_qty) r;
    IF v_mode <> 'variant' THEN v_variant_id := NULL; END IF;
    v_variations := COALESCE(v_snapshot, v_variations);

    INSERT INTO public.order_items (order_id, product_id, product_name, product_price, quantity, subtotal, variations, variant_id, variant_sku)
    VALUES (v_order.id, v_pid, v_item->>'product_name', (v_item->>'product_price')::numeric, v_qty, (v_item->>'subtotal')::numeric, v_variations, v_variant_id, v_sku)
    RETURNING id INTO v_item_id;

    INSERT INTO public.order_stock_movements (store_id, order_id, order_item_id, variant_id, product_id, quantity, kind, reason)
    VALUES (p_store_owner_id, v_order.id, v_item_id, v_variant_id, v_pid, v_qty, 'reserve', 'order_created');
  END LOOP;
  RETURN to_jsonb(v_order);
END;
$function$;

CREATE OR REPLACE FUNCTION public.insert_order_items_secure(p_order_id uuid, p_items jsonb)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_order RECORD; v_item jsonb; v_variations jsonb; v_mode text;
  v_variant_id uuid; v_sku text; v_snapshot jsonb; v_item_id uuid; v_qty integer; v_pid uuid;
BEGIN
  IF p_order_id IS NULL THEN RAISE EXCEPTION 'order_id is required'; END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN RAISE EXCEPTION 'items must be a non-empty array'; END IF;
  SELECT id, store_owner_id, status, created_at INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found: %', p_order_id; END IF;
  IF EXISTS (SELECT 1 FROM public.order_items WHERE order_id = p_order_id) THEN RAISE EXCEPTION 'Order already has items'; END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_variations := NULL; v_sku := NULL; v_variant_id := NULL; v_mode := NULL; v_snapshot := NULL;
    IF v_item ? 'variations' AND v_item->'variations' IS NOT NULL AND jsonb_typeof(v_item->'variations') = 'object' AND v_item->'variations' <> '{}'::jsonb THEN
      v_variations := v_item->'variations';
    END IF;
    v_qty := (v_item->>'quantity')::integer;
    v_pid := (v_item->>'product_id')::uuid;
    v_variant_id := NULLIF(v_item->>'variant_id', '')::uuid;
    SELECT r.o_mode, r.o_sku, r.o_snapshot INTO v_mode, v_sku, v_snapshot
      FROM public.reserve_order_item_stock(v_order.store_owner_id, p_order_id, v_pid, v_variant_id, v_qty) r;
    IF v_mode <> 'variant' THEN v_variant_id := NULL; END IF;
    v_variations := COALESCE(v_snapshot, v_variations);
    INSERT INTO public.order_items (order_id, product_id, product_name, product_price, quantity, subtotal, variations, variant_id, variant_sku)
    VALUES (p_order_id, v_pid, v_item->>'product_name', (v_item->>'product_price')::numeric, v_qty, (v_item->>'subtotal')::numeric, v_variations, v_variant_id, v_sku)
    RETURNING id INTO v_item_id;
    INSERT INTO public.order_stock_movements (store_id, order_id, order_item_id, variant_id, product_id, quantity, kind, reason)
    VALUES (v_order.store_owner_id, p_order_id, v_item_id, v_variant_id, v_pid, v_qty, 'reserve', 'order_created');
  END LOOP;
END;
$function$;

-- Block reopening a cancelled order whose stock was already returned (no free stock).
CREATE OR REPLACE FUNCTION public.trg_orders_restore_variant_stock()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_bad_status text[] := ARRAY['cancelled','canceled','cancelado','expired','expirado','refused','rejected','recusado','invalid','invalidated','invalido'];
  v_bad_pay text[] := ARRAY['cancelled','canceled','expired','refused','rejected','refunded','chargeback','invalid'];
BEGIN
  IF (lower(COALESCE(NEW.status,'')) = ANY(v_bad_status) AND lower(COALESCE(OLD.status,'')) IS DISTINCT FROM lower(COALESCE(NEW.status,'')))
     OR (lower(COALESCE(NEW.payment_status,'')) = ANY(v_bad_pay) AND lower(COALESCE(OLD.payment_status,'')) IS DISTINCT FROM lower(COALESCE(NEW.payment_status,''))) THEN
    PERFORM public.restore_order_variant_stock(NEW.id, 'status:' || COALESCE(NEW.status,'') || '/' || COALESCE(NEW.payment_status,''));
  ELSIF lower(COALESCE(OLD.status,'')) = ANY(v_bad_status)
     AND NOT (lower(COALESCE(NEW.status,'')) = ANY(v_bad_status))
     AND EXISTS (SELECT 1 FROM public.order_stock_movements WHERE order_id = NEW.id AND kind = 'restore') THEN
    RAISE EXCEPTION 'Este pedido foi cancelado e o estoque já foi devolvido. Crie um novo pedido para vender novamente.';
  END IF;
  RETURN NEW;
END $function$;

-- Deleting items/orders returns any still-reserved stock exactly once.
CREATE OR REPLACE FUNCTION public.trg_order_items_restore_on_delete()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE m record;
BEGIN
  SELECT * INTO m FROM public.order_stock_movements r
   WHERE r.order_item_id = OLD.id AND r.kind = 'reserve'
     AND NOT EXISTS (SELECT 1 FROM public.order_stock_movements x WHERE x.order_item_id = OLD.id AND x.kind = 'restore')
   FOR UPDATE;
  IF FOUND THEN
    -- Mark restored first so nothing else can restore it again in this transaction.
    INSERT INTO public.order_stock_movements (store_id, order_id, order_item_id, variant_id, product_id, quantity, kind, reason)
    VALUES (m.store_id, m.order_id, m.order_item_id, m.variant_id, m.product_id, m.quantity, 'restore', 'item_deleted')
    ON CONFLICT (order_item_id, kind) DO NOTHING;
    IF FOUND THEN
      IF m.variant_id IS NOT NULL THEN
        UPDATE public.product_variants SET stock_quantity = stock_quantity + m.quantity WHERE id = m.variant_id AND store_id = m.store_id;
      ELSIF m.product_id IS NOT NULL THEN
        UPDATE public.products SET stock = stock + m.quantity WHERE id = m.product_id AND user_id = m.store_id AND inventory_mode <> 'variant';
      END IF;
    END IF;
  END IF;
  RETURN OLD;
END $$;
DROP TRIGGER IF EXISTS order_items_restore_on_delete ON public.order_items;
CREATE TRIGGER order_items_restore_on_delete BEFORE DELETE ON public.order_items FOR EACH ROW EXECUTE FUNCTION public.trg_order_items_restore_on_delete();

CREATE OR REPLACE FUNCTION public.trg_orders_restore_on_delete()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$ BEGIN PERFORM public.restore_order_variant_stock(OLD.id, 'order_deleted'); RETURN OLD; END $$;
DROP TRIGGER IF EXISTS orders_restore_on_delete ON public.orders;
CREATE TRIGGER orders_restore_on_delete BEFORE DELETE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.trg_orders_restore_on_delete();

-- Quote -> order, fully server-side and atomic, through the central reservation.
CREATE OR REPLACE FUNCTION public.convert_quote_to_order(p_quote_id uuid, p_payment_method text, p_use_current_prices boolean DEFAULT false)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE q public.quotes%ROWTYPE; v_order public.orders%ROWTYPE; v_items jsonb := '[]'::jsonb; it record; v_price numeric; v_sub numeric := 0;
BEGIN
  SELECT * INTO q FROM public.quotes WHERE id = p_quote_id FOR UPDATE;
  IF NOT FOUND OR q.store_owner_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Orçamento não encontrado'; END IF;
  IF q.converted_order_id IS NOT NULL OR q.status = 'converted' THEN RAISE EXCEPTION 'Este orçamento já foi convertido em pedido.'; END IF;
  FOR it IN SELECT qi.*, p.price, p.promotional_price FROM public.quote_items qi LEFT JOIN public.products p ON p.id = qi.product_id WHERE qi.quote_id = p_quote_id LOOP
    IF it.product_id IS NULL THEN RAISE EXCEPTION 'Item livre "%" não pode ser convertido em pedido.', it.name; END IF;
    v_price := CASE WHEN p_use_current_prices THEN COALESCE(NULLIF(it.promotional_price,0), it.price, it.unit_price) ELSE it.unit_price END;
    v_sub := v_sub + v_price * it.quantity;
    v_items := v_items || jsonb_build_object('product_id', it.product_id, 'product_name', it.name, 'product_price', v_price, 'quantity', it.quantity, 'subtotal', v_price * it.quantity);
  END LOOP;
  IF jsonb_array_length(v_items) = 0 THEN RAISE EXCEPTION 'Orçamento sem itens'; END IF;
  IF NOT p_use_current_prices THEN v_sub := q.subtotal; END IF;
  INSERT INTO public.orders (store_owner_id, customer_id, customer_name, customer_email, customer_phone, customer_address, payment_method,
    delivery_fee, subtotal, total_amount, notes, status, order_source)
  VALUES (q.store_owner_id, q.customer_id, q.customer_name, COALESCE(q.customer_email,''), q.customer_phone, q.delivery_address, p_payment_method,
    COALESCE(q.shipping_fee,0), v_sub, CASE WHEN p_use_current_prices THEN v_sub - COALESCE(q.discount,0) + COALESCE(q.shipping_fee,0) ELSE q.total END,
    q.notes, 'pending', 'manual')
  RETURNING * INTO v_order;
  PERFORM public.insert_order_items_secure(v_order.id, v_items);
  UPDATE public.quotes SET status = 'converted', converted_order_id = v_order.id, converted_at = now() WHERE id = p_quote_id;
  RETURN to_jsonb(v_order);
END $$;
REVOKE ALL ON FUNCTION public.convert_quote_to_order(uuid,text,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.convert_quote_to_order(uuid,text,boolean) TO authenticated;