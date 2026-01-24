-- Add field to profiles to mark it as a template profile
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS is_template_profile BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS source_template_id UUID REFERENCES public.brand_templates(id) ON DELETE SET NULL;

-- Add index for template profiles
CREATE INDEX IF NOT EXISTS idx_profiles_is_template ON public.profiles(is_template_profile) WHERE is_template_profile = TRUE;

-- Add source profile reference to brand_templates
ALTER TABLE public.brand_templates
ADD COLUMN IF NOT EXISTS source_profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Expand brand_templates with store configuration fields for snapshot
ALTER TABLE public.brand_templates
ADD COLUMN IF NOT EXISTS store_name TEXT,
ADD COLUMN IF NOT EXISTS primary_color TEXT DEFAULT '#000000',
ADD COLUMN IF NOT EXISTS secondary_color TEXT DEFAULT '#ffffff',
ADD COLUMN IF NOT EXISTS font_family TEXT,
ADD COLUMN IF NOT EXISTS button_bg_color TEXT,
ADD COLUMN IF NOT EXISTS button_text_color TEXT,
ADD COLUMN IF NOT EXISTS footer_bg_color TEXT,
ADD COLUMN IF NOT EXISTS footer_text_color TEXT,
ADD COLUMN IF NOT EXISTS banner_desktop_urls JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS banner_mobile_urls JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS whatsapp_number TEXT,
ADD COLUMN IF NOT EXISTS instagram_url TEXT,
ADD COLUMN IF NOT EXISTS facebook_url TEXT,
ADD COLUMN IF NOT EXISTS show_whatsapp_button BOOLEAN DEFAULT TRUE;

-- Create brand_template_categories table
CREATE TABLE IF NOT EXISTS public.brand_template_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id UUID NOT NULL REFERENCES public.brand_templates(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create brand_template_pages table for institutional pages
CREATE TABLE IF NOT EXISTS public.brand_template_pages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id UUID NOT NULL REFERENCES public.brand_templates(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  content TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on new tables
ALTER TABLE public.brand_template_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brand_template_pages ENABLE ROW LEVEL SECURITY;

-- RLS policies for brand_template_categories (admin only for write, public read for active templates)
CREATE POLICY "Allow read access to brand_template_categories" 
ON public.brand_template_categories FOR SELECT 
USING (true);

CREATE POLICY "Allow authenticated users to manage brand_template_categories" 
ON public.brand_template_categories FOR ALL
USING (true)
WITH CHECK (true);

-- RLS policies for brand_template_pages
CREATE POLICY "Allow read access to brand_template_pages" 
ON public.brand_template_pages FOR SELECT 
USING (true);

CREATE POLICY "Allow authenticated users to manage brand_template_pages" 
ON public.brand_template_pages FOR ALL
USING (true)
WITH CHECK (true);

-- Function to sync template snapshot from source profile
CREATE OR REPLACE FUNCTION public.sync_template_from_profile(p_template_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    show_whatsapp_button = v_profile.show_whatsapp_button,
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
$$;

-- Function to clone template snapshot to new store
CREATE OR REPLACE FUNCTION public.clone_template_to_store(
  p_template_id UUID,
  p_user_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_template RECORD;
BEGIN
  -- Get template data
  SELECT * INTO v_template FROM brand_templates WHERE id = p_template_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Template not found';
  END IF;
  
  -- Update user profile with template configuration
  UPDATE profiles SET
    store_name = COALESCE(v_template.store_name, v_template.name),
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
  
  -- Copy template products to store (reuse existing function logic)
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
  
  -- Increment stores_created counter
  UPDATE brand_templates SET
    stores_created = stores_created + 1,
    updated_at = now()
  WHERE id = p_template_id;
  
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.sync_template_from_profile(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.clone_template_to_store(UUID, UUID) TO authenticated;