-- Drop the dangerous policy that exposes all columns including secret tokens
DROP POLICY IF EXISTS "Anyone can read public key from active gateways" ON public.master_payment_gateways;
DROP POLICY IF EXISTS "Admins can manage gateways" ON public.master_payment_gateways;
DROP POLICY IF EXISTS "Authenticated users can manage gateways" ON public.master_payment_gateways;

-- Create admin-only full access policy
CREATE POLICY "Admins can manage gateways"
ON public.master_payment_gateways FOR ALL
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Create a secure view that only exposes the public key for checkout SDK
CREATE OR REPLACE VIEW public.master_gateway_public_keys
WITH (security_invoker = on) AS
SELECT 
  id,
  gateway_name,
  display_name,
  is_active,
  environment,
  mercadopago_public_key
FROM public.master_payment_gateways
WHERE is_active = true AND is_default = true;

-- Grant access to the view for anon and authenticated
GRANT SELECT ON public.master_gateway_public_keys TO anon, authenticated;
