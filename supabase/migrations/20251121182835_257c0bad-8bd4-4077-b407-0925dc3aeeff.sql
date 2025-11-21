-- Fix security definer view by recreating with security invoker
DROP VIEW IF EXISTS public.public_store_products;

CREATE VIEW public.public_store_products
WITH (security_invoker = true)
AS
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