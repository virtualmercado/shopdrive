
-- Grant SELECT on payment_settings and payment_settings_public to anon and authenticated
-- This is needed because the view has security_invoker=on
GRANT SELECT ON public.payment_settings TO anon;
GRANT SELECT ON public.payment_settings TO authenticated;
GRANT SELECT ON public.payment_settings_public TO anon;
GRANT SELECT ON public.payment_settings_public TO authenticated;
