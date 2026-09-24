CREATE OR REPLACE FUNCTION public.replace_manual_order_items(p_order_id uuid, p_items jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_owner uuid;
BEGIN
  SELECT store_owner_id INTO v_owner FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF v_owner IS NULL OR v_owner IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Pedido não encontrado para esta loja';
  END IF;
  -- Return previously reserved combination stock once, then replace items.
  PERFORM public.restore_order_variant_stock(p_order_id, 'manual_edit');
  DELETE FROM public.order_items WHERE order_id = p_order_id;
  PERFORM public.insert_order_items_secure(p_order_id, p_items);
END $$;
REVOKE ALL ON FUNCTION public.replace_manual_order_items(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.replace_manual_order_items(uuid, jsonb) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.copy_template_products_to_store(p_template_id uuid, p_user_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  copied_count integer := 0;
  r record;
BEGIN
  INSERT INTO public.product_categories (user_id, name)
  SELECT DISTINCT p_user_id, COALESCE(NULLIF(trim(tp.category), ''), 'Geral')
  FROM public.brand_template_products tp
  WHERE tp.template_id = p_template_id AND tp.is_active = true
  ON CONFLICT (user_id, name) DO NOTHING;

  INSERT INTO public.product_brands (user_id, name, is_active)
  SELECT DISTINCT p_user_id, trim(tp.brand_name), true
  FROM public.brand_template_products tp
  WHERE tp.template_id = p_template_id AND tp.is_active = true
    AND NULLIF(trim(tp.brand_name), '') IS NOT NULL
  ON CONFLICT (user_id, name) DO NOTHING;

  INSERT INTO public.products (
    user_id, name, description, price, images, image_url, category_id, is_active, stock,
    weight, height, length, width, shipping_weight, variations, promotional_price,
    is_featured, is_new, brand_id
  )
  SELECT
    p_user_id, tp.name, tp.description, tp.price,
    CASE WHEN tp.images IS NOT NULL THEN to_jsonb(tp.images) ELSE '[]'::jsonb END,
    CASE WHEN tp.images IS NOT NULL AND array_length(tp.images, 1) > 0 THEN tp.images[1] ELSE NULL END,
    (SELECT pc.id FROM public.product_categories pc WHERE pc.user_id = p_user_id
       AND pc.name = COALESCE(NULLIF(trim(tp.category), ''), 'Geral') LIMIT 1),
    true, 999, tp.weight, tp.height, tp.length, tp.width, tp.shipping_weight, tp.variations, tp.promotional_price,
    COALESCE(tp.is_featured, false), COALESCE(tp.is_new, false),
    (SELECT pb.id FROM public.product_brands pb WHERE pb.user_id = p_user_id AND pb.name = trim(tp.brand_name) LIMIT 1)
  FROM public.brand_template_products tp
  WHERE tp.template_id = p_template_id AND tp.is_active = true
    AND NOT EXISTS (SELECT 1 FROM public.products p WHERE p.user_id = p_user_id AND lower(trim(p.name)) = lower(trim(tp.name)));

  GET DIAGNOSTICS copied_count = ROW_COUNT;

  UPDATE public.products p
  SET
    category_id = COALESCE(p.category_id, (SELECT pc.id FROM public.product_categories pc WHERE pc.user_id = p_user_id
        AND pc.name = COALESCE(NULLIF(trim(tp.category), ''), 'Geral') LIMIT 1)),
    brand_id = COALESCE(p.brand_id, (SELECT pb.id FROM public.product_brands pb WHERE pb.user_id = p_user_id AND pb.name = trim(tp.brand_name) LIMIT 1)),
    weight = COALESCE(p.weight, tp.weight),
    height = COALESCE(p.height, tp.height),
    length = COALESCE(p.length, tp.length),
    width = COALESCE(p.width, tp.width),
    shipping_weight = COALESCE(p.shipping_weight, tp.shipping_weight),
    variations = COALESCE(p.variations, tp.variations),
    promotional_price = COALESCE(p.promotional_price, tp.promotional_price),
    image_url = COALESCE(p.image_url, CASE WHEN tp.images IS NOT NULL AND array_length(tp.images, 1) > 0 THEN tp.images[1] ELSE NULL END),
    images = CASE WHEN (p.images IS NULL OR p.images = '[]'::jsonb) AND tp.images IS NOT NULL THEN to_jsonb(tp.images) ELSE p.images END,
    updated_at = now()
  FROM public.brand_template_products tp
  WHERE p.user_id = p_user_id AND tp.template_id = p_template_id AND tp.is_active = true
    AND lower(trim(p.name)) = lower(trim(tp.name));

  -- Per-combination inventory: products created in this call inherit the matrix of the
  -- template's source-store product (new ids/SKUs; source untouched).
  FOR r IN
    SELECT p.id AS tgt, s.id AS src
    FROM public.brand_template_products tp
    JOIN public.brand_templates bt ON bt.id = tp.template_id
    JOIN public.products p ON p.user_id = p_user_id AND lower(trim(p.name)) = lower(trim(tp.name)) AND p.created_at >= now()
    JOIN LATERAL (
      SELECT sp.id FROM public.products sp
      WHERE sp.user_id = bt.source_profile_id AND sp.inventory_mode = 'variant'
        AND lower(trim(sp.name)) = lower(trim(tp.name))
      ORDER BY sp.created_at LIMIT 1
    ) s ON true
    WHERE tp.template_id = p_template_id AND tp.is_active = true
      AND bt.source_profile_id IS NOT NULL AND bt.source_profile_id <> p_user_id
  LOOP
    PERFORM public.clone_product_variants(r.src, r.tgt);
  END LOOP;

  IF copied_count > 0 THEN
    UPDATE public.brand_templates SET stores_created = stores_created + 1, updated_at = now() WHERE id = p_template_id;
  END IF;

  RETURN copied_count;
END $$;