-- MULTILOJA MARCA: 0076 rewrote the UPDATE/DELETE "brand logos" storage policies to the
-- validated selected store, but its name filter ("their brand logos") skipped the INSERT
-- policy "Users can upload brand logos". Product images live at brands/<store_id>/products/...,
-- so delegated uploads were checked against the actor's own id and rejected.
-- Align only that INSERT check with the existing UPDATE/DELETE checks.
ALTER POLICY "Users can upload brand logos" ON storage.objects
WITH CHECK (
  bucket_id = 'product-images'
  AND public.merchant_request_store_id() IS NOT NULL
  AND (storage.foldername(name))[1] = 'brands'
  AND (storage.foldername(name))[2] = (public.merchant_request_store_id())::text
);