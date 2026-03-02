
-- Add is_active column to products table with default true
ALTER TABLE public.products ADD COLUMN is_active boolean NOT NULL DEFAULT true;

-- Update the public_store_products view to filter only active products
-- First check if view exists
DROP VIEW IF EXISTS public.public_store_products;

CREATE VIEW public.public_store_products AS
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
  p.created_at
FROM public.products p
WHERE p.is_active = true;
