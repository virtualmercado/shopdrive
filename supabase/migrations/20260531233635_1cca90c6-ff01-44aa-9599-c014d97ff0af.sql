
-- Fix 1: Convert SECURITY DEFINER views to security_invoker
ALTER VIEW public.melhor_envio_settings_public SET (security_invoker = on);
ALTER VIEW public.payment_settings_public SET (security_invoker = on);
ALTER VIEW public.public_store_profiles SET (security_invoker = on);

-- Fix 2: Replace coupon public SELECT policy with a scoped RPC.
DROP POLICY IF EXISTS "Anyone can view active coupons for validation" ON public.coupons;

CREATE OR REPLACE FUNCTION public.validate_store_coupon(
  p_store_user_id uuid,
  p_code text
)
RETURNS TABLE(
  id uuid,
  user_id uuid,
  code text,
  discount_type text,
  discount_value numeric,
  min_order_value numeric,
  single_use boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id, c.user_id, c.code, c.discount_type, c.discount_value, c.min_order_value, c.single_use
  FROM public.coupons c
  WHERE c.user_id = p_store_user_id
    AND c.is_active = true
    AND lower(c.code) = lower(coalesce(trim(p_code), ''))
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.validate_store_coupon(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_store_coupon(uuid, text) TO anon, authenticated;

-- Fix 3: Remove pix_payments from realtime publication (not used in code,
-- and topic-based broadcast could leak payment data to any signed-in user).
ALTER PUBLICATION supabase_realtime DROP TABLE public.pix_payments;
