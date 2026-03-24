
-- Allow anyone to read payment settings (needed for public checkout)
-- The payment_settings_public view already excludes sensitive fields (tokens/keys)
-- but the view has security_invoker=on, so it respects RLS on the underlying table.
-- We need a public read policy so customers can see which payment methods a store accepts.

CREATE POLICY "Anyone can view payment settings for checkout"
ON public.payment_settings
FOR SELECT
TO anon, authenticated
USING (true);

-- Drop the old restrictive read policy since the new one covers it
DROP POLICY IF EXISTS "Users can view their own payment settings" ON public.payment_settings;
