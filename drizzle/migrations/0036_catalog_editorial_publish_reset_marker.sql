-- Limpa o marcador logo após a troca, para trocas do Clássico na mesma transação continuarem registradas.
CREATE OR REPLACE FUNCTION public.publish_editorial_catalog(_publication_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, storage AS $$
DECLARE
  uid uuid := auth.uid();
  r public.catalog_publications;
  p record;
  v_url text;
  v_code text;
  base constant text := 'https://nkoogfznnqlnragbauez.supabase.co/storage/v1/object/public/product-images/';
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT * INTO r FROM public.catalog_publications WHERE id = _publication_id AND store_id = uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'publication not found'; END IF;
  IF r.status = 'published' THEN
    RETURN jsonb_build_object('status', 'published', 'share_code', (SELECT catalog_share_code FROM public.profiles WHERE id = uid), 'replayed', true);
  END IF;
  IF r.status <> 'pending' THEN RETURN jsonb_build_object('status', r.status); END IF;

  IF NOT public._catalog_editorial_allowed(uid) THEN
    UPDATE public.catalog_publications SET status = 'rejected_unauthorized' WHERE id = r.id;
    RETURN jsonb_build_object('status', 'rejected_unauthorized');
  END IF;
  IF r.storage_path IS NULL OR r.storage_path <> uid::text || '/catalogs/editorial/' || r.id::text || '.pdf'
     OR NOT EXISTS (SELECT 1 FROM storage.objects o WHERE o.bucket_id = 'product-images' AND o.name = r.storage_path) THEN
    UPDATE public.catalog_publications SET status = 'rejected_missing_file' WHERE id = r.id;
    RETURN jsonb_build_object('status', 'rejected_missing_file');
  END IF;

  SELECT catalog_current_path, catalog_current_url, catalog_updated_at INTO p FROM public.profiles WHERE id = uid FOR UPDATE;
  IF p.catalog_updated_at IS DISTINCT FROM r.expected_updated_at THEN
    UPDATE public.catalog_publications SET status = 'rejected_stale',
      metadata = metadata || jsonb_build_object('current_updated_at', p.catalog_updated_at) WHERE id = r.id;
    RETURN jsonb_build_object('status', 'rejected_stale');
  END IF;

  v_url := base || r.storage_path;
  PERFORM set_config('app.catalog_publication', r.id::text, true);
  UPDATE public.profiles SET catalog_current_path = r.storage_path, catalog_current_url = v_url, catalog_updated_at = now() WHERE id = uid;
  PERFORM set_config('app.catalog_publication', '', true);
  UPDATE public.catalog_publications SET status = 'published', public_url = v_url, published_at = now(),
    previous_path = p.catalog_current_path, previous_url = p.catalog_current_url, previous_updated_at = p.catalog_updated_at
   WHERE id = r.id;
  v_code := public.ensure_catalog_share_code();
  RETURN jsonb_build_object('status', 'published', 'share_code', v_code, 'replayed', false);
END $$;
REVOKE ALL ON FUNCTION public.publish_editorial_catalog(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.publish_editorial_catalog(uuid) TO authenticated;