
-- PART 1: Add missing columns to brand_templates
ALTER TABLE public.brand_templates
  ADD COLUMN IF NOT EXISTS banner_rect_1_url text,
  ADD COLUMN IF NOT EXISTS banner_rect_2_url text,
  ADD COLUMN IF NOT EXISTS minibanner_1_img2_url text,
  ADD COLUMN IF NOT EXISTS minibanner_2_img2_url text,
  ADD COLUMN IF NOT EXISTS selected_benefit_banners jsonb,
  ADD COLUMN IF NOT EXISTS content_banner_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS content_banner_title text,
  ADD COLUMN IF NOT EXISTS content_banner_subtitle text,
  ADD COLUMN IF NOT EXISTS content_banner_title_color text,
  ADD COLUMN IF NOT EXISTS content_banner_subtitle_color text,
  ADD COLUMN IF NOT EXISTS content_banner_url text,
  ADD COLUMN IF NOT EXISTS content_banner_image_url text,
  ADD COLUMN IF NOT EXISTS content_banners jsonb,
  ADD COLUMN IF NOT EXISTS about_us_text text,
  ADD COLUMN IF NOT EXISTS about_us_title text,
  ADD COLUMN IF NOT EXISTS return_policy_text text,
  ADD COLUMN IF NOT EXISTS topbar_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS topbar_bg_color text,
  ADD COLUMN IF NOT EXISTS topbar_text_color text,
  ADD COLUMN IF NOT EXISTS topbar_text text,
  ADD COLUMN IF NOT EXISTS topbar_link_type text,
  ADD COLUMN IF NOT EXISTS topbar_link_target text,
  ADD COLUMN IF NOT EXISTS header_logo_position text,
  ADD COLUMN IF NOT EXISTS store_layout text,
  ADD COLUMN IF NOT EXISTS store_model text,
  ADD COLUMN IF NOT EXISTS reviews_section_title text,
  ADD COLUMN IF NOT EXISTS home_video_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS home_video_provider text,
  ADD COLUMN IF NOT EXISTS home_video_id text,
  ADD COLUMN IF NOT EXISTS home_video_url_original text,
  ADD COLUMN IF NOT EXISTS home_video_title text,
  ADD COLUMN IF NOT EXISTS home_video_description text,
  ADD COLUMN IF NOT EXISTS price_color text,
  ADD COLUMN IF NOT EXISTS title_color text,
  ADD COLUMN IF NOT EXISTS x_url text,
  ADD COLUMN IF NOT EXISTS youtube_url text;

-- PART 2: Add missing columns to brand_template_products
ALTER TABLE public.brand_template_products
  ADD COLUMN IF NOT EXISTS weight numeric,
  ADD COLUMN IF NOT EXISTS height numeric,
  ADD COLUMN IF NOT EXISTS length numeric,
  ADD COLUMN IF NOT EXISTS width numeric,
  ADD COLUMN IF NOT EXISTS shipping_weight numeric,
  ADD COLUMN IF NOT EXISTS variations jsonb,
  ADD COLUMN IF NOT EXISTS brand_name text,
  ADD COLUMN IF NOT EXISTS promotional_price numeric,
  ADD COLUMN IF NOT EXISTS is_featured boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_new boolean DEFAULT false;

-- PART 3: Update sync_template_from_profile to sync ALL fields
CREATE OR REPLACE FUNCTION public.sync_template_from_profile(p_template_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_profile RECORD;
  v_source_profile_id UUID;
BEGIN
  SELECT source_profile_id INTO v_source_profile_id
  FROM brand_templates WHERE id = p_template_id;
  IF v_source_profile_id IS NULL THEN
    RAISE EXCEPTION 'Template does not have a source profile linked';
  END IF;
  SELECT * INTO v_profile FROM profiles WHERE id = v_source_profile_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Source profile not found';
  END IF;
  UPDATE brand_templates SET
    store_name = v_profile.store_name,
    logo_url = v_profile.store_logo_url,
    primary_color = v_profile.primary_color,
    secondary_color = v_profile.secondary_color,
    font_family = v_profile.font_family,
    button_bg_color = v_profile.button_bg_color,
    button_text_color = v_profile.button_text_color,
    footer_bg_color = v_profile.footer_bg_color,
    footer_text_color = v_profile.footer_text_color,
    price_color = v_profile.price_color,
    title_color = v_profile.title_color,
    banner_desktop_urls = v_profile.banner_desktop_urls,
    banner_mobile_urls = v_profile.banner_mobile_urls,
    banner_rect_1_url = v_profile.banner_rect_1_url,
    banner_rect_2_url = v_profile.banner_rect_2_url,
    minibanner_1_img2_url = v_profile.minibanner_1_img2_url,
    minibanner_2_img2_url = v_profile.minibanner_2_img2_url,
    selected_benefit_banners = v_profile.selected_benefit_banners,
    content_banner_enabled = v_profile.content_banner_enabled,
    content_banner_title = v_profile.content_banner_title,
    content_banner_subtitle = v_profile.content_banner_subtitle,
    content_banner_title_color = v_profile.content_banner_title_color,
    content_banner_subtitle_color = v_profile.content_banner_subtitle_color,
    content_banner_url = v_profile.content_banner_url,
    content_banner_image_url = v_profile.content_banner_image_url,
    content_banners = v_profile.content_banners,
    about_us_text = v_profile.about_us_text,
    about_us_title = v_profile.about_us_title,
    return_policy_text = v_profile.return_policy_text,
    topbar_enabled = v_profile.topbar_enabled,
    topbar_bg_color = v_profile.topbar_bg_color,
    topbar_text_color = v_profile.topbar_text_color,
    topbar_text = v_profile.topbar_text,
    topbar_link_type = v_profile.topbar_link_type,
    topbar_link_target = v_profile.topbar_link_target,
    header_logo_position = v_profile.header_logo_position,
    store_layout = v_profile.store_layout,
    store_model = v_profile.store_model,
    reviews_section_title = v_profile.reviews_section_title,
    home_video_enabled = v_profile.home_video_enabled,
    home_video_provider = v_profile.home_video_provider,
    home_video_id = v_profile.home_video_id,
    home_video_url_original = v_profile.home_video_url_original,
    home_video_title = v_profile.home_video_title,
    home_video_description = v_profile.home_video_description,
    whatsapp_number = v_profile.whatsapp_number,
    instagram_url = v_profile.instagram_url,
    facebook_url = v_profile.facebook_url,
    x_url = v_profile.x_url,
    youtube_url = v_profile.youtube_url,
    show_whatsapp_button = COALESCE(v_profile.show_whatsapp_button, true),
    updated_at = now()
  WHERE id = p_template_id;
  UPDATE brand_templates SET
    products_count = (SELECT COUNT(*) FROM products WHERE user_id = v_source_profile_id)
  WHERE id = p_template_id;
  DELETE FROM brand_template_products WHERE template_id = p_template_id;
  INSERT INTO brand_template_products (
    template_id, name, description, price, images, category, sku,
    is_active, display_order, weight, height, length, width,
    shipping_weight, variations, brand_name, promotional_price,
    is_featured, is_new
  )
  SELECT 
    p_template_id, p.name, p.description, p.price,
    CASE 
      WHEN p.images IS NULL THEN NULL
      WHEN jsonb_typeof(p.images) = 'array' THEN ARRAY(SELECT jsonb_array_elements_text(p.images))
      ELSE NULL
    END,
    COALESCE((SELECT pc.name FROM product_categories pc WHERE pc.id = p.category_id), 'Geral'),
    NULL, true,
    ROW_NUMBER() OVER (ORDER BY p.created_at),
    p.weight, p.height, p.length, p.width, p.shipping_weight,
    p.variations,
    (SELECT pb.name FROM product_brands pb WHERE pb.id = p.brand_id),
    p.promotional_price,
    COALESCE(p.is_featured, false),
    COALESCE(p.is_new, false)
  FROM products p
  WHERE p.user_id = v_source_profile_id AND p.is_active = true
  LIMIT 20;
END;
$function$;

-- PART 4: Update clone_template_to_store with ALL fields
CREATE OR REPLACE FUNCTION public.clone_template_to_store(p_template_id uuid, p_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_template RECORD;
  v_new_slug TEXT;
  v_store_name TEXT;
BEGIN
  SELECT * INTO v_template FROM brand_templates WHERE id = p_template_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Template not found';
  END IF;
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
    template_apply_status = 'applied',
    template_apply_error = null,
    updated_at = now()
  WHERE id = p_user_id;
  -- Create brands first
  INSERT INTO product_brands (user_id, name, is_active)
  SELECT DISTINCT p_user_id, tp.brand_name, true
  FROM brand_template_products tp
  WHERE tp.template_id = p_template_id 
    AND tp.is_active = true AND tp.brand_name IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM product_brands pb WHERE pb.user_id = p_user_id AND pb.name = tp.brand_name
    );
  -- Clone products with ALL metadata
  INSERT INTO products (
    user_id, name, description, price, images, is_active,
    weight, height, length, width, shipping_weight,
    variations, promotional_price, is_featured, is_new, brand_id
  )
  SELECT 
    p_user_id, tp.name, tp.description, tp.price,
    CASE WHEN tp.images IS NOT NULL THEN to_jsonb(tp.images) ELSE NULL END,
    COALESCE(tp.is_active, true),
    tp.weight, tp.height, tp.length, tp.width, tp.shipping_weight,
    tp.variations, tp.promotional_price,
    COALESCE(tp.is_featured, false), COALESCE(tp.is_new, false),
    (SELECT pb.id FROM product_brands pb WHERE pb.user_id = p_user_id AND pb.name = tp.brand_name LIMIT 1)
  FROM brand_template_products tp
  WHERE tp.template_id = p_template_id AND tp.is_active = true;
  UPDATE brand_templates SET stores_created = stores_created + 1, updated_at = now()
  WHERE id = p_template_id;
END;
$function$;

-- PART 5: Update apply_template_to_existing_store with ALL fields
CREATE OR REPLACE FUNCTION public.apply_template_to_existing_store(p_user_id uuid, p_template_id uuid, p_force boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_template RECORD;
  v_profile RECORD;
  v_product_count INTEGER;
  v_has_banners BOOLEAN;
  v_has_colors BOOLEAN;
  v_cloned_products INTEGER := 0;
BEGIN
  SELECT * INTO v_profile FROM profiles WHERE id = p_user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Profile not found');
  END IF;
  SELECT * INTO v_template FROM brand_templates WHERE id = p_template_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Template not found');
  END IF;
  IF v_profile.template_applied = true AND v_profile.template_apply_status = 'applied' AND NOT p_force THEN
    RETURN jsonb_build_object('success', false, 'error', 'Template already applied. Use force=true to reapply.');
  END IF;
  IF NOT p_force THEN
    SELECT COUNT(*) INTO v_product_count FROM products WHERE user_id = p_user_id;
    v_has_banners := (v_profile.banner_desktop_urls IS NOT NULL AND v_profile.banner_desktop_urls::text != '[]' AND v_profile.banner_desktop_urls::text != 'null');
    v_has_colors := (v_profile.primary_color IS NOT NULL AND v_profile.primary_color != '#000000');
    IF v_product_count > 0 AND v_has_banners AND v_has_colors THEN
      RETURN jsonb_build_object('success', false, 'error', 'Store already has content (products, banners, colors). Use force=true to override.', 'products_found', v_product_count);
    END IF;
  END IF;
  BEGIN
    UPDATE profiles SET
      store_logo_url = COALESCE(v_template.logo_url, store_logo_url),
      primary_color = COALESCE(v_template.primary_color, primary_color),
      secondary_color = COALESCE(v_template.secondary_color, secondary_color),
      font_family = COALESCE(v_template.font_family, font_family),
      button_bg_color = COALESCE(v_template.button_bg_color, button_bg_color),
      button_text_color = COALESCE(v_template.button_text_color, button_text_color),
      footer_bg_color = COALESCE(v_template.footer_bg_color, footer_bg_color),
      footer_text_color = COALESCE(v_template.footer_text_color, footer_text_color),
      price_color = COALESCE(v_template.price_color, price_color),
      title_color = COALESCE(v_template.title_color, title_color),
      banner_desktop_urls = COALESCE(v_template.banner_desktop_urls, banner_desktop_urls),
      banner_mobile_urls = COALESCE(v_template.banner_mobile_urls, banner_mobile_urls),
      banner_rect_1_url = COALESCE(v_template.banner_rect_1_url, banner_rect_1_url),
      banner_rect_2_url = COALESCE(v_template.banner_rect_2_url, banner_rect_2_url),
      minibanner_1_img2_url = COALESCE(v_template.minibanner_1_img2_url, minibanner_1_img2_url),
      minibanner_2_img2_url = COALESCE(v_template.minibanner_2_img2_url, minibanner_2_img2_url),
      selected_benefit_banners = COALESCE(v_template.selected_benefit_banners, selected_benefit_banners),
      content_banner_enabled = COALESCE(v_template.content_banner_enabled, content_banner_enabled),
      content_banner_title = COALESCE(v_template.content_banner_title, content_banner_title),
      content_banner_subtitle = COALESCE(v_template.content_banner_subtitle, content_banner_subtitle),
      content_banner_title_color = COALESCE(v_template.content_banner_title_color, content_banner_title_color),
      content_banner_subtitle_color = COALESCE(v_template.content_banner_subtitle_color, content_banner_subtitle_color),
      content_banner_url = COALESCE(v_template.content_banner_url, content_banner_url),
      content_banner_image_url = COALESCE(v_template.content_banner_image_url, content_banner_image_url),
      content_banners = COALESCE(v_template.content_banners, content_banners),
      about_us_text = COALESCE(v_template.about_us_text, about_us_text),
      about_us_title = COALESCE(v_template.about_us_title, about_us_title),
      return_policy_text = COALESCE(v_template.return_policy_text, return_policy_text),
      topbar_enabled = COALESCE(v_template.topbar_enabled, topbar_enabled),
      topbar_bg_color = COALESCE(v_template.topbar_bg_color, topbar_bg_color),
      topbar_text_color = COALESCE(v_template.topbar_text_color, topbar_text_color),
      topbar_text = COALESCE(v_template.topbar_text, topbar_text),
      topbar_link_type = COALESCE(v_template.topbar_link_type, topbar_link_type),
      topbar_link_target = COALESCE(v_template.topbar_link_target, topbar_link_target),
      header_logo_position = COALESCE(v_template.header_logo_position, header_logo_position),
      store_layout = COALESCE(v_template.store_layout, store_layout),
      store_model = COALESCE(v_template.store_model, store_model),
      reviews_section_title = COALESCE(v_template.reviews_section_title, reviews_section_title),
      home_video_enabled = COALESCE(v_template.home_video_enabled, home_video_enabled),
      home_video_provider = COALESCE(v_template.home_video_provider, home_video_provider),
      home_video_id = COALESCE(v_template.home_video_id, home_video_id),
      home_video_url_original = COALESCE(v_template.home_video_url_original, home_video_url_original),
      home_video_title = COALESCE(v_template.home_video_title, home_video_title),
      home_video_description = COALESCE(v_template.home_video_description, home_video_description),
      whatsapp_number = COALESCE(v_template.whatsapp_number, whatsapp_number),
      instagram_url = COALESCE(v_template.instagram_url, instagram_url),
      facebook_url = COALESCE(v_template.facebook_url, facebook_url),
      x_url = COALESCE(v_template.x_url, x_url),
      youtube_url = COALESCE(v_template.youtube_url, youtube_url),
      show_whatsapp_button = COALESCE(v_template.show_whatsapp_button, show_whatsapp_button),
      source_template_id = p_template_id,
      template_applied = true,
      template_applied_at = now(),
      template_apply_status = 'applied',
      template_apply_error = null,
      updated_at = now()
    WHERE id = p_user_id;
    IF p_force THEN
      DELETE FROM products WHERE user_id = p_user_id;
    END IF;
    SELECT COUNT(*) INTO v_product_count FROM products WHERE user_id = p_user_id;
    IF v_product_count = 0 THEN
      INSERT INTO product_brands (user_id, name, is_active)
      SELECT DISTINCT p_user_id, tp.brand_name, true
      FROM brand_template_products tp
      WHERE tp.template_id = p_template_id AND tp.is_active = true AND tp.brand_name IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM product_brands pb WHERE pb.user_id = p_user_id AND pb.name = tp.brand_name);
      INSERT INTO products (user_id, name, description, price, images, is_active,
        weight, height, length, width, shipping_weight, variations, promotional_price, is_featured, is_new, brand_id)
      SELECT p_user_id, tp.name, tp.description, tp.price,
        CASE WHEN tp.images IS NOT NULL THEN to_jsonb(tp.images) ELSE NULL END,
        COALESCE(tp.is_active, true),
        tp.weight, tp.height, tp.length, tp.width, tp.shipping_weight,
        tp.variations, tp.promotional_price,
        COALESCE(tp.is_featured, false), COALESCE(tp.is_new, false),
        (SELECT pb.id FROM product_brands pb WHERE pb.user_id = p_user_id AND pb.name = tp.brand_name LIMIT 1)
      FROM brand_template_products tp
      WHERE tp.template_id = p_template_id AND tp.is_active = true;
      GET DIAGNOSTICS v_cloned_products = ROW_COUNT;
    END IF;
    SELECT COUNT(*) INTO v_product_count FROM products WHERE user_id = p_user_id;
    RETURN jsonb_build_object('success', true, 'products_cloned', v_cloned_products, 'total_products', v_product_count, 'template_name', v_template.name, 'applied_at', now());
  EXCEPTION WHEN OTHERS THEN
    UPDATE profiles SET template_applied = false, template_apply_status = 'failed', template_apply_error = SQLERRM, updated_at = now()
    WHERE id = p_user_id;
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
  END;
END;
$function$;

-- PART 6: Update copy_template_products_to_store with ALL fields
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
  INSERT INTO products (user_id, name, description, price, images, is_active,
    weight, height, length, width, shipping_weight, variations, promotional_price, is_featured, is_new, brand_id)
  SELECT p_user_id, tp.name, tp.description, tp.price,
    CASE WHEN tp.images IS NOT NULL THEN to_jsonb(tp.images) ELSE NULL END, true,
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
