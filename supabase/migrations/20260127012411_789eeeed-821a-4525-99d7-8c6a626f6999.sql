-- Add storage policies for product-images bucket to allow brand logo uploads

-- Policy to allow authenticated users to upload files to their own folder
CREATE POLICY "Users can upload brand logos"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'product-images' 
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = 'brands'
  AND (storage.foldername(name))[2] = auth.uid()::text
);

-- Policy to allow authenticated users to update their own brand logos
CREATE POLICY "Users can update their brand logos"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'product-images'
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = 'brands'
  AND (storage.foldername(name))[2] = auth.uid()::text
);

-- Policy to allow authenticated users to delete their own brand logos
CREATE POLICY "Users can delete their brand logos"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'product-images'
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = 'brands'
  AND (storage.foldername(name))[2] = auth.uid()::text
);

-- Policy to allow public read access to brand logos
CREATE POLICY "Public can view brand logos"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'product-images'
  AND (storage.foldername(name))[1] = 'brands'
);