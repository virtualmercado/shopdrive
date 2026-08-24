CREATE OR REPLACE FUNCTION public.get_master_gateway_public_config()
RETURNS TABLE (
  gateway_name text,
  display_name text,
  environment text,
  mercadopago_public_key text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  SELECT count(*) INTO v_count
  FROM public.master_payment_gateways g
  WHERE g.is_active = true
    AND g.is_default = true
    AND g.gateway_name = 'mercadopago';

  IF v_count > 1 THEN
    RAISE EXCEPTION 'gateway_config_ambiguous';
  END IF;

  RETURN QUERY
  SELECT g.gateway_name, g.display_name, g.environment, g.mercadopago_public_key
  FROM public.master_payment_gateways g
  WHERE g.is_active = true
    AND g.is_default = true
    AND g.gateway_name = 'mercadopago'
    AND g.mercadopago_public_key IS NOT NULL
    AND length(btrim(g.mercadopago_public_key)) > 0
  LIMIT 1;
END;
$$;

REVOKE ALL ON FUNCTION public.get_master_gateway_public_config() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_master_gateway_public_config() TO anon, authenticated, service_role;