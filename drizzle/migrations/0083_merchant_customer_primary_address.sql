-- Merchant manual edit of a customer's primary address, scoped to the current store.
-- Only touches public.customer_addresses rows owned by the store; never orders, profiles or auth.
CREATE OR REPLACE FUNCTION public.merchant_save_customer_primary_address(
  p_customer_id uuid,
  p_recipient_name text,
  p_cep text,
  p_street text,
  p_number text,
  p_complement text,
  p_neighborhood text,
  p_city text,
  p_state text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_store uuid;
  v_cep text := regexp_replace(coalesce(p_cep, ''), '\D', '', 'g');
  v_state text := upper(btrim(coalesce(p_state, '')));
  v_street text := btrim(coalesce(p_street, ''));
  v_number text := btrim(coalesce(p_number, ''));
  v_complement text := nullif(btrim(coalesce(p_complement, '')), '');
  v_neighborhood text := btrim(coalesce(p_neighborhood, ''));
  v_city text := btrim(coalesce(p_city, ''));
  v_recipient text := btrim(coalesce(p_recipient_name, ''));
  v_target uuid;
  v_has_default boolean;
  v_row public.customer_addresses;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  -- Resolves the caller's own store, or a validated MULTILOJA selection (raises otherwise).
  v_store := public.merchant_request_store_id();
  IF v_store IS NULL OR p_customer_id IS NULL THEN
    RAISE EXCEPTION 'customer_not_found' USING ERRCODE = '42501';
  END IF;
  -- The customer must belong to this store; the row lock serializes concurrent saves.
  PERFORM 1 FROM public.store_customers
    WHERE store_owner_id = v_store AND customer_id = p_customer_id
    FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'customer_not_found' USING ERRCODE = '42501';
  END IF;

  IF v_street = '' OR v_number = '' OR v_neighborhood = '' OR v_city = '' OR v_state = '' OR v_cep = '' THEN
    RAISE EXCEPTION 'missing_required_field' USING ERRCODE = '22023';
  END IF;
  IF length(v_cep) <> 8 THEN
    RAISE EXCEPTION 'invalid_cep' USING ERRCODE = '22023';
  END IF;
  IF v_state NOT IN ('AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO') THEN
    RAISE EXCEPTION 'invalid_state' USING ERRCODE = '22023';
  END IF;
  IF length(v_street) > 200 OR length(v_number) > 20 OR length(coalesce(v_complement, '')) > 120
     OR length(v_neighborhood) > 120 OR length(v_city) > 120 OR length(v_recipient) > 150 THEN
    RAISE EXCEPTION 'field_too_long' USING ERRCODE = '22023';
  END IF;
  IF v_recipient = '' THEN
    SELECT nullif(btrim(full_name), '') INTO v_recipient FROM public.customer_profiles WHERE id = p_customer_id;
    v_recipient := coalesce(v_recipient, 'Cliente');
  END IF;

  -- Same choice the merchant screen displays: this store's address, primary first, newest first.
  SELECT id INTO v_target FROM public.customer_addresses
    WHERE customer_id = p_customer_id AND store_owner_id = v_store
    ORDER BY is_default DESC NULLS LAST, updated_at DESC, id
    LIMIT 1
    FOR UPDATE;

  IF v_target IS NOT NULL THEN
    UPDATE public.customer_addresses SET
      recipient_name = v_recipient, cep = v_cep, street = v_street, number = v_number,
      complement = v_complement, neighborhood = v_neighborhood, city = v_city, state = v_state,
      updated_at = now()
    WHERE id = v_target
    RETURNING * INTO v_row;
  ELSE
    -- Never edit the customer's own or another store's address: add one owned by this store.
    -- It becomes the customer's default only when no default exists yet.
    SELECT EXISTS (SELECT 1 FROM public.customer_addresses WHERE customer_id = p_customer_id AND is_default)
      INTO v_has_default;
    INSERT INTO public.customer_addresses(
      customer_id, store_owner_id, recipient_name, cep, street, number, complement,
      neighborhood, city, state, is_default, address_type)
    VALUES (
      p_customer_id, v_store, v_recipient, v_cep, v_street, v_number, v_complement,
      v_neighborhood, v_city, v_state, NOT v_has_default, 'delivery')
    RETURNING * INTO v_row;
  END IF;

  RETURN jsonb_build_object(
    'id', v_row.id, 'customer_id', v_row.customer_id, 'store_owner_id', v_row.store_owner_id,
    'recipient_name', v_row.recipient_name, 'cep', v_row.cep, 'street', v_row.street,
    'number', v_row.number, 'complement', v_row.complement, 'neighborhood', v_row.neighborhood,
    'city', v_row.city, 'state', v_row.state, 'is_default', v_row.is_default,
    'updated_at', v_row.updated_at);
END
$$;

REVOKE ALL ON FUNCTION public.merchant_save_customer_primary_address(uuid, text, text, text, text, text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.merchant_save_customer_primary_address(uuid, text, text, text, text, text, text, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.merchant_save_customer_primary_address(uuid, text, text, text, text, text, text, text, text) TO authenticated;
