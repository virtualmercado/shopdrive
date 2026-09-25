ALTER TABLE public.payment_settings DROP CONSTRAINT IF EXISTS pix_provider_check;
ALTER TABLE public.payment_settings ADD CONSTRAINT pix_provider_check CHECK ((pix_provider IS NULL) OR (pix_provider = ANY (ARRAY['mercado_pago'::text, 'pagbank'::text, 'infinitepay'::text])));
ALTER TABLE public.payment_settings DROP CONSTRAINT IF EXISTS credit_card_provider_check;
ALTER TABLE public.payment_settings ADD CONSTRAINT credit_card_provider_check CHECK ((credit_card_provider IS NULL) OR (credit_card_provider = ANY (ARRAY['mercado_pago'::text, 'pagbank'::text, 'infinitepay'::text])));
-- Rollback: recreate both constraints with ARRAY['mercado_pago','pagbank'] (only if no row uses 'infinitepay').