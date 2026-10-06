-- Fase 5C.2: liberação do Editorial por loja + publicação segura com histórico.
-- Aditivo. Nenhuma loja liberada. Funções do Clássico inalteradas.

CREATE TABLE public.catalog_editorial_access (
  store_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  changed_at timestamptz NOT NULL DEFAULT now(),
  changed_by uuid
);
GRANT SELECT ON public.catalog_editorial_access TO authenticated;
GRANT ALL ON public.catalog_editorial_access TO service_role;
ALTER TABLE public.catalog_editorial_access ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner reads own editorial access" ON public.catalog_editorial_access
  FOR SELECT TO authenticated USING (auth.uid() = store_id);
CREATE POLICY "Admins read editorial access" ON public.catalog_editorial_access
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.catalog_publications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  idempotency_key uuid,
  catalog_kind text NOT NULL CHECK (catalog_kind IN ('editorial','classic')),
  status text NOT NULL CHECK (status IN ('pending','published','rejected_stale','rejected_missing_file','rejected_unauthorized')),
  storage_path text,
  public_url text,
  expected_updated_at timestamptz,
  previous_path text,
  previous_url text,
  previous_updated_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE UNIQUE INDEX catalog_publications_idem_key ON public.catalog_publications (store_id, idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX catalog_publications_store_created ON public.catalog_publications (store_id, created_at DESC);
GRANT SELECT ON public.catalog_publications TO authenticated;
GRANT ALL ON public.catalog_publications TO service_role;
ALTER TABLE public.catalog_publications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner reads own publications" ON public.catalog_publications
  FOR SELECT TO authenticated USING (auth.uid() = store_id);
CREATE POLICY "Admins read publications" ON public.catalog_publications
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Regra única de acesso: flag global + loja liberada + loja própria ativa.
CREATE OR REPLACE FUNCTION public._catalog_editorial_allowed(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _uid IS NOT NULL
     AND EXISTS (SELECT 1 FROM public.onboarding_feature_flags WHERE flag_key = 'ENABLE_CATALOG_EDITORIAL_V2' AND enabled = true)
     AND EXISTS (SELECT 1 FROM public.catalog_editorial_access WHERE store_id = _uid AND enabled = true)
     AND EXISTS (SELECT 1 FROM public.profiles WHERE id = _uid AND store_slug IS NOT NULL AND COALESCE(account_status,'active') = 'active')
$$;
REVOKE ALL ON FUNCTION public._catalog_editorial_allowed(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_my_catalog_editorial_access()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public._catalog_editorial_allowed(auth.uid())
$$;
REVOKE ALL ON FUNCTION public.get_my_catalog_editorial_access() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_catalog_editorial_access() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_my_current_catalog_state()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object('has_current', catalog_current_url IS NOT NULL, 'updated_at', catalog_updated_at, 'share_code', catalog_share_code)
    FROM public.profiles WHERE id = auth.uid()
$$;
REVOKE ALL ON FUNCTION public.get_my_current_catalog_state() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_current_catalog_state() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_set_store_catalog_editorial(p_store_id uuid, p_enabled boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_actor uuid := auth.uid();
BEGIN
  IF v_actor IS NULL OR NOT public.has_role(v_actor, 'admin') THEN RAISE EXCEPTION 'not authorized'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_store_id AND store_slug IS NOT NULL) THEN RAISE EXCEPTION 'store not found'; END IF;
  INSERT INTO public.catalog_editorial_access (store_id, enabled, changed_at, changed_by)
  VALUES (p_store_id, p_enabled, now(), v_actor)
  ON CONFLICT (store_id) DO UPDATE SET enabled = EXCLUDED.enabled, changed_at = now(), changed_by = v_actor;
  INSERT INTO public.store_onboarding_events (store_id, user_id, event_type, metadata)
  VALUES (p_store_id, v_actor, CASE WHEN p_enabled THEN 'CATALOG_EDITORIAL_GRANTED' ELSE 'CATALOG_EDITORIAL_REVOKED' END,
          jsonb_build_object('actor', v_actor, 'at', now()));
  RETURN jsonb_build_object('store_id', p_store_id, 'enabled', p_enabled);
END $$;
REVOKE ALL ON FUNCTION public.admin_set_store_catalog_editorial(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_store_catalog_editorial(uuid, boolean) TO authenticated;

-- Etapa 1: reserva a publicação (idempotente por chave) e o caminho definido pelo servidor.
CREATE OR REPLACE FUNCTION public.begin_editorial_catalog_publication(_idempotency_key uuid, _expected_updated_at timestamptz)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); r public.catalog_publications; new_id uuid := gen_random_uuid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _idempotency_key IS NULL THEN RAISE EXCEPTION 'missing idempotency key'; END IF;
  IF NOT public._catalog_editorial_allowed(uid) THEN RAISE EXCEPTION 'editorial not allowed'; END IF;
  SELECT * INTO r FROM public.catalog_publications WHERE store_id = uid AND idempotency_key = _idempotency_key;
  IF NOT FOUND THEN
    INSERT INTO public.catalog_publications (id, store_id, idempotency_key, catalog_kind, status, storage_path, expected_updated_at, created_by)
    VALUES (new_id, uid, _idempotency_key, 'editorial', 'pending', uid::text || '/catalogs/editorial/' || new_id::text || '.pdf', _expected_updated_at, uid)
    ON CONFLICT (store_id, idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING;
    SELECT * INTO r FROM public.catalog_publications WHERE store_id = uid AND idempotency_key = _idempotency_key;
  END IF;
  RETURN jsonb_build_object('publication_id', r.id, 'storage_path', r.storage_path, 'status', r.status);
END $$;
REVOKE ALL ON FUNCTION public.begin_editorial_catalog_publication(uuid, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.begin_editorial_catalog_publication(uuid, timestamptz) TO authenticated;

-- Etapa 2: confirma arquivo e troca o catálogo atual só se ninguém publicou no meio.
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
  UPDATE public.catalog_publications SET status = 'published', public_url = v_url, published_at = now(),
    previous_path = p.catalog_current_path, previous_url = p.catalog_current_url, previous_updated_at = p.catalog_updated_at
   WHERE id = r.id;
  v_code := public.ensure_catalog_share_code();
  RETURN jsonb_build_object('status', 'published', 'share_code', v_code, 'replayed', false);
END $$;
REVOKE ALL ON FUNCTION public.publish_editorial_catalog(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.publish_editorial_catalog(uuid) TO authenticated;

-- Histórico das trocas feitas pelo Clássico (comportamento do Clássico inalterado).
CREATE OR REPLACE FUNCTION public._log_classic_catalog_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.catalog_current_path IS DISTINCT FROM OLD.catalog_current_path
     AND COALESCE(current_setting('app.catalog_publication', true), '') = '' THEN
    INSERT INTO public.catalog_publications (store_id, catalog_kind, status, storage_path, public_url, previous_path, previous_url, previous_updated_at, created_by, published_at)
    VALUES (NEW.id, 'classic', 'published', NEW.catalog_current_path, NEW.catalog_current_url, OLD.catalog_current_path, OLD.catalog_current_url, OLD.catalog_updated_at, auth.uid(), now());
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public._log_classic_catalog_change() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER profiles_log_classic_catalog_change
  AFTER UPDATE OF catalog_current_path ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public._log_classic_catalog_change();