CREATE OR REPLACE FUNCTION public.validate_brand_template_main_banner_content()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  item jsonb;
  item_url text;
BEGIN
  IF NEW.main_banner_content IS NULL THEN RETURN NEW; END IF;
  IF jsonb_typeof(NEW.main_banner_content) <> 'array' OR jsonb_array_length(NEW.main_banner_content) > 4 THEN
    RAISE EXCEPTION 'main_banner_content must be an array with at most 4 items';
  END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(NEW.main_banner_content)
  LOOP
    IF jsonb_typeof(item) <> 'object'
       OR EXISTS (
         SELECT 1 FROM jsonb_object_keys(item) AS key
         WHERE key NOT IN ('title', 'subtitle', 'ctaText', 'ctaUrl', 'contentPosition', 'textColor', 'buttonColor')
       )
       OR length(COALESCE(item->>'title', '')) > 60
       OR length(COALESCE(item->>'subtitle', '')) > 120
       OR length(COALESCE(item->>'ctaText', '')) > 30
       OR length(COALESCE(item->>'ctaUrl', '')) > 2048
       OR COALESCE(item->>'contentPosition', 'left') NOT IN ('left', 'center', 'right')
       OR (item ? 'textColor' AND COALESCE(item->>'textColor', '') !~ '^#[0-9A-Fa-f]{6}$')
       OR (item ? 'buttonColor' AND COALESCE(item->>'buttonColor', '') !~ '^#[0-9A-Fa-f]{6}$') THEN
      RAISE EXCEPTION 'Invalid main banner content';
    END IF;
    item_url := btrim(COALESCE(item->>'ctaUrl', ''));
    IF item_url <> '' AND item_url !~ '^/(?!/)[^[:cntrl:]]*$' AND item_url !~* '^https?://[^[:space:][:cntrl:]]+$' THEN
      RAISE EXCEPTION 'Invalid main banner CTA URL';
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;