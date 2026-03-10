-- Function to generate a unique store slug from store_name
CREATE OR REPLACE FUNCTION public.generate_store_slug(p_store_name text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  base_slug TEXT;
  final_slug TEXT;
  counter INTEGER := 0;
BEGIN
  base_slug := lower(regexp_replace(p_store_name, '[^a-zA-Z0-9]+', '-', 'g'));
  base_slug := trim(both '-' from base_slug);
  base_slug := regexp_replace(base_slug, '-+', '-', 'g');
  
  IF base_slug = '' OR base_slug IS NULL THEN
    base_slug := 'loja';
  END IF;
  
  final_slug := base_slug;
  
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE store_slug = final_slug) LOOP
    counter := counter + 1;
    final_slug := base_slug || '-' || counter;
  END LOOP;
  
  RETURN final_slug;
END;
$$;

-- Update handle_new_user trigger to auto-generate store_slug
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_store_name TEXT;
  v_store_slug TEXT;
BEGIN
  v_store_name := COALESCE(NEW.raw_user_meta_data->>'store_name', '');
  
  IF v_store_name != '' THEN
    v_store_slug := public.generate_store_slug(v_store_name);
  ELSE
    v_store_slug := NULL;
  END IF;
  
  INSERT INTO public.profiles (id, full_name, store_name, store_slug)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    v_store_name,
    v_store_slug
  );
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');
  
  RETURN NEW;
END;
$$;

-- Backfill existing profiles without store_slug
DO $$
DECLARE
  r RECORD;
  new_slug TEXT;
BEGIN
  FOR r IN 
    SELECT id, store_name 
    FROM public.profiles 
    WHERE store_slug IS NULL 
      AND store_name IS NOT NULL 
      AND store_name != ''
      AND is_template_profile = false
    ORDER BY created_at ASC
  LOOP
    new_slug := public.generate_store_slug(r.store_name);
    UPDATE public.profiles SET store_slug = new_slug WHERE id = r.id;
  END LOOP;
END;
$$;