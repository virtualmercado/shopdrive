
-- Drop old clone_template_to_store (returns void) to allow return type change
DROP FUNCTION IF EXISTS public.clone_template_to_store(uuid, uuid);

-- 1. Make copy_template_products_to_store IDEMPOTENT
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
  WHERE tp.template_id = p_template_id AND tp.is_active = true
    AND NOT EXISTS (
      SELECT 1 FROM products p 
      WHERE p.user_id = p_user_id AND p.name = tp.name
    );
  GET DIAGNOSTICS copied_count = ROW_COUNT;

  IF copied_count > 0 THEN
    UPDATE brand_templates SET stores_created = stores_created + 1 WHERE id = p_template_id;
  END IF;
  
  RETURN copied_count;
END;
$function$;

-- 2. Recreate clone_template_to_store returning jsonb with validation
CREATE OR REPLACE FUNCTION public.clone_template_to_store(p_template_id uuid, p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_template RECORD;
  v_new_slug TEXT;
  v_store_name TEXT;
  v_profile_exists BOOLEAN;
  v_copied_count INTEGER;
  v_expected_count INTEGER;
  v_total_products INTEGER;
BEGIN
  SELECT EXISTS(SELECT 1 FROM profiles WHERE id = p_user_id) INTO v_profile_exists;
  IF NOT v_profile_exists THEN
    RETURN jsonb_build_object('success', false, 'error', 'Profile not yet created', 'retry', true);
  END IF;

  SELECT * INTO v_template FROM brand_templates WHERE id = p_template_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Template not found', 'retry', false);
  END IF;

  SELECT COUNT(*) INTO v_expected_count 
  FROM brand_template_products WHERE template_id = p_template_id AND is_active = true;

  v_store_name := COALESCE(v_template.store_name, v_template.name);
  v_new_slug := public.generate_store_slug(v_store_name);
  
  UPDATE profiles SET
    store_name = v_store_name, store_slug = v_new_slug,
    store_logo_url = v_template.logo_url,
    primary_color = COALESCE(v_template.primary_color, '#000000'),
    secondary_color = COALESCE(v_template.secondary_color, '#ffffff'),
    font_family = v_template.font_family,
    button_bg_color = v_template.button_bg_color,
    button_text_color = v_template.button_text_color,
    footer_bg_color = v_template.footer_bg_color,
    footer_text_color = v_template.footer_text_color,
    price_color = v_template.price_color,
    title_color = v_template.title_color,
    banner_desktop_urls = COALESCE(v_template.banner_desktop_urls, '[]'::jsonb),
    banner_mobile_urls = COALESCE(v_template.banner_mobile_urls, '[]'::jsonb),
    banner_rect_1_url = v_template.banner_rect_1_url,
    banner_rect_2_url = v_template.banner_rect_2_url,
    minibanner_1_img2_url = v_template.minibanner_1_img2_url,
    minibanner_2_img2_url = v_template.minibanner_2_img2_url,
    selected_benefit_banners = v_template.selected_benefit_banners,
    content_banner_enabled = COALESCE(v_template.content_banner_enabled, false),
    content_banner_title = v_template.content_banner_title,
    content_banner_subtitle = v_template.content_banner_subtitle,
    content_banner_title_color = v_template.content_banner_title_color,
    content_banner_subtitle_color = v_template.content_banner_subtitle_color,
    content_banner_url = v_template.content_banner_url,
    content_banner_image_url = v_template.content_banner_image_url,
    content_banners = v_template.content_banners,
    about_us_text = v_template.about_us_text,
    about_us_title = v_template.about_us_title,
    return_policy_text = v_template.return_policy_text,
    topbar_enabled = COALESCE(v_template.topbar_enabled, false),
    topbar_bg_color = v_template.topbar_bg_color,
    topbar_text_color = v_template.topbar_text_color,
    topbar_text = v_template.topbar_text,
    topbar_link_type = v_template.topbar_link_type,
    topbar_link_target = v_template.topbar_link_target,
    header_logo_position = v_template.header_logo_position,
    store_layout = v_template.store_layout,
    store_model = COALESCE(v_template.store_model, 'Loja Virtual'),
    reviews_section_title = v_template.reviews_section_title,
    home_video_enabled = COALESCE(v_template.home_video_enabled, false),
    home_video_provider = v_template.home_video_provider,
    home_video_id = v_template.home_video_id,
    home_video_url_original = v_template.home_video_url_original,
    home_video_title = v_template.home_video_title,
    home_video_description = v_template.home_video_description,
    whatsapp_number = v_template.whatsapp_number,
    instagram_url = v_template.instagram_url,
    facebook_url = v_template.facebook_url,
    x_url = v_template.x_url,
    youtube_url = v_template.youtube_url,
    show_whatsapp_button = COALESCE(v_template.show_whatsapp_button, true),
    source_template_id = p_template_id,
    template_applied = true,
    template_applied_at = now(),
    template_apply_error = null,
    updated_at = now()
  WHERE id = p_user_id;
  
  v_copied_count := public.copy_template_products_to_store(p_template_id, p_user_id);
  
  SELECT COUNT(*) INTO v_total_products FROM products WHERE user_id = p_user_id;
  
  IF v_total_products >= v_expected_count THEN
    UPDATE profiles SET template_apply_status = 'applied' WHERE id = p_user_id;
  ELSE
    UPDATE profiles SET 
      template_apply_status = 'incomplete',
      template_apply_error = format('Expected %s products, found %s', v_expected_count, v_total_products)
    WHERE id = p_user_id;
  END IF;
  
  RETURN jsonb_build_object(
    'success', true, 
    'copied', v_copied_count,
    'expected', v_expected_count,
    'total', v_total_products,
    'complete', v_total_products >= v_expected_count
  );
END;
$function$;

-- 3. Retroactive fix for stores with missing products
DO $$
DECLARE
  v_store RECORD;
  v_expected INTEGER;
  v_actual INTEGER;
  v_copied INTEGER;
BEGIN
  FOR v_store IN
    SELECT p.id, p.source_template_id, p.store_name
    FROM profiles p
    WHERE p.source_template_id IS NOT NULL AND p.template_applied = true
  LOOP
    SELECT COUNT(*) INTO v_expected
    FROM brand_template_products WHERE template_id = v_store.source_template_id AND is_active = true;
    
    SELECT COUNT(*) INTO v_actual FROM products WHERE user_id = v_store.id;
    
    IF v_actual < v_expected THEN
      v_copied := public.copy_template_products_to_store(v_store.source_template_id, v_store.id);
      SELECT COUNT(*) INTO v_actual FROM products WHERE user_id = v_store.id;
      
      IF v_actual >= v_expected THEN
        UPDATE profiles SET template_apply_status = 'applied', template_apply_error = null WHERE id = v_store.id;
      ELSE
        UPDATE profiles SET 
          template_apply_status = 'incomplete',
          template_apply_error = format('Backfill: expected %s, found %s', v_expected, v_actual)
        WHERE id = v_store.id;
      END IF;
    END IF;
  END LOOP;
END;
$$;
