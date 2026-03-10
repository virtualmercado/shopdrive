-- Fix empty string store_slugs
DO $$
DECLARE
  r RECORD;
  new_slug TEXT;
BEGIN
  FOR r IN 
    SELECT id, store_name 
    FROM public.profiles 
    WHERE store_slug = ''
      AND store_name IS NOT NULL 
      AND store_name != ''
  LOOP
    new_slug := public.generate_store_slug(r.store_name);
    UPDATE public.profiles SET store_slug = new_slug WHERE id = r.id;
  END LOOP;
END;
$$;