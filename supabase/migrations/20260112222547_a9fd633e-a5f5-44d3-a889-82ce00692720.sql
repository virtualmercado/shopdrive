-- Security Fix 1: Drop the dangerous promote_to_admin() function
-- This function allows any authenticated user to become an admin without authorization
DROP FUNCTION IF EXISTS public.promote_to_admin();

-- Security Fix 2: Remove public access policy that exposes payment credentials
-- The current policy exposes mercadopago_access_token, pagbank_token, etc. to anyone
DROP POLICY IF EXISTS "Anyone can view payment settings for public stores" ON public.payment_settings;

-- Create a secure view that only exposes safe, non-sensitive payment configuration
-- This view is used by the frontend to check which payment methods are enabled
CREATE OR REPLACE VIEW public.payment_settings_public AS
SELECT 
  user_id,
  whatsapp_enabled,
  whatsapp_accepts_cash,
  whatsapp_accepts_credit,
  whatsapp_accepts_debit,
  whatsapp_accepts_pix,
  whatsapp_accepts_transfer,
  mercadopago_enabled,
  mercadopago_accepts_credit,
  mercadopago_accepts_pix,
  mercadopago_pix_discount,
  mercadopago_installments_free,
  pagbank_enabled,
  pagbank_accepts_credit,
  pagbank_accepts_pix,
  pix_enabled,
  pix_discount_percent,
  credit_card_enabled,
  credit_card_installments_no_interest,
  boleto_enabled,
  credit_card_provider,
  boleto_provider,
  pix_provider,
  whatsapp_number
FROM public.payment_settings;

-- Grant SELECT on the public view to authenticated and anonymous users
GRANT SELECT ON public.payment_settings_public TO anon, authenticated;

-- Security Fix 3: Remove the overly permissive UPDATE policy on pix_payments
-- The current policy USING (true) allows anyone to update any PIX payment
DROP POLICY IF EXISTS "System can update PIX payments" ON public.pix_payments;