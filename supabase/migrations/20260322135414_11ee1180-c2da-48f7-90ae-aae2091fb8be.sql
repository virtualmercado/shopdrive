-- Update clone_template_to_store to set tracking fields
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
    store_name = v_store_name,
    store_slug = v_new_slug,
    store_logo_url = v_template.logo_url,
    primary_color = COALESCE(v_template.primary_color, '#000000'),
    secondary_color = COALESCE(v_template.secondary_color, '#ffffff'),
    font_family = v_template.font_family,
    button_bg_color = v_template.button_bg_color,
    button_text_color = v_template.button_text_color,
    footer_bg_color = v_template.footer_bg_color,
    footer_text_color = v_template.footer_text_color,
    banner_desktop_urls = COALESCE(v_template.banner_desktop_urls, '[]'::jsonb),
    banner_mobile_urls = COALESCE(v_template.banner_mobile_urls, '[]'::jsonb),
    whatsapp_number = v_template.whatsapp_number,
    instagram_url = v_template.instagram_url,
    facebook_url = v_template.facebook_url,
    show_whatsapp_button = COALESCE(v_template.show_whatsapp_button, true),
    source_template_id = p_template_id,
    template_applied = true,
    template_applied_at = now(),
    template_apply_status = 'applied',
    template_apply_error = null,
    updated_at = now()
  WHERE id = p_user_id;

  INSERT INTO products (user_id, name, description, price, images, category, sku, is_active)
  SELECT 
    p_user_id, tp.name, tp.description, tp.price, tp.images, tp.category, tp.sku, tp.is_active
  FROM brand_template_products tp
  WHERE tp.template_id = p_template_id AND tp.is_active = true;

  UPDATE brand_templates SET
    stores_created = stores_created + 1,
    updated_at = now()
  WHERE id = p_template_id;
END;
$function$;

-- Create apply_template_to_existing_store with safe/force modes
CREATE OR REPLACE FUNCTION public.apply_template_to_existing_store(
  p_user_id uuid,
  p_template_id uuid,
  p_force boolean DEFAULT false
)
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
  v_result jsonb;
  v_cloned_products INTEGER := 0;
BEGIN
  -- Validate profile exists
  SELECT * INTO v_profile FROM profiles WHERE id = p_user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Profile not found');
  END IF;

  -- Validate template exists
  SELECT * INTO v_template FROM brand_templates WHERE id = p_template_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Template not found');
  END IF;

  -- Check if already applied
  IF v_profile.template_applied = true AND v_profile.template_apply_status = 'applied' AND NOT p_force THEN
    RETURN jsonb_build_object('success', false, 'error', 'Template already applied. Use force=true to reapply.');
  END IF;

  -- Safe mode: check if store has existing content
  IF NOT p_force THEN
    SELECT COUNT(*) INTO v_product_count FROM products WHERE user_id = p_user_id;
    v_has_banners := (v_profile.banner_desktop_urls IS NOT NULL AND v_profile.banner_desktop_urls::text != '[]');
    v_has_colors := (v_profile.primary_color IS NOT NULL AND v_profile.primary_color != '#000000');

    IF v_product_count > 0 AND v_has_banners AND v_has_colors THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Store already has content (products, banners, colors). Use force=true to override.',
        'products_found', v_product_count
      );
    END IF;
  END IF;

  -- Apply template data to profile
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
      banner_desktop_urls = COALESCE(v_template.banner_desktop_urls, banner_desktop_urls),
      banner_mobile_urls = COALESCE(v_template.banner_mobile_urls, banner_mobile_urls),
      whatsapp_number = COALESCE(v_template.whatsapp_number, whatsapp_number),
      instagram_url = COALESCE(v_template.instagram_url, instagram_url),
      facebook_url = COALESCE(v_template.facebook_url, facebook_url),
      show_whatsapp_button = COALESCE(v_template.show_whatsapp_button, show_whatsapp_button),
      source_template_id = p_template_id,
      template_applied = true,
      template_applied_at = now(),
      template_apply_status = 'applied',
      template_apply_error = null,
      updated_at = now()
    WHERE id = p_user_id;

    -- Clone products (skip if force=false and products exist)
    IF p_force THEN
      DELETE FROM products WHERE user_id = p_user_id;
    END IF;

    SELECT COUNT(*) INTO v_product_count FROM products WHERE user_id = p_user_id;
    IF v_product_count = 0 THEN
      INSERT INTO products (user_id, name, description, price, images, category, sku, is_active)
      SELECT p_user_id, tp.name, tp.description, tp.price, tp.images, tp.category, tp.sku, tp.is_active
      FROM brand_template_products tp
      WHERE tp.template_id = p_template_id AND tp.is_active = true;

      GET DIAGNOSTICS v_cloned_products = ROW_COUNT;
    END IF;

    -- Validation
    SELECT COUNT(*) INTO v_product_count FROM products WHERE user_id = p_user_id;

    v_result := jsonb_build_object(
      'success', true,
      'products_cloned', v_cloned_products,
      'total_products', v_product_count,
      'template_name', v_template.name,
      'applied_at', now()
    );

    RETURN v_result;

  EXCEPTION WHEN OTHERS THEN
    UPDATE profiles SET
      template_applied = false,
      template_apply_status = 'failed',
      template_apply_error = SQLERRM,
      updated_at = now()
    WHERE id = p_user_id;

    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
  END;
END;
$function$;

-- Create backfill function for batch retroactive fix
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
  v_details jsonb := '[]'::jsonb;
BEGIN
  FOR v_store IN
    SELECT p.id as user_id, p.source_template_id, p.store_name, p.template_apply_status
    FROM profiles p
    WHERE p.source_template_id IS NOT NULL
      AND (p.template_applied = false OR p.template_apply_status IN ('pending', 'failed'))
  LOOP
    v_total := v_total + 1;

    v_result := public.apply_template_to_existing_store(
      v_store.user_id,
      v_store.source_template_id,
      false  -- safe mode only
    );

    IF (v_result->>'success')::boolean THEN
      v_success := v_success + 1;
    ELSE
      IF v_result->>'error' LIKE '%already has content%' THEN
        v_skipped := v_skipped + 1;
      ELSE
        v_failed := v_failed + 1;
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
    'details', v_details
  );
END;
$function$;