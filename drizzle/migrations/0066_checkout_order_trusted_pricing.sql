CREATE OR REPLACE FUNCTION public.create_checkout_order(p_store_owner_id uuid, p_customer_id uuid DEFAULT NULL::uuid, p_customer_name text DEFAULT ''::text, p_customer_email text DEFAULT ''::text, p_customer_phone text DEFAULT ''::text, p_customer_address text DEFAULT NULL::text, p_delivery_method text DEFAULT NULL::text, p_payment_method text DEFAULT NULL::text, p_subtotal numeric DEFAULT 0, p_delivery_fee numeric DEFAULT 0, p_total_amount numeric DEFAULT 0, p_status text DEFAULT 'pending'::text, p_payment_status text DEFAULT 'pending'::text, p_notes text DEFAULT NULL::text, p_order_source text DEFAULT 'store'::text, p_checkout_origin text DEFAULT 'checkout_guest'::text, p_is_guest_order boolean DEFAULT true, p_items jsonb DEFAULT '[]'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_order public.orders%ROWTYPE;
  v_item jsonb; v_variations jsonb;
  v_auth_uid uuid := auth.uid();
  v_order_source text := COALESCE(NULLIF(trim(p_order_source), ''), 'store');
  v_payment_status text := COALESCE(NULLIF(trim(p_payment_status), ''), 'pending');
  v_checkout_origin text := COALESCE(NULLIF(trim(p_checkout_origin), ''), CASE WHEN COALESCE(p_is_guest_order, true) THEN 'checkout_guest' ELSE 'checkout_customer' END);
  v_mode text; v_variant_id uuid; v_sku text; v_snapshot jsonb; v_item_id uuid; v_qty integer; v_pid uuid;
  v_unit numeric; v_pname text; v_sub numeric := 0; v_fee numeric := round(COALESCE(p_delivery_fee, 0), 2);
  v_pix_pct numeric := 0; v_total numeric; v_disc numeric; v_cpn record; v_matched boolean := false;
BEGIN
  IF p_store_owner_id IS NULL OR NOT public.is_active_store(p_store_owner_id) THEN RAISE EXCEPTION 'Loja indisponível para receber pedidos'; END IF;
  IF trim(COALESCE(p_customer_name, '')) = '' OR length(trim(COALESCE(p_customer_name, ''))) < 3 THEN RAISE EXCEPTION 'Nome do cliente é obrigatório'; END IF;
  IF trim(COALESCE(p_customer_phone, '')) = '' OR length(regexp_replace(COALESCE(p_customer_phone, ''), '\D', '', 'g')) < 10 THEN RAISE EXCEPTION 'Telefone do cliente é obrigatório'; END IF;
  IF p_customer_id IS NOT NULL AND v_auth_uid IS DISTINCT FROM p_customer_id THEN RAISE EXCEPTION 'Cliente autenticado inválido para o pedido'; END IF;
  IF v_order_source NOT IN ('store', 'catalog', 'manual') THEN v_order_source := 'store'; END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN RAISE EXCEPTION 'Itens do pedido são obrigatórios'; END IF;
  IF COALESCE(p_subtotal, 0) < 0 OR COALESCE(p_delivery_fee, 0) < 0 OR COALESCE(p_total_amount, 0) < 0 THEN RAISE EXCEPTION 'Valores do pedido inválidos'; END IF;

  -- Trusted pricing: unit prices come from product records, never from the caller.
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    SELECT CASE WHEN p.promotional_price IS NOT NULL AND p.promotional_price > 0 THEN p.promotional_price ELSE p.price END
      INTO v_unit FROM public.products p
     WHERE p.id = (v_item->>'product_id')::uuid AND p.user_id = p_store_owner_id AND p.is_active = true;
    IF NOT FOUND THEN RAISE EXCEPTION 'Produto inválido para esta loja: %', v_item->>'product_id'; END IF;
    IF COALESCE((v_item->>'quantity')::integer, 0) <= 0 THEN RAISE EXCEPTION 'Quantidade inválida'; END IF;
    v_sub := v_sub + v_unit * (v_item->>'quantity')::integer;
  END LOOP;
  v_sub := round(v_sub, 2);

  IF p_payment_method = 'pix' THEN
    SELECT COALESCE(ps.pix_discount_percent, 0) INTO v_pix_pct FROM public.payment_settings ps WHERE ps.user_id = p_store_owner_id;
    v_pix_pct := GREATEST(LEAST(COALESCE(v_pix_pct, 0), 100), 0);
  END IF;

  v_total := round(GREATEST(0, v_sub - (v_sub * v_pix_pct / 100) + v_fee), 2);
  IF abs(v_total - COALESCE(p_total_amount, 0)) <= 0.05 THEN
    v_matched := true;
  ELSE
    -- Only a real, active coupon of this store may explain a lower total.
    FOR v_cpn IN SELECT c.discount_type, c.discount_value, c.min_order_value FROM public.coupons c
                  WHERE c.user_id = p_store_owner_id AND c.is_active = true LOOP
      CONTINUE WHEN v_cpn.min_order_value IS NOT NULL AND v_sub < v_cpn.min_order_value;
      v_disc := CASE WHEN v_cpn.discount_type = 'percentage'
                     THEN LEAST(v_sub, v_sub * GREATEST(v_cpn.discount_value, 0) / 100)
                     ELSE LEAST(GREATEST(v_cpn.discount_value, 0), v_sub) END;
      v_total := round(GREATEST(0, v_sub - v_disc - ((v_sub - v_disc) * v_pix_pct / 100) + v_fee), 2);
      IF abs(v_total - COALESCE(p_total_amount, 0)) <= 0.05 THEN v_matched := true; EXIT; END IF;
    END LOOP;
  END IF;
  IF NOT v_matched THEN
    RAISE EXCEPTION 'Os valores do carrinho foram atualizados. Atualize o carrinho e tente novamente.' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.orders (store_owner_id, customer_id, customer_name, customer_email, customer_phone, customer_address,
    delivery_method, payment_method, subtotal, delivery_fee, total_amount, status, payment_status, notes, order_source, checkout_origin, is_guest_order)
  VALUES (p_store_owner_id, p_customer_id, trim(p_customer_name), COALESCE(trim(p_customer_email), ''),
    trim(p_customer_phone), p_customer_address, p_delivery_method, p_payment_method,
    v_sub, v_fee, v_total,
    COALESCE(NULLIF(trim(p_status), ''), 'pending'), v_payment_status,
    NULLIF(trim(COALESCE(p_notes, '')), ''), v_order_source, v_checkout_origin, COALESCE(p_is_guest_order, p_customer_id IS NULL))
  RETURNING * INTO v_order;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_variations := NULL; v_sku := NULL; v_variant_id := NULL; v_mode := NULL; v_snapshot := NULL;
    IF v_item ? 'variations' AND v_item->'variations' IS NOT NULL AND jsonb_typeof(v_item->'variations') = 'object' AND v_item->'variations' <> '{}'::jsonb THEN
      v_variations := v_item->'variations';
    END IF;
    v_pid := (v_item->>'product_id')::uuid;
    SELECT CASE WHEN p.promotional_price IS NOT NULL AND p.promotional_price > 0 THEN p.promotional_price ELSE p.price END, p.name
      INTO v_unit, v_pname FROM public.products p WHERE p.id = v_pid AND p.user_id = p_store_owner_id AND p.is_active = true;
    IF NOT FOUND THEN RAISE EXCEPTION 'Produto inválido para esta loja: %', v_item->>'product_id'; END IF;
    v_qty := (v_item->>'quantity')::integer;
    v_variant_id := NULLIF(v_item->>'variant_id', '')::uuid;
    SELECT r.o_mode, r.o_sku, r.o_snapshot INTO v_mode, v_sku, v_snapshot
      FROM public.reserve_order_item_stock(p_store_owner_id, v_order.id, v_pid, v_variant_id, v_qty) r;
    IF v_mode <> 'variant' THEN v_variant_id := NULL; END IF;
    v_variations := COALESCE(v_snapshot, v_variations);

    INSERT INTO public.order_items (order_id, product_id, product_name, product_price, quantity, subtotal, variations, variant_id, variant_sku)
    VALUES (v_order.id, v_pid, COALESCE(v_pname, v_item->>'product_name'), v_unit, v_qty, round(v_unit * v_qty, 2), v_variations, v_variant_id, v_sku)
    RETURNING id INTO v_item_id;

    INSERT INTO public.order_stock_movements (store_id, order_id, order_item_id, variant_id, product_id, quantity, kind, reason)
    VALUES (p_store_owner_id, v_order.id, v_item_id, v_variant_id, v_pid, v_qty, 'reserve', 'order_created');
  END LOOP;
  RETURN to_jsonb(v_order);
END;
$function$;