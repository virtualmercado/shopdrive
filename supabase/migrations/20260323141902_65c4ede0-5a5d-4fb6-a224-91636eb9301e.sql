
-- Fix existing cloned products with stock=0
UPDATE products p
SET stock = 999
FROM profiles pr
WHERE pr.id = p.user_id
  AND pr.source_template_id IS NOT NULL
  AND p.stock = 0;

-- Update copy_template_products_to_store to include stock=999
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

  INSERT INTO products (user_id, name, description, price, images, is_active, stock,
    weight, height, length, width, shipping_weight, variations, promotional_price, is_featured, is_new, brand_id)
  SELECT p_user_id, tp.name, tp.description, tp.price,
    CASE WHEN tp.images IS NOT NULL THEN to_jsonb(tp.images) ELSE NULL END, true, 999,
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

-- Update clone_template_to_store (no change needed for stock since copy_template_products_to_store handles it)
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
  
  PERFORM public.copy_template_products_to_store(p_template_id, p_user_id);
END;
$function$;

-- Update apply_template_to_existing_store to use updated copy function (stock handled there)
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
      RETURN jsonb_build_object('success', false, 'error', 'Store already has content. Use force=true to override.', 'products_found', v_product_count);
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
      v_cloned_products := public.copy_template_products_to_store(p_template_id, p_user_id);
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
