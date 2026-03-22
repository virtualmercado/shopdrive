-- Fix clone_template_to_store: products table uses category_id (uuid) not category (text), and has no sku column
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

  -- Clone products: brand_template_products.category is text, products.category_id is uuid
  -- We skip category mapping and set images from text[] to jsonb
  INSERT INTO products (user_id, name, description, price, images, is_active)
  SELECT 
    p_user_id, 
    tp.name, 
    tp.description, 
    tp.price, 
    CASE 
      WHEN tp.images IS NOT NULL THEN to_jsonb(tp.images)
      ELSE NULL
    END,
    COALESCE(tp.is_active, true)
  FROM brand_template_products tp
  WHERE tp.template_id = p_template_id AND tp.is_active = true;

  UPDATE brand_templates SET
    stores_created = stores_created + 1,
    updated_at = now()
  WHERE id = p_template_id;
END;
$function$;

-- Fix apply_template_to_existing_store with same column corrections
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
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Store already has content (products, banners, colors). Use force=true to override.',
        'products_found', v_product_count
      );
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

    IF p_force THEN
      DELETE FROM products WHERE user_id = p_user_id;
    END IF;

    SELECT COUNT(*) INTO v_product_count FROM products WHERE user_id = p_user_id;
    IF v_product_count = 0 THEN
      INSERT INTO products (user_id, name, description, price, images, is_active)
      SELECT 
        p_user_id, 
        tp.name, 
        tp.description, 
        tp.price, 
        CASE 
          WHEN tp.images IS NOT NULL THEN to_jsonb(tp.images)
          ELSE NULL
        END,
        COALESCE(tp.is_active, true)
      FROM brand_template_products tp
      WHERE tp.template_id = p_template_id AND tp.is_active = true;

      GET DIAGNOSTICS v_cloned_products = ROW_COUNT;
    END IF;

    SELECT COUNT(*) INTO v_product_count FROM products WHERE user_id = p_user_id;

    RETURN jsonb_build_object(
      'success', true,
      'products_cloned', v_cloned_products,
      'total_products', v_product_count,
      'template_name', v_template.name,
      'applied_at', now()
    );

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

-- Fix copy_template_products_to_store as well
CREATE OR REPLACE FUNCTION public.copy_template_products_to_store(p_template_id uuid, p_user_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  copied_count INTEGER := 0;
  template_product RECORD;
BEGIN
  FOR template_product IN 
    SELECT * FROM public.brand_template_products 
    WHERE template_id = p_template_id AND is_active = true
  LOOP
    INSERT INTO public.products (
      user_id, name, description, price, images, is_active
    ) VALUES (
      p_user_id,
      template_product.name,
      template_product.description,
      template_product.price,
      CASE 
        WHEN template_product.images IS NOT NULL THEN to_jsonb(template_product.images)
        ELSE NULL
      END,
      true
    );
    copied_count := copied_count + 1;
  END LOOP;
  
  UPDATE public.brand_templates
  SET stores_created = stores_created + 1
  WHERE id = p_template_id;
  
  RETURN copied_count;
END;
$function$;