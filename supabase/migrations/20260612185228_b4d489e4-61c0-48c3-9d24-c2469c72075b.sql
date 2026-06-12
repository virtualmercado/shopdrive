ALTER TABLE public.payment_settings
  ADD COLUMN IF NOT EXISTS infinitepay_handle text;

UPDATE public.payment_settings
SET infinitepay_client_id = NULL,
    infinitepay_client_secret = NULL,
    infinitepay_webhook_secret = NULL
WHERE infinitepay_client_id IS NOT NULL
   OR infinitepay_client_secret IS NOT NULL
   OR infinitepay_webhook_secret IS NOT NULL;