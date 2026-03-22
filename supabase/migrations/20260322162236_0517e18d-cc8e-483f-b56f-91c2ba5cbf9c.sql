
-- Function to complement incomplete template data on existing stores
-- This fills missing fields WITHOUT deleting/overwriting existing data
CREATE OR REPLACE FUNCTION public.complement_template_data(p_user_id uuid, p_template_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_template RECORD;
  v_profile RECORD;
  v_updated_products INTEGER := 0;
  v_created_brands INTEGER := 0;
  v_profile_fields_updated INTEGER := 0;
BEGIN
  SELECT * INTO v_profile FROM profiles WHERE id = p_user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Profile not found');
  END IF;

  SELECT * INTO v_template FROM brand_templates WHERE id = p_template_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Template not found');
  END IF;

  BEGIN
    -- Complement profile fields ONLY where currently empty/null
    UPDATE profiles SET
      banner_rect_1_url = CASE WHEN banner_rect_1_url IS NULL THEN v_template.banner_rect_1_url ELSE banner_rect_1_url END,
      banner_rect_2_url = CASE WHEN banner_rect_2_url IS NULL THEN v_template.banner_rect_2_url ELSE banner_rect_2_url END,
      minibanner_1_img2_url = CASE WHEN minibanner_1_img2_url IS NULL THEN v_template.minibanner_1_img2_url ELSE minibanner_1_img2_url END,
      minibanner_2_img2_url = CASE WHEN minibanner_2_img2_url IS NULL THEN v_template.minibanner_2_img2_url ELSE minibanner_2_img2_url END,
      selected_benefit_banners = CASE WHEN selected_benefit_banners IS NULL THEN v_template.selected_benefit_banners ELSE selected_benefit_banners END,
      content_banner_enabled = CASE WHEN content_banner_enabled IS NULL OR content_banner_enabled = false THEN COALESCE(v_template.content_banner_enabled, false) ELSE content_banner_enabled END,
      content_banner_title = CASE WHEN content_banner_title IS NULL THEN v_template.content_banner_title ELSE content_banner_title END,
      content_banner_subtitle = CASE WHEN content_banner_subtitle IS NULL THEN v_template.content_banner_subtitle ELSE content_banner_subtitle END,
      content_banner_title_color = CASE WHEN content_banner_title_color IS NULL THEN v_template.content_banner_title_color ELSE content_banner_title_color END,
      content_banner_subtitle_color = CASE WHEN content_banner_subtitle_color IS NULL THEN v_template.content_banner_subtitle_color ELSE content_banner_subtitle_color END,
      content_banner_url = CASE WHEN content_banner_url IS NULL THEN v_template.content_banner_url ELSE content_banner_url END,
      content_banner_image_url = CASE WHEN content_banner_image_url IS NULL THEN v_template.content_banner_image_url ELSE content_banner_image_url END,
      content_banners = CASE WHEN content_banners IS NULL THEN v_template.content_banners ELSE content_banners END,
      about_us_text = CASE WHEN about_us_text IS NULL THEN v_template.about_us_text ELSE about_us_text END,
      about_us_title = CASE WHEN about_us_title IS NULL THEN v_template.about_us_title ELSE about_us_title END,
      return_policy_text = CASE WHEN return_policy_text IS NULL THEN v_template.return_policy_text ELSE return_policy_text END,
      topbar_enabled = CASE WHEN topbar_enabled IS NULL OR topbar_enabled = false THEN COALESCE(v_template.topbar_enabled, false) ELSE topbar_enabled END,
      topbar_bg_color = CASE WHEN topbar_bg_color IS NULL THEN v_template.topbar_bg_color ELSE topbar_bg_color END,
      topbar_text_color = CASE WHEN topbar_text_color IS NULL THEN v_template.topbar_text_color ELSE topbar_text_color END,
      topbar_text = CASE WHEN topbar_text IS NULL THEN v_template.topbar_text ELSE topbar_text END,
      topbar_link_type = CASE WHEN topbar_link_type IS NULL THEN v_template.topbar_link_type ELSE topbar_link_type END,
      topbar_link_target = CASE WHEN topbar_link_target IS NULL THEN v_template.topbar_link_target ELSE topbar_link_target END,
      header_logo_position = CASE WHEN header_logo_position IS NULL THEN v_template.header_logo_position ELSE header_logo_position END,
      store_layout = CASE WHEN store_layout IS NULL THEN v_template.store_layout ELSE store_layout END,
      reviews_section_title = CASE WHEN reviews_section_title IS NULL THEN v_template.reviews_section_title ELSE reviews_section_title END,
      home_video_enabled = CASE WHEN home_video_enabled IS NULL OR home_video_enabled = false THEN COALESCE(v_template.home_video_enabled, false) ELSE home_video_enabled END,
      home_video_provider = CASE WHEN home_video_provider IS NULL THEN v_template.home_video_provider ELSE home_video_provider END,
      home_video_id = CASE WHEN home_video_id IS NULL THEN v_template.home_video_id ELSE home_video_id END,
      home_video_url_original = CASE WHEN home_video_url_original IS NULL THEN v_template.home_video_url_original ELSE home_video_url_original END,
      home_video_title = CASE WHEN home_video_title IS NULL THEN v_template.home_video_title ELSE home_video_title END,
      home_video_description = CASE WHEN home_video_description IS NULL THEN v_template.home_video_description ELSE home_video_description END,
      x_url = CASE WHEN x_url IS NULL THEN v_template.x_url ELSE x_url END,
      youtube_url = CASE WHEN youtube_url IS NULL THEN v_template.youtube_url ELSE youtube_url END,
      price_color = CASE WHEN price_color IS NULL THEN v_template.price_color ELSE price_color END,
      title_color = CASE WHEN title_color IS NULL THEN v_template.title_color ELSE title_color END,
      updated_at = now()
    WHERE id = p_user_id;
    GET DIAGNOSTICS v_profile_fields_updated = ROW_COUNT;

    -- Create missing brands for this user
    INSERT INTO product_brands (user_id, name, is_active)
    SELECT DISTINCT p_user_id, tp.brand_name, true
    FROM brand_template_products tp
    WHERE tp.template_id = p_template_id AND tp.is_active = true AND tp.brand_name IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM product_brands pb WHERE pb.user_id = p_user_id AND pb.name = tp.brand_name);
    GET DIAGNOSTICS v_created_brands = ROW_COUNT;

    -- Update existing products: fill in missing metadata by matching product name
    UPDATE products p SET
      brand_id = CASE WHEN p.brand_id IS NULL THEN 
        (SELECT pb.id FROM product_brands pb WHERE pb.user_id = p_user_id AND pb.name = tp.brand_name LIMIT 1)
      ELSE p.brand_id END,
      weight = CASE WHEN p.weight IS NULL THEN tp.weight ELSE p.weight END,
      height = CASE WHEN p.height IS NULL THEN tp.height ELSE p.height END,
      length = CASE WHEN p.length IS NULL THEN tp.length ELSE p.length END,
      width = CASE WHEN p.width IS NULL THEN tp.width ELSE p.width END,
      shipping_weight = CASE WHEN p.shipping_weight IS NULL THEN tp.shipping_weight ELSE p.shipping_weight END,
      variations = CASE WHEN p.variations IS NULL THEN tp.variations ELSE p.variations END,
      promotional_price = CASE WHEN p.promotional_price IS NULL THEN tp.promotional_price ELSE p.promotional_price END,
      is_featured = CASE WHEN p.is_featured IS NULL OR p.is_featured = false THEN COALESCE(tp.is_featured, false) ELSE p.is_featured END,
      is_new = CASE WHEN p.is_new IS NULL OR p.is_new = false THEN COALESCE(tp.is_new, false) ELSE p.is_new END
    FROM brand_template_products tp
    WHERE p.user_id = p_user_id
      AND tp.template_id = p_template_id
      AND tp.is_active = true
      AND p.name = tp.name;
    GET DIAGNOSTICS v_updated_products = ROW_COUNT;

    -- Update tracking status
    UPDATE profiles SET
      template_apply_status = 'applied',
      template_apply_error = null,
      updated_at = now()
    WHERE id = p_user_id;

    RETURN jsonb_build_object(
      'success', true,
      'profile_updated', v_profile_fields_updated,
      'brands_created', v_created_brands,
      'products_complemented', v_updated_products
    );

  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
  END;
END;
$function$;

-- Update backfill to also process "applied but incomplete" stores
CREATE OR REPLACE FUNCTION public.backfill_partner_templates()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_store RECORD;
  v_result jsonb;
  v_total INTEGER := 0;
  v_success INTEGER := 0;
  v_failed INTEGER := 0;
  v_skipped INTEGER := 0;
  v_complemented INTEGER := 0;
  v_details jsonb := '[]'::jsonb;
  v_has_products BOOLEAN;
  v_products_missing_brand INTEGER;
  v_products_missing_weight INTEGER;
BEGIN
  -- Process stores that need full apply OR complement
  FOR v_store IN
    SELECT p.id as user_id, p.source_template_id, p.store_name, 
           p.template_apply_status, p.template_applied,
           p.banner_rect_1_url, p.selected_benefit_banners, p.content_banner_enabled
    FROM profiles p
    WHERE p.source_template_id IS NOT NULL
  LOOP
    v_total := v_total + 1;

    -- Check if needs full apply (never applied)
    IF v_store.template_applied = false OR v_store.template_apply_status IN ('pending', 'failed') THEN
      v_result := public.apply_template_to_existing_store(v_store.user_id, v_store.source_template_id, false);
      IF (v_result->>'success')::boolean THEN
        v_success := v_success + 1;
      ELSE
        IF v_result->>'error' LIKE '%already has content%' THEN
          v_skipped := v_skipped + 1;
        ELSE
          v_failed := v_failed + 1;
        END IF;
      END IF;
    ELSE
      -- Already applied: check if needs complement
      SELECT COUNT(*) > 0 INTO v_has_products FROM products WHERE user_id = v_store.user_id;
      SELECT COUNT(*) INTO v_products_missing_brand FROM products WHERE user_id = v_store.user_id AND brand_id IS NULL;
      SELECT COUNT(*) INTO v_products_missing_weight FROM products WHERE user_id = v_store.user_id AND weight IS NULL;

      IF v_products_missing_brand > 0 OR v_products_missing_weight > 0 
         OR v_store.banner_rect_1_url IS NULL OR v_store.selected_benefit_banners IS NULL THEN
        v_result := public.complement_template_data(v_store.user_id, v_store.source_template_id);
        IF (v_result->>'success')::boolean THEN
          v_complemented := v_complemented + 1;
        ELSE
          v_failed := v_failed + 1;
        END IF;
      ELSE
        v_skipped := v_skipped + 1;
        v_result := jsonb_build_object('skipped', true, 'reason', 'already complete');
      END IF;
    END IF;

    v_details := v_details || jsonb_build_object(
      'user_id', v_store.user_id,
      'template_id', v_store.source_template_id,
      'store_name', v_store.store_name,
      'result', v_result
    );
  END LOOP;

  RETURN jsonb_build_object(
    'total_processed', v_total,
    'success', v_success,
    'failed', v_failed,
    'skipped', v_skipped,
    'complemented', v_complemented,
    'details', v_details
  );
END;
$function$;
