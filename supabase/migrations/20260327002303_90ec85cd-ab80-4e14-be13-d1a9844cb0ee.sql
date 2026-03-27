
-- Fix: set image_url from first element of images array during template product cloning
CREATE OR REPLACE FUNCTION public.copy_template_products_to_store(p_template_id uuid, p_user_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  copied_count INTEGER := 0;
BEGIN
  INSERT INTO product_brands (user_id, name, is_active)
  SELECT DISTINCT p_user_id, tp.brand_name, true
  FROM brand_template_products tp
  WHERE tp.template_id = p_template_id AND tp.is_active = true AND tp.brand_name IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM product_brands pb WHERE pb.user_id = p_user_id AND pb.name = tp.brand_name);

  INSERT INTO products (user_id, name, description, price, images, image_url, is_active, stock,
    weight, height, length, width, shipping_weight, variations, promotional_price, is_featured, is_new, brand_id)
  SELECT p_user_id, tp.name, tp.description, tp.price,
    CASE WHEN tp.images IS NOT NULL THEN to_jsonb(tp.images) ELSE NULL END,
    CASE WHEN tp.images IS NOT NULL AND array_length(tp.images, 1) > 0 THEN tp.images[1] ELSE NULL END,
    true, 999,
    tp.weight, tp.height, tp.length, tp.width, tp.shipping_weight,
    tp.variations, tp.promotional_price,
    COALESCE(tp.is_featured, false), COALESCE(tp.is_new, false),
    (SELECT pb.id FROM product_brands pb WHERE pb.user_id = p_user_id AND pb.name = tp.brand_name LIMIT 1)
  FROM brand_template_products tp
  WHERE tp.template_id = p_template_id AND tp.is_active = true;
  GET DIAGNOSTICS copied_count = ROW_COUNT;

  UPDATE brand_templates SET stores_created = stores_created + 1 WHERE id = p_template_id;
  RETURN copied_count;
END;
$function$;

-- Retroactive fix: set image_url for all cloned products that have images but no image_url
UPDATE products
SET image_url = (images->>0)
WHERE image_url IS NULL
  AND images IS NOT NULL
  AND jsonb_typeof(images) = 'array'
  AND jsonb_array_length(images) > 0
  AND user_id IN (SELECT id FROM profiles WHERE source_template_id IS NOT NULL);
