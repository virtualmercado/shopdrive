CREATE OR REPLACE VIEW public.public_store_products
WITH (security_invoker = on) AS
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
FROM products p
JOIN profiles pr ON pr.id = p.user_id
WHERE p.is_active = true AND pr.store_slug IS NOT NULL;