-- boleto_payments: remove client insert/update; writes only via service_role edge functions
DROP POLICY IF EXISTS "Store owners can insert boleto payments" ON public.boleto_payments;
DROP POLICY IF EXISTS "Store owners can update their boleto payments" ON public.boleto_payments;
REVOKE INSERT, UPDATE, DELETE ON public.boleto_payments FROM authenticated, anon;
GRANT SELECT ON public.boleto_payments TO authenticated;
GRANT ALL ON public.boleto_payments TO service_role;

-- master_subscription_payments: only admins may update; no self-insert/self-update
DROP POLICY IF EXISTS "Users can create their own payments" ON public.master_subscription_payments;
DROP POLICY IF EXISTS "Users and admins can update payments" ON public.master_subscription_payments;
CREATE POLICY "Admins can update payments"
  ON public.master_subscription_payments FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
REVOKE INSERT, DELETE ON public.master_subscription_payments FROM authenticated, anon;
GRANT SELECT, UPDATE ON public.master_subscription_payments TO authenticated;
GRANT ALL ON public.master_subscription_payments TO service_role;

-- master_subscriptions: only admins may update/insert; merchants read-only
DROP POLICY IF EXISTS "Users can create their own subscriptions" ON public.master_subscriptions;
DROP POLICY IF EXISTS "Users and admins can update subscriptions" ON public.master_subscriptions;
CREATE POLICY "Admins can insert subscriptions"
  ON public.master_subscriptions FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update subscriptions"
  ON public.master_subscriptions FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
REVOKE DELETE ON public.master_subscriptions FROM authenticated, anon;
GRANT SELECT, INSERT, UPDATE ON public.master_subscriptions TO authenticated;
GRANT ALL ON public.master_subscriptions TO service_role;