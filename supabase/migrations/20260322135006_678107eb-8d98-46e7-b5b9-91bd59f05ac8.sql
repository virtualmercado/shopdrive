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

  -- Generate a unique store slug for the new store
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
    updated_at = now()
  WHERE id = p_user_id;
  
  INSERT INTO products (user_id, name, description, price, images, category, sku, is_active)
  SELECT 
    p_user_id,
    tp.name,
    tp.description,
    tp.price,
    tp.images,
    tp.category,
    tp.sku,
    tp.is_active
  FROM brand_template_products tp
  WHERE tp.template_id = p_template_id AND tp.is_active = true;
  
  UPDATE brand_templates SET
    stores_created = stores_created + 1,
    updated_at = now()
  WHERE id = p_template_id;
  
END;
$function$;