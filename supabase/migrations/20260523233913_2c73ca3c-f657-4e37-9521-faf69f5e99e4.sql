
-- 1. melhor_envio_settings: remove public SELECT that exposed api_key
DROP POLICY IF EXISTS "Anyone can view active melhor envio settings for checkout" ON public.melhor_envio_settings;

-- Replace the public view with a SECURITY DEFINER function that exposes only non-sensitive fields
CREATE OR REPLACE FUNCTION public.get_melhor_envio_status(p_user_id uuid)
RETURNS TABLE(user_id uuid, is_active boolean, environment text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT user_id, is_active, environment
  FROM public.melhor_envio_settings
  WHERE user_id = p_user_id AND is_active = true;
$$;

REVOKE ALL ON FUNCTION public.get_melhor_envio_status(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_melhor_envio_status(uuid) TO anon, authenticated;

-- Keep the public view working for any cached client by making it SECURITY DEFINER and
-- locking it to only safe columns (already only exposes user_id, is_active, environment)
ALTER VIEW public.melhor_envio_settings_public SET (security_invoker = off);

-- 2. Realtime: remove sensitive support-ticket tables from realtime broadcast
ALTER PUBLICATION supabase_realtime DROP TABLE public.tickets_landing_page;
ALTER PUBLICATION supabase_realtime DROP TABLE public.ticket_landing_responses;

-- 3. coupon_usage: replace permissive INSERT with one that requires a real matching order
DROP POLICY IF EXISTS "Anyone can record coupon usage" ON public.coupon_usage;

CREATE OR REPLACE FUNCTION public.coupon_usage_is_valid(p_order_id uuid, p_email text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.orders
    WHERE id = p_order_id
      AND lower(customer_email) = lower(p_email)
  )
$$;

REVOKE ALL ON FUNCTION public.coupon_usage_is_valid(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.coupon_usage_is_valid(uuid, text) TO anon, authenticated;

CREATE POLICY "Validated coupon usage inserts"
ON public.coupon_usage
FOR INSERT
TO anon, authenticated
WITH CHECK (public.coupon_usage_is_valid(order_id, customer_email));

-- 4. master_subscription_logs: only service-role (edge functions) can insert
DROP POLICY IF EXISTS "System can insert logs" ON public.master_subscription_logs;

CREATE POLICY "Service role can insert subscription logs"
ON public.master_subscription_logs
FOR INSERT
TO service_role
WITH CHECK (true);

-- 5. Security definer view: make public_store_products run as invoker (RLS-aware)
ALTER VIEW public.public_store_products SET (security_invoker = true);

-- 6. Reduce attack surface: revoke EXECUTE from anon/authenticated on clearly-internal SECURITY DEFINER functions
DO $$
DECLARE
  fn_signature text;
  internal_fns text[] := ARRAY[
    'apply_template_to_existing_store(uuid,uuid,boolean)',
    'backfill_partner_templates()',
    'bump_product_score_on_order()',
    'bump_product_score_on_view()',
    'check_media_file_usage(uuid)',
    'check_order_rate_limit(text)',
    'clone_template_to_store(uuid,uuid)',
    'complement_template_data(uuid,uuid)',
    'expire_stale_pix_payments()',
    'generate_customer_code(uuid)',
    'generate_order_number()',
    'generate_store_slug(text)',
    'generate_ticket_number()',
    'handle_new_customer()',
    'handle_new_order_customer()',
    'handle_new_user()',
    'handle_updated_at()',
    'increment_email_metric_counters(uuid)',
    'link_template_to_profile(uuid,uuid)',
    'log_audit_event(text,text,uuid,jsonb,text)',
    'prevent_media_deletion()',
    'prevent_store_owner_change()',
    'propagate_content_banner_from_template(uuid)',
    'recompute_product_popularity(uuid)',
    'set_customer_code()',
    'set_invoice_id()',
    'set_order_number()',
    'set_template_slug()',
    'set_ticket_number()',
    'sync_invoice_for_payment(uuid)',
    'sync_template_from_profile(uuid)',
    'trg_sync_invoice_from_payment()',
    'update_account_deletion_requests_updated_at()',
    'update_master_subscription_updated_at()',
    'update_updated_at_column()',
    'validate_order_item()'
  ];
BEGIN
  FOREACH fn_signature IN ARRAY internal_fns LOOP
    BEGIN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%s FROM anon, authenticated, PUBLIC', fn_signature);
    EXCEPTION WHEN undefined_function THEN
      -- skip missing functions silently
      NULL;
    END;
  END LOOP;
END $$;
