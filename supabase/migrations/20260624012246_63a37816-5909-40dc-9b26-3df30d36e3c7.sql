DROP POLICY IF EXISTS "Service role can manage all boleto payments" ON public.boleto_payments;

CREATE POLICY "Merchants can view their own data exports"
  ON public.data_exports
  FOR SELECT
  TO authenticated
  USING (auth.uid() = merchant_id);

DROP POLICY IF EXISTS "Public reads quotes via link" ON public.quotes;
DROP POLICY IF EXISTS "Public reads quote items via link" ON public.quote_items;
DROP POLICY IF EXISTS "Public reads enabled links" ON public.quote_public_links;

CREATE OR REPLACE FUNCTION public.get_public_quote_by_token(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_link RECORD;
  v_quote RECORD;
  v_items jsonb;
  v_store jsonb;
BEGIN
  IF p_token IS NULL OR length(p_token) < 8 THEN
    RETURN jsonb_build_object('error', 'invalid_token');
  END IF;

  SELECT quote_id, is_enabled, expires_at INTO v_link
  FROM public.quote_public_links
  WHERE public_token = p_token
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'not_found');
  END IF;

  IF v_link.is_enabled IS NOT TRUE
     OR (v_link.expires_at IS NOT NULL AND v_link.expires_at < now()) THEN
    RETURN jsonb_build_object('error', 'expired');
  END IF;

  SELECT id, quote_number, store_owner_id,
         customer_name,
         subtotal, discount, shipping_fee, total,
         valid_until, issued_at, payment_method_hint, notes
  INTO v_quote
  FROM public.quotes
  WHERE id = v_link.quote_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'not_found');
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'id', id,
           'name', name,
           'quantity', quantity,
           'unit_price', unit_price,
           'line_total', line_total
         ) ORDER BY id), '[]'::jsonb)
  INTO v_items
  FROM public.quote_items
  WHERE quote_id = v_quote.id;

  SELECT jsonb_build_object(
    'store_name', store_name,
    'store_logo_url', store_logo_url,
    'email', email,
    'phone', phone,
    'whatsapp_number', whatsapp_number,
    'address', address,
    'address_city', address_city,
    'address_state', address_state
  ) INTO v_store
  FROM public.profiles
  WHERE id = v_quote.store_owner_id;

  RETURN jsonb_build_object(
    'quote', to_jsonb(v_quote),
    'items', v_items,
    'store', COALESCE(v_store, '{}'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_quote_by_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_quote_by_token(text) TO anon, authenticated;

ALTER TABLE public.tenant_email_settings
  ADD COLUMN IF NOT EXISTS smtp_password_set boolean NOT NULL DEFAULT false;

UPDATE public.tenant_email_settings
SET smtp_password_set = (smtp_password IS NOT NULL AND smtp_password <> '')
WHERE smtp_password_set IS DISTINCT FROM (smtp_password IS NOT NULL AND smtp_password <> '');

CREATE OR REPLACE FUNCTION public.tenant_email_settings_sync_password_flag()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.smtp_password_set := (NEW.smtp_password IS NOT NULL AND NEW.smtp_password <> '');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tenant_email_settings_sync_password_flag ON public.tenant_email_settings;
CREATE TRIGGER trg_tenant_email_settings_sync_password_flag
  BEFORE INSERT OR UPDATE OF smtp_password ON public.tenant_email_settings
  FOR EACH ROW EXECUTE FUNCTION public.tenant_email_settings_sync_password_flag();

REVOKE SELECT (smtp_password) ON public.tenant_email_settings FROM anon, authenticated;