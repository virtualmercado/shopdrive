-- Add missing column show_whatsapp_button to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS show_whatsapp_button boolean DEFAULT true;

-- Update the sync_template_from_profile function to handle the column correctly
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
  -- Get the source profile ID from the template
  SELECT source_profile_id INTO v_source_profile_id
  FROM brand_templates
  WHERE id = p_template_id;
  
  IF v_source_profile_id IS NULL THEN
    RAISE EXCEPTION 'Template does not have a source profile linked';
  END IF;
  
  -- Get profile data
  SELECT * INTO v_profile FROM profiles WHERE id = v_source_profile_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Source profile not found';
  END IF;
  
  -- Update template with profile snapshot
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
    banner_desktop_urls = v_profile.banner_desktop_urls,
    banner_mobile_urls = v_profile.banner_mobile_urls,
    whatsapp_number = v_profile.whatsapp_number,
    instagram_url = v_profile.instagram_url,
    facebook_url = v_profile.facebook_url,
    show_whatsapp_button = COALESCE(v_profile.show_whatsapp_button, true),
    updated_at = now()
  WHERE id = p_template_id;
  
  -- Sync products count
  UPDATE brand_templates SET
    products_count = (
      SELECT COUNT(*) FROM products 
      WHERE user_id = v_source_profile_id AND is_active = true
    )
  WHERE id = p_template_id;
  
  -- Delete existing template products and sync from profile
  DELETE FROM brand_template_products WHERE template_id = p_template_id;
  
  INSERT INTO brand_template_products (template_id, name, description, price, images, category, sku, is_active, display_order)
  SELECT 
    p_template_id,
    p.name,
    p.description,
    p.price,
    p.images,
    p.category,
    p.sku,
    p.is_active,
    ROW_NUMBER() OVER (ORDER BY p.created_at)
  FROM products p
  WHERE p.user_id = v_source_profile_id AND p.is_active = true
  LIMIT 20; -- Free plan limit
  
END;
$function$;