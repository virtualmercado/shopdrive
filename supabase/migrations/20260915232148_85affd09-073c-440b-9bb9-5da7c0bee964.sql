ALTER TABLE public.brand_templates
ADD COLUMN IF NOT EXISTS main_banner_content jsonb;

COMMENT ON COLUMN public.brand_templates.main_banner_content IS
'Optional structured overlay content for main banner slides, copied from the source profile.';

CREATE OR REPLACE FUNCTION public.sync_main_banner_content_to_template()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.source_profile_id IS NOT NULL
     AND (
       TG_OP = 'INSERT'
       OR NEW.source_profile_id IS DISTINCT FROM OLD.source_profile_id
       OR NEW.banner_desktop_urls IS DISTINCT FROM OLD.banner_desktop_urls
       OR NEW.banner_mobile_urls IS DISTINCT FROM OLD.banner_mobile_urls
     ) THEN
    SELECT p.main_banner_content
      INTO NEW.main_banner_content
    FROM public.profiles p
    WHERE p.id = NEW.source_profile_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_main_banner_content_to_template_trigger ON public.brand_templates;
CREATE TRIGGER sync_main_banner_content_to_template_trigger
BEFORE INSERT OR UPDATE OF source_profile_id, banner_desktop_urls, banner_mobile_urls
ON public.brand_templates
FOR EACH ROW
EXECUTE FUNCTION public.sync_main_banner_content_to_template();

CREATE OR REPLACE FUNCTION public.copy_main_banner_content_from_template()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.main_banner_content IS NULL
     AND NEW.source_template_id IS NOT NULL
     AND (
       NEW.source_template_id IS DISTINCT FROM OLD.source_template_id
       OR NEW.banner_desktop_urls IS DISTINCT FROM OLD.banner_desktop_urls
       OR NEW.banner_mobile_urls IS DISTINCT FROM OLD.banner_mobile_urls
     ) THEN
    SELECT t.main_banner_content
      INTO NEW.main_banner_content
    FROM public.brand_templates t
    WHERE t.id = NEW.source_template_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS copy_main_banner_content_from_template_trigger ON public.profiles;
CREATE TRIGGER copy_main_banner_content_from_template_trigger
BEFORE UPDATE OF source_template_id, banner_desktop_urls, banner_mobile_urls
ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.copy_main_banner_content_from_template();

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

DROP TRIGGER IF EXISTS validate_brand_template_main_banner_content_trigger ON public.brand_templates;
CREATE TRIGGER validate_brand_template_main_banner_content_trigger
BEFORE INSERT OR UPDATE OF main_banner_content ON public.brand_templates
FOR EACH ROW
EXECUTE FUNCTION public.validate_brand_template_main_banner_content();