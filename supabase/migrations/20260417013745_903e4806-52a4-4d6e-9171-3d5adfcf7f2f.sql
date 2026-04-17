
-- 1. Fix payment_settings: drop permissive public read policy.
-- The payment_settings_public view (with security_invoker=on) already exposes
-- safe fields for checkout. Authenticated owners keep access via the existing
-- policy referencing is_public_store / their own row.
DROP POLICY IF EXISTS "Anyone can view payment settings for checkout" ON public.payment_settings;
DROP POLICY IF EXISTS "Anyone can view payment settings for public stores" ON public.payment_settings;

-- Restore the owner-scoped read policy if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'payment_settings' 
      AND policyname = 'Users can view their own payment settings'
  ) THEN
    CREATE POLICY "Users can view their own payment settings"
      ON public.payment_settings
      FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- The payment_settings_public view runs with security_invoker=on, so it would
-- inherit RLS and break checkout. Recreate it with security_invoker=off so
-- anon checkout can read only safe (non-credential) fields.
DROP VIEW IF EXISTS public.payment_settings_public;

CREATE VIEW public.payment_settings_public
WITH (security_invoker = off)
AS
SELECT 
  id,
  user_id,
  pix_enabled,
  pix_provider,
  pix_discount_percent,
  credit_card_enabled,
  credit_card_provider,
  credit_card_installments_no_interest,
  boleto_enabled,
  boleto_provider,
  whatsapp_number,
  created_at,
  updated_at
FROM public.payment_settings
WHERE public.is_public_store(user_id);

GRANT SELECT ON public.payment_settings_public TO anon, authenticated;

-- 2. Fix 'media' storage bucket: add ownership checks.
DROP POLICY IF EXISTS "Allow authenticated users to upload to media bucket" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to update their uploads in media bucket" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to delete from media bucket" ON storage.objects;

CREATE POLICY "Users can upload to their own folder in media bucket"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'media' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can update their own files in media bucket"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'media' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can delete their own files in media bucket"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'media' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Admins retain full control over the media bucket
CREATE POLICY "Admins can manage all files in media bucket"
ON storage.objects FOR ALL
TO authenticated
USING (
  bucket_id = 'media' 
  AND public.has_role(auth.uid(), 'admin'::app_role)
)
WITH CHECK (
  bucket_id = 'media' 
  AND public.has_role(auth.uid(), 'admin'::app_role)
);

-- 3. Fix Realtime channel authorization: scope subscriptions to authenticated
-- users with row-level access. Postgres realtime checks RLS on realtime.messages.
ALTER TABLE IF EXISTS realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can receive broadcasts" ON realtime.messages;

-- Only authenticated users can subscribe; the underlying table RLS still gates
-- which row-change payloads they actually receive.
CREATE POLICY "Authenticated users can receive broadcasts"
ON realtime.messages
FOR SELECT
TO authenticated
USING (true);
