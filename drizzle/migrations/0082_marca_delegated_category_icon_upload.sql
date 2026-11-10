-- MULTILOJA MARCA: 0076 rewrote the UPDATE/DELETE "their category icons" storage policies to the
-- validated selected store, but its name filter skipped the INSERT policy "Users can upload
-- category icons". Category icons live at categories/<store_id>/..., so delegated uploads were
-- checked against the actor's own id and rejected. Align only that INSERT check with the
-- existing UPDATE/DELETE checks (same pattern as 0081 for product images).
ALTER POLICY "Users can upload category icons" ON storage.objects
WITH CHECK (
  bucket_id = 'product-images'
  AND public.merchant_request_store_id() IS NOT NULL
  AND (storage.foldername(name))[1] = 'categories'
  AND (storage.foldername(name))[2] = (public.merchant_request_store_id())::text
);