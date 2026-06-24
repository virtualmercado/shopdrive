
-- Add variations column to order_items
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS variations jsonb NULL;

COMMENT ON COLUMN public.order_items.variations IS 'Selected variations at purchase time, e.g. {"Aroma":"Açaí","Tamanho":"80ml"}';

-- Secure RPC to insert order_items reliably (bypasses 60s RLS window)
-- The validate_order_item trigger still runs and enforces product/price/quantity validity.
CREATE OR REPLACE FUNCTION public.insert_order_items_secure(
  p_order_id uuid,
  p_items jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
  v_item jsonb;
  v_variations jsonb;
BEGIN
  IF p_order_id IS NULL THEN
    RAISE EXCEPTION 'order_id is required';
  END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'items must be a non-empty array';
  END IF;

  SELECT id, store_owner_id, status, created_at
  INTO v_order
  FROM public.orders
  WHERE id = p_order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found: %', p_order_id;
  END IF;

  -- Prevent tampering: only allow first-write
  IF EXISTS (SELECT 1 FROM public.order_items WHERE order_id = p_order_id) THEN
    RAISE EXCEPTION 'Order already has items';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_variations := NULL;
    IF v_item ? 'variations'
       AND v_item->'variations' IS NOT NULL
       AND jsonb_typeof(v_item->'variations') = 'object'
       AND v_item->'variations' <> '{}'::jsonb THEN
      v_variations := v_item->'variations';
    END IF;

    INSERT INTO public.order_items (
      order_id, product_id, product_name, product_price, quantity, subtotal, variations
    ) VALUES (
      p_order_id,
      (v_item->>'product_id')::uuid,
      v_item->>'product_name',
      (v_item->>'product_price')::numeric,
      (v_item->>'quantity')::integer,
      (v_item->>'subtotal')::numeric,
      v_variations
    );
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.insert_order_items_secure(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.insert_order_items_secure(uuid, jsonb) TO anon, authenticated, service_role;
