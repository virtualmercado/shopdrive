CREATE OR REPLACE FUNCTION public.set_current_catalog(_path text, _url text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  uid UUID := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF _path IS NULL OR _path NOT LIKE (uid::text || '/catalogs/%') OR _path ~ '(\.\.|[?#\s\\])' THEN
    RAISE EXCEPTION 'invalid catalog path';
  END IF;

  -- The public URL is derived from the validated storage path; the caller-supplied
  -- _url is ignored so the share link can never point to an external site.
  UPDATE public.profiles
     SET catalog_current_path = _path,
         catalog_current_url = 'https://nkoogfznnqlnragbauez.supabase.co/storage/v1/object/public/product-images/' || _path,
         catalog_updated_at = now()
   WHERE id = uid;
END;
$function$;