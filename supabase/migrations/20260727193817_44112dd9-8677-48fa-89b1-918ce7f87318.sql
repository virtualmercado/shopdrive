-- 1) Add "_set" flag columns (safe indicators visible to client)
ALTER TABLE public.payment_settings
  ADD COLUMN IF NOT EXISTS mercadopago_access_token_set boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS mercadopago_webhook_secret_set boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pagbank_token_set boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pagbank_webhook_secret_set boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stone_ton_secret_key_set boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS infinitepay_client_secret_set boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS infinitepay_webhook_secret_set boolean NOT NULL DEFAULT false;

-- 2) Trigger keeps flags in sync
CREATE OR REPLACE FUNCTION public.payment_settings_sync_secret_flags()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.mercadopago_access_token_set   := NEW.mercadopago_access_token   IS NOT NULL AND length(btrim(NEW.mercadopago_access_token))   > 0;
  NEW.mercadopago_webhook_secret_set := NEW.mercadopago_webhook_secret IS NOT NULL AND length(btrim(NEW.mercadopago_webhook_secret)) > 0;
  NEW.pagbank_token_set              := NEW.pagbank_token              IS NOT NULL AND length(btrim(NEW.pagbank_token))              > 0;
  NEW.pagbank_webhook_secret_set     := NEW.pagbank_webhook_secret     IS NOT NULL AND length(btrim(NEW.pagbank_webhook_secret))     > 0;
  NEW.stone_ton_secret_key_set       := NEW.stone_ton_secret_key       IS NOT NULL AND length(btrim(NEW.stone_ton_secret_key))       > 0;
  NEW.infinitepay_client_secret_set  := NEW.infinitepay_client_secret  IS NOT NULL AND length(btrim(NEW.infinitepay_client_secret))  > 0;
  NEW.infinitepay_webhook_secret_set := NEW.infinitepay_webhook_secret IS NOT NULL AND length(btrim(NEW.infinitepay_webhook_secret)) > 0;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_payment_settings_sync_secret_flags ON public.payment_settings;
CREATE TRIGGER trg_payment_settings_sync_secret_flags
  BEFORE INSERT OR UPDATE ON public.payment_settings
  FOR EACH ROW EXECUTE FUNCTION public.payment_settings_sync_secret_flags();

-- 3) Backfill existing rows so flags reflect current data
UPDATE public.payment_settings SET updated_at = updated_at;

-- 4) Revoke column-level SELECT on secret columns from client roles
REVOKE SELECT (
  mercadopago_access_token,
  mercadopago_webhook_secret,
  pagbank_token,
  pagbank_webhook_secret,
  stone_ton_secret_key,
  infinitepay_client_secret,
  infinitepay_webhook_secret
) ON public.payment_settings FROM PUBLIC, anon, authenticated;

-- service_role retains full access implicitly (used by edge functions)
GRANT ALL ON public.payment_settings TO service_role;