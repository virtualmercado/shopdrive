-- Fix the SECURITY DEFINER issue on the view by recreating it with SECURITY INVOKER
DROP VIEW IF EXISTS public.payment_settings_public;

CREATE VIEW public.payment_settings_public 
WITH (security_invoker = on)
AS
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