-- Fix public_store_products view to include store_slug via profiles join
CREATE OR REPLACE VIEW public.public_store_products AS
SELECT 
  p.id,
  p.name,
  p.description,
  p.price,
  p.promotional_price,
  p.image_url,
  p.images,
  p.stock,
  p.user_id,
  p.category_id,
  p.brand_id,
  p.is_featured,
  p.is_new,
  p.weight,
  p.height,
  p.width,
  p.length,
  p.variations,
  p.created_at,
  pr.store_slug
FROM public.products p
JOIN public.profiles pr ON pr.id = p.user_id
WHERE p.is_active = true
  AND pr.store_slug IS NOT NULL;