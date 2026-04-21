-- Fix content_banners propagation: treat empty array as "missing" so COALESCE propagates from template

-- 1) clone_template_to_store: overwrite content_banners when store's is empty
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

-- 2) apply_template_to_existing_store: treat empty content_banners as missing
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
      -- Treat empty array as missing so we propagate template's structured banners
      content_banners = CASE
        WHEN v_template.content_banners IS NOT NULL
             AND jsonb_typeof(v_template.content_banners) = 'array'
             AND jsonb_array_length(v_template.content_banners) > 0
             AND (
               content_banners IS NULL
               OR jsonb_typeof(content_banners) <> 'array'
               OR jsonb_array_length(content_banners) = 0
             )
        THEN v_template.content_banners
        ELSE COALESCE(content_banners, v_template.content_banners)
      END,
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

-- 3) Dedicated propagation helper for content banner (idempotent, never overwrites manual config)
CREATE OR REPLACE FUNCTION public.propagate_content_banner_from_template(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_profile RECORD;
  v_template RECORD;
  v_should_apply BOOLEAN;
BEGIN
  SELECT id, source_template_id, content_banners, content_banner_enabled, content_banner_image_url
    INTO v_profile FROM profiles WHERE id = p_user_id;
  IF NOT FOUND OR v_profile.source_template_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'no_template_link');
  END IF;

  SELECT content_banners, content_banner_enabled, content_banner_image_url,
         content_banner_title, content_banner_subtitle, content_banner_url,
         content_banner_title_color, content_banner_subtitle_color
    INTO v_template FROM brand_templates WHERE id = v_profile.source_template_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'template_not_found');
  END IF;

  -- Manual override protection: store has structured banner already populated
  IF v_profile.content_banners IS NOT NULL
     AND jsonb_typeof(v_profile.content_banners) = 'array'
     AND jsonb_array_length(v_profile.content_banners) > 0 THEN
    RETURN jsonb_build_object('success', true, 'skipped', true, 'reason', 'store_already_has_banners');
  END IF;

  v_should_apply := v_template.content_banners IS NOT NULL
                AND jsonb_typeof(v_template.content_banners) = 'array'
                AND jsonb_array_length(v_template.content_banners) > 0;

  IF NOT v_should_apply THEN
    RETURN jsonb_build_object('success', true, 'skipped', true, 'reason', 'template_has_no_banners');
  END IF;

  UPDATE profiles SET
    content_banners = v_template.content_banners,
    content_banner_enabled = COALESCE(content_banner_enabled, v_template.content_banner_enabled),
    content_banner_image_url = COALESCE(content_banner_image_url, v_template.content_banner_image_url),
    content_banner_title = COALESCE(content_banner_title, v_template.content_banner_title),
    content_banner_subtitle = COALESCE(content_banner_subtitle, v_template.content_banner_subtitle),
    content_banner_url = COALESCE(content_banner_url, v_template.content_banner_url),
    content_banner_title_color = COALESCE(content_banner_title_color, v_template.content_banner_title_color),
    content_banner_subtitle_color = COALESCE(content_banner_subtitle_color, v_template.content_banner_subtitle_color),
    updated_at = now()
  WHERE id = p_user_id;

  RETURN jsonb_build_object('success', true, 'applied', true);
END;
$$;

-- 4) Backfill: apply content_banners to all linked stores that are missing it
DO $$
DECLARE
  r RECORD;
  v_count INTEGER := 0;
BEGIN
  FOR r IN
    SELECT p.id
    FROM profiles p
    JOIN brand_templates t ON t.id = p.source_template_id
    WHERE p.source_template_id IS NOT NULL
      AND t.content_banners IS NOT NULL
      AND jsonb_typeof(t.content_banners) = 'array'
      AND jsonb_array_length(t.content_banners) > 0
      AND (
        p.content_banners IS NULL
        OR jsonb_typeof(p.content_banners) <> 'array'
        OR jsonb_array_length(p.content_banners) = 0
      )
  LOOP
    PERFORM public.propagate_content_banner_from_template(r.id);
    v_count := v_count + 1;
  END LOOP;
  RAISE NOTICE 'Content banner backfill applied to % stores', v_count;
END $$;