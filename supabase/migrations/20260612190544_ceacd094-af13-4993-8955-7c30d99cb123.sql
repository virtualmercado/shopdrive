DROP VIEW IF EXISTS public.payment_settings_public;

CREATE VIEW public.payment_settings_public
WITH (security_invoker = on) AS
SELECT id, user_id, pix_enabled, pix_provider, pix_discount_percent,
  credit_card_enabled, credit_card_provider, credit_card_installments_no_interest,
  boleto_enabled, boleto_provider,
  mercadopago_enabled, mercadopago_accepts_pix, mercadopago_accepts_credit,
  mercadopago_installments_free, mercadopago_pix_discount,
  pagbank_enabled, pagbank_accepts_pix, pagbank_accepts_credit,
  stone_ton_enabled,
  infinitepay_enabled, infinitepay_handle,
  whatsapp_enabled, whatsapp_accepts_pix, whatsapp_accepts_credit,
  whatsapp_accepts_debit, whatsapp_accepts_cash, whatsapp_accepts_transfer,
  whatsapp_number, created_at, updated_at
FROM public.payment_settings
WHERE public.is_public_store(user_id);

GRANT SELECT ON public.payment_settings_public TO anon, authenticated;