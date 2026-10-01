-- Free (non-catalog) items from quotes: product_id may be NULL, only on manual orders, never move stock.
ALTER TABLE public.order_items ALTER COLUMN product_id DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.validate_order_item()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_product RECORD; v_order RECORD;
BEGIN
  SELECT id, status, order_source INTO v_order FROM public.orders WHERE id = NEW.order_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found: %', NEW.order_id; END IF;
  IF v_order.status NOT IN ('pending', 'processing') THEN
    RAISE EXCEPTION 'Cannot add items to order with status: %', v_order.status;
  END IF;
  IF NEW.quantity IS NULL OR NEW.quantity < 1 THEN RAISE EXCEPTION 'Quantity must be at least 1'; END IF;

  IF NEW.product_id IS NULL THEN
    IF v_order.order_source IS DISTINCT FROM 'manual' THEN
      RAISE EXCEPTION 'Item sem produto só é permitido em pedido manual';
    END IF;
    IF NEW.product_price IS NULL OR NEW.product_price < 0 THEN RAISE EXCEPTION 'Preço inválido'; END IF;
    NEW.variant_id := NULL;
    NEW.subtotal := NEW.product_price * NEW.quantity;
    RETURN NEW;
  END IF;

  SELECT id, price, promotional_price, is_active INTO v_product FROM public.products WHERE id = NEW.product_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Product not found: %', NEW.product_id; END IF;
  IF NOT v_product.is_active THEN RAISE EXCEPTION 'Product is not active: %', NEW.product_id; END IF;
  IF NEW.product_price != v_product.price
     AND (v_product.promotional_price IS NULL OR NEW.product_price != v_product.promotional_price) THEN
    RAISE EXCEPTION 'Price mismatch for product %: submitted % but actual is % (promo: %)',
      NEW.product_id, NEW.product_price, v_product.price, v_product.promotional_price;
  END IF;
  IF NEW.subtotal != NEW.product_price * NEW.quantity THEN NEW.subtotal := NEW.product_price * NEW.quantity; END IF;
  RETURN NEW;
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
    v_pid := NULLIF(v_item->>'product_id', '')::uuid;
    IF v_pid IS NULL THEN
      -- Free item: no stock movement (validate_order_item restricts it to manual orders).
      INSERT INTO public.order_items (order_id, product_id, product_name, product_price, quantity, subtotal, variations)
      VALUES (p_order_id, NULL, v_item->>'product_name', (v_item->>'product_price')::numeric, v_qty, (v_item->>'subtotal')::numeric, v_variations);
      CONTINUE;
    END IF;
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

-- Legacy = has catalog items but none ever reserved (created before server-side reservation).
CREATE OR REPLACE FUNCTION public.is_legacy_stock_order(p_order_id uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT EXISTS (SELECT 1 FROM public.order_items WHERE order_id = p_order_id AND product_id IS NOT NULL)
     AND NOT EXISTS (SELECT 1 FROM public.order_stock_movements WHERE order_id = p_order_id);
$$;

-- True when the submitted items equal the current ones (product, variant, qty, price).
CREATE OR REPLACE FUNCTION public.order_items_unchanged(p_order_id uuid, p_items jsonb)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  WITH cur AS (
    SELECT product_id::text pid, COALESCE(variant_id::text,'') vid, quantity q, product_price::numeric pr, count(*) n
      FROM public.order_items WHERE order_id = p_order_id GROUP BY 1,2,3,4),
  nw AS (
    SELECT NULLIF(e->>'product_id','') pid, COALESCE(NULLIF(e->>'variant_id',''),'') vid, (e->>'quantity')::int q, (e->>'product_price')::numeric pr, count(*) n
      FROM jsonb_array_elements(p_items) e GROUP BY 1,2,3,4)
  SELECT NOT EXISTS ((SELECT * FROM cur EXCEPT SELECT * FROM nw) UNION ALL (SELECT * FROM nw EXCEPT SELECT * FROM cur));
$$;

CREATE OR REPLACE FUNCTION public.replace_manual_order_items(p_order_id uuid, p_items jsonb)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_owner uuid;
BEGIN
  SELECT store_owner_id INTO v_owner FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF v_owner IS NULL OR v_owner IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Pedido não encontrado para esta loja'; END IF;
  IF public.is_legacy_stock_order(p_order_id) THEN
    IF public.order_items_unchanged(p_order_id, p_items) THEN RETURN; END IF;
    RAISE EXCEPTION 'Pedido anterior ao novo controle de estoque: os produtos e quantidades não podem ser alterados. Você ainda pode editar cliente, pagamento e observações sem mudar os itens.';
  END IF;
  PERFORM public.restore_order_variant_stock(p_order_id, 'manual_edit');
  DELETE FROM public.order_items WHERE order_id = p_order_id;
  PERFORM public.insert_order_items_secure(p_order_id, p_items);
END $$;

-- Whole manual edit (header + items + restore + reserve) in one transaction.
CREATE OR REPLACE FUNCTION public.update_manual_order(p_order_id uuid, p_order jsonb, p_items jsonb)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_owner uuid;
BEGIN
  SELECT store_owner_id INTO v_owner FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF v_owner IS NULL OR v_owner IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Pedido não encontrado para esta loja'; END IF;
  UPDATE public.orders SET
    customer_id = NULLIF(p_order->>'customer_id','')::uuid,
    customer_name = COALESCE(p_order->>'customer_name', customer_name),
    customer_email = COALESCE(p_order->>'customer_email', ''),
    customer_phone = p_order->>'customer_phone',
    customer_address = p_order->>'customer_address',
    payment_method = p_order->>'payment_method',
    delivery_method = NULLIF(p_order->>'delivery_method',''),
    delivery_fee = COALESCE((p_order->>'delivery_fee')::numeric, 0),
    subtotal = COALESCE((p_order->>'subtotal')::numeric, 0),
    total_amount = COALESCE((p_order->>'total_amount')::numeric, 0),
    notes = p_order->>'notes'
  WHERE id = p_order_id;
  PERFORM public.replace_manual_order_items(p_order_id, p_items);
END $$;
REVOKE ALL ON FUNCTION public.update_manual_order(uuid,jsonb,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_manual_order(uuid,jsonb,jsonb) TO authenticated;
REVOKE ALL ON FUNCTION public.is_legacy_stock_order(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.order_items_unchanged(uuid,jsonb) FROM PUBLIC, anon;

-- Quote conversion: free items allowed (no stock), catalog items reserved; all-or-nothing.
CREATE OR REPLACE FUNCTION public.convert_quote_to_order(p_quote_id uuid, p_payment_method text, p_use_current_prices boolean DEFAULT false)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE q public.quotes%ROWTYPE; v_order public.orders%ROWTYPE; v_items jsonb := '[]'::jsonb; it record; v_price numeric; v_sub numeric := 0;
BEGIN
  SELECT * INTO q FROM public.quotes WHERE id = p_quote_id FOR UPDATE;
  IF NOT FOUND OR q.store_owner_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Orçamento não encontrado'; END IF;
  IF q.converted_order_id IS NOT NULL OR q.status = 'converted' THEN RAISE EXCEPTION 'Este orçamento já foi convertido em pedido.'; END IF;
  FOR it IN SELECT qi.*, p.price, p.promotional_price FROM public.quote_items qi LEFT JOIN public.products p ON p.id = qi.product_id WHERE qi.quote_id = p_quote_id LOOP
    v_price := CASE WHEN p_use_current_prices AND it.product_id IS NOT NULL THEN COALESCE(NULLIF(it.promotional_price,0), it.price, it.unit_price) ELSE it.unit_price END;
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