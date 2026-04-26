-- Public read for category icons
CREATE POLICY "Public can view category icons"
ON storage.objects FOR SELECT
USING (bucket_id = 'product-images' AND (storage.foldername(name))[1] = 'categories');

-- Authenticated users can upload to categories/{their_user_id}/...
CREATE POLICY "Users can upload category icons"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'product-images'
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = 'categories'
  AND (storage.foldername(name))[2] = (auth.uid())::text
);

CREATE POLICY "Users can update their category icons"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'product-images'
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = 'categories'
  AND (storage.foldername(name))[2] = (auth.uid())::text
);

CREATE POLICY "Users can delete their category icons"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'product-images'
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = 'categories'
  AND (storage.foldername(name))[2] = (auth.uid())::text
);