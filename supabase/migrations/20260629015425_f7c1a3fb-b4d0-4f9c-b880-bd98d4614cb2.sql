
-- 1) Restrict landing_response_templates SELECT to admin/suporte staff only
DROP POLICY IF EXISTS "Authenticated users can read response templates" ON public.landing_response_templates;
CREATE POLICY "Staff can read response templates"
ON public.landing_response_templates
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'suporte'::app_role)
);

-- 2) Tighten public product_brands visibility to brands of publicly listed, active stores
DROP POLICY IF EXISTS "Public can view active brands" ON public.product_brands;
CREATE POLICY "Public can view active brands of public active stores"
ON public.product_brands
FOR SELECT
USING (
  is_active = true
  AND public.is_public_store(user_id)
);

-- 3) Harden is_public_store / is_active_store to require an active, non-maintenance merchant
CREATE OR REPLACE FUNCTION public.is_public_store(store_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = store_user_id
      AND store_slug IS NOT NULL
      AND COALESCE(account_status, 'active') = 'active'
      AND COALESCE(is_maintenance_mode, false) = false
  )
$$;

CREATE OR REPLACE FUNCTION public.is_active_store(store_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = store_id
      AND store_slug IS NOT NULL
      AND COALESCE(account_status, 'active') = 'active'
  );
END;
$$;

-- 4) Remove SELECT on tenant_email_settings.smtp_password from client roles.
-- Edge Functions use service_role (unaffected). UI uses smtp_password_set flag.
REVOKE SELECT (smtp_password) ON public.tenant_email_settings FROM authenticated;
REVOKE SELECT (smtp_password) ON public.tenant_email_settings FROM anon;
