ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS catalog_share_code TEXT,
  ADD COLUMN IF NOT EXISTS catalog_current_url TEXT,
  ADD COLUMN IF NOT EXISTS catalog_current_path TEXT,
  ADD COLUMN IF NOT EXISTS catalog_updated_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_catalog_share_code_key
  ON public.profiles (catalog_share_code)
  WHERE catalog_share_code IS NOT NULL;

-- Cryptographically secure base62 code generator (11 chars ≈ 65 bits of entropy)
CREATE OR REPLACE FUNCTION public.generate_catalog_share_code()
RETURNS TEXT
LANGUAGE plpgsql
VOLATILE
SET search_path = public, extensions
AS $$
DECLARE
  alphabet TEXT := '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  code TEXT;
  bytes BYTEA;
  i INT;
BEGIN
  LOOP
    code := '';
    bytes := extensions.gen_random_bytes(11);
    FOR i IN 0..10 LOOP
      code := code || substr(alphabet, (get_byte(bytes, i) % 62) + 1, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.profiles WHERE catalog_share_code = code);
  END LOOP;
  RETURN code;
END;
$$;

REVOKE ALL ON FUNCTION public.generate_catalog_share_code() FROM PUBLIC;

-- Owner-scoped: returns (creating if needed) the caller's own permanent catalog share code
CREATE OR REPLACE FUNCTION public.ensure_catalog_share_code()
RETURNS TEXT
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  uid UUID := auth.uid();
  existing TEXT;
  fresh TEXT;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT catalog_share_code INTO existing FROM public.profiles WHERE id = uid;
  IF existing IS NOT NULL AND length(existing) = 11 THEN
    RETURN existing;
  END IF;

  fresh := public.generate_catalog_share_code();
  UPDATE public.profiles SET catalog_share_code = fresh WHERE id = uid;
  RETURN fresh;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_catalog_share_code() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_catalog_share_code() TO authenticated;

-- Owner-scoped: records the current catalog for the caller's store (share code never changes)
CREATE OR REPLACE FUNCTION public.set_current_catalog(_path TEXT, _url TEXT)
RETURNS VOID
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF _path IS NULL OR _path NOT LIKE (uid::text || '/catalogs/%') THEN
    RAISE EXCEPTION 'invalid catalog path';
  END IF;

  UPDATE public.profiles
     SET catalog_current_path = _path,
         catalog_current_url = _url,
         catalog_updated_at = now()
   WHERE id = uid;
END;
$$;

REVOKE ALL ON FUNCTION public.set_current_catalog(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_current_catalog(TEXT, TEXT) TO authenticated;

-- Public resolver: share code -> that store's current catalog only
CREATE OR REPLACE FUNCTION public.resolve_catalog_share_code(_code TEXT)
RETURNS TABLE (store_slug TEXT, store_name TEXT, catalog_url TEXT, catalog_updated_at TIMESTAMPTZ)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _code IS NULL OR _code !~ '^[A-Za-z0-9]{11}$' THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT p.store_slug, p.store_name, p.catalog_current_url, p.catalog_updated_at
    FROM public.profiles p
   WHERE p.catalog_share_code = _code
     AND public.is_public_store(p.id)
   LIMIT 1;
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_catalog_share_code(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_catalog_share_code(TEXT) TO anon, authenticated;