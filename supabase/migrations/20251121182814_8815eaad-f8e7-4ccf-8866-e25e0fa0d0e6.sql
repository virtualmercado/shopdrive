-- Create secure view for public store products without exposing user_id
CREATE OR REPLACE VIEW public.public_store_products AS
SELECT 
  p.id,
  p.name,
  p.description,
  p.price,
  p.stock,
  p.image_url,
  p.created_at,
  p.updated_at,
  prof.store_slug
FROM public.products p
JOIN public.profiles prof ON p.user_id = prof.id
WHERE prof.store_slug IS NOT NULL;

-- Drop the insecure public policy on products table
DROP POLICY IF EXISTS "Anyone can view products for public stores" ON public.products;