ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS is_guest_order BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS checkout_origin TEXT;

CREATE OR REPLACE FUNCTION public.create_checkout_order(
  p_store_owner_id uuid,
  p_customer_id uuid DEFAULT NULL,
  p_customer_name text DEFAULT '',
  p_customer_email text DEFAULT '',
  p_customer_phone text DEFAULT '',
  p_customer_address text DEFAULT NULL,
  p_delivery_method text DEFAULT NULL,
  p_payment_method text DEFAULT NULL,
  p_subtotal numeric DEFAULT 0,
  p_delivery_fee numeric DEFAULT 0,
  p_total_amount numeric DEFAULT 0,
  p_status text DEFAULT 'pending',
  p_payment_status text DEFAULT 'pending',
  p_notes text DEFAULT NULL,
  p_order_source text DEFAULT 'store',
  p_checkout_origin text DEFAULT 'checkout_guest',
  p_is_guest_order boolean DEFAULT true,
  p_items jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_item jsonb;
  v_variations jsonb;
  v_auth_uid uuid := auth.uid();
  v_order_source text := COALESCE(NULLIF(trim(p_order_source), ''), 'store');
  v_payment_status text := COALESCE(NULLIF(trim(p_payment_status), ''), 'pending');
  v_checkout_origin text := COALESCE(NULLIF(trim(p_checkout_origin), ''), CASE WHEN COALESCE(p_is_guest_order, true) THEN 'checkout_guest' ELSE 'checkout_customer' END);
BEGIN
  IF p_store_owner_id IS NULL OR NOT public.is_active_store(p_store_owner_id) THEN
    RAISE EXCEPTION 'Loja indisponível para receber pedidos';
  END IF;

  IF trim(COALESCE(p_customer_name, '')) = '' OR length(trim(COALESCE(p_customer_name, ''))) < 3 THEN
    RAISE EXCEPTION 'Nome do cliente é obrigatório';
  END IF;

  IF trim(COALESCE(p_customer_phone, '')) = '' OR length(regexp_replace(COALESCE(p_customer_phone, ''), '\D', '', 'g')) < 10 THEN
    RAISE EXCEPTION 'Telefone do cliente é obrigatório';
  END IF;

  IF p_customer_id IS NOT NULL AND v_auth_uid IS DISTINCT FROM p_customer_id THEN
    RAISE EXCEPTION 'Cliente autenticado inválido para o pedido';
  END IF;

  IF v_order_source NOT IN ('store', 'catalog', 'manual') THEN
    v_order_source := 'store';
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Itens do pedido são obrigatórios';
  END IF;

  IF COALESCE(p_subtotal, 0) < 0 OR COALESCE(p_delivery_fee, 0) < 0 OR COALESCE(p_total_amount, 0) < 0 THEN
    RAISE EXCEPTION 'Valores do pedido inválidos';
  END IF;

  INSERT INTO public.orders (
    store_owner_id,
    customer_id,
    customer_name,
    customer_email,
    customer_phone,
    customer_address,
    delivery_method,
    payment_method,
    subtotal,
    delivery_fee,
    total_amount,
    status,
    payment_status,
    notes,
    order_source,
    checkout_origin,
    is_guest_order
  ) VALUES (
    p_store_owner_id,
    p_customer_id,
    trim(p_customer_name),
    COALESCE(trim(p_customer_email), ''),
    trim(p_customer_phone),
    p_customer_address,
    p_delivery_method,
    p_payment_method,
    COALESCE(p_subtotal, 0),
    COALESCE(p_delivery_fee, 0),
    COALESCE(p_total_amount, 0),
    COALESCE(NULLIF(trim(p_status), ''), 'pending'),
    v_payment_status,
    NULLIF(trim(COALESCE(p_notes, '')), ''),
    v_order_source,
    v_checkout_origin,
    COALESCE(p_is_guest_order, p_customer_id IS NULL)
  )
  RETURNING * INTO v_order;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_variations := NULL;
    IF v_item ? 'variations'
       AND v_item->'variations' IS NOT NULL
       AND jsonb_typeof(v_item->'variations') = 'object'
       AND v_item->'variations' <> '{}'::jsonb THEN
      v_variations := v_item->'variations';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM public.products p
      WHERE p.id = (v_item->>'product_id')::uuid
        AND p.user_id = p_store_owner_id
        AND p.is_active = true
    ) THEN
      RAISE EXCEPTION 'Produto inválido para esta loja: %', v_item->>'product_id';
    END IF;

    INSERT INTO public.order_items (
      order_id,
      product_id,
      product_name,
      product_price,
      quantity,
      subtotal,
      variations
    ) VALUES (
      v_order.id,
      (v_item->>'product_id')::uuid,
      v_item->>'product_name',
      (v_item->>'product_price')::numeric,
      (v_item->>'quantity')::integer,
      (v_item->>'subtotal')::numeric,
      v_variations
    );
  END LOOP;

  RETURN to_jsonb(v_order);
END;
$$;

REVOKE ALL ON FUNCTION public.create_checkout_order(uuid, uuid, text, text, text, text, text, text, numeric, numeric, numeric, text, text, text, text, text, boolean, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_checkout_order(uuid, uuid, text, text, text, text, text, text, numeric, numeric, numeric, text, text, text, text, text, boolean, jsonb) TO anon, authenticated, service_role;