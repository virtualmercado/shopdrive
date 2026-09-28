-- Minha Rede (MARCA) — backend canônico. Sem frontend, sem backfill.
CREATE INDEX IF NOT EXISTS idx_profiles_source_template_created
  ON public.profiles (source_template_id, created_at) WHERE source_template_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_template_click_events_counted
  ON public.template_click_events (template_id, created_at) WHERE counted = true;

-- 1. Fatos set-based da loja: MESMA regra de compute_store_completion_snapshot (minimum_ready/progress).
CREATE OR REPLACE FUNCTION public._bn_store_facts(p_store_ids uuid[])
RETURNS TABLE(store_id uuid, minimum_ready boolean, progress_percent integer, active_products integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH base AS (
    SELECT p.*,
      COALESCE((SELECT count(*) FROM products x WHERE x.user_id = p.id AND x.is_active IS TRUE),0)::int AS ap,
      COALESCE((SELECT count(*) FROM product_categories c WHERE c.user_id = p.id AND c.is_active IS TRUE),0)::int AS cats,
      (SELECT s.applied_palette_id FROM store_onboarding_state s WHERE s.store_id = p.id) AS pal,
      COALESCE(jsonb_array_length(CASE WHEN jsonb_typeof(p.banner_desktop_urls)='array' THEN p.banner_desktop_urls ELSE '[]'::jsonb END),0)
      + COALESCE(jsonb_array_length(CASE WHEN jsonb_typeof(p.banner_mobile_urls)='array' THEN p.banner_mobile_urls ELSE '[]'::jsonb END),0) AS bn
    FROM profiles p WHERE p.id = ANY(p_store_ids)
  ), s AS (
    SELECT id, ap, cats,
      (COALESCE(btrim(store_name),'')<>'' AND COALESCE(btrim(store_slug),'')<>''
        AND (COALESCE(btrim(store_description),'')<>'' OR COALESCE(btrim(store_category),'')<>'')) AS s_company,
      (COALESCE(btrim(store_logo_url),'')<>'' AND (lower(COALESCE(primary_color,'#000000'))<>'#000000'
        OR lower(COALESCE(secondary_color,'#ffffff'))<>'#ffffff' OR COALESCE(btrim(pal),'')<>'')) AS s_visual,
      (COALESCE(btrim(whatsapp_number),'')<>'' OR COALESCE(btrim(phone),'')<>'' OR COALESCE(btrim(instagram_url),'')<>'') AS s_contacts,
      (bn>0 OR COALESCE(btrim(banner_desktop_url),'')<>'' OR COALESCE(btrim(banner_mobile_url),'')<>'') AS s_banner,
      ((topbar_enabled IS TRUE AND COALESCE(btrim(topbar_text),'')<>'') OR cats>=2) AS s_nav,
      (COALESCE(btrim(about_us_text),'')<>'' OR COALESCE(btrim(return_policy_text),'')<>'') AS s_inst
    FROM base
  )
  SELECT id,
    (s_company AND s_contacts AND s_visual AND s_banner AND cats>=1 AND ap>=1),
    (CASE WHEN s_company THEN 20 ELSE 0 END + CASE WHEN s_visual THEN 15 ELSE 0 END
     + CASE WHEN s_contacts THEN 10 ELSE 0 END + CASE WHEN s_banner THEN 15 ELSE 0 END
     + CASE WHEN cats>=1 THEN 10 ELSE 0 END
     + CASE WHEN ap>=3 THEN 20 WHEN ap>=1 THEN 10 ELSE 0 END
     + CASE WHEN s_nav THEN 5 ELSE 0 END + CASE WHEN s_inst THEN 5 ELSE 0 END)::int,
    ap
  FROM s;
$$;

-- 2. Ativações válidas canônicas (sem filtro de data).
CREATE OR REPLACE FUNCTION public._bn_valid_activations(p_template_ids uuid[])
RETURNS TABLE(store_id uuid, template_id uuid, activated_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.source_template_id, p.created_at
  FROM profiles p
  WHERE p.source_template_id = ANY(p_template_ids)
    AND p.account_status IS DISTINCT FROM 'excluida'
    AND COALESCE(p.is_template_profile,false) = false
    AND NOT EXISTS (SELECT 1 FROM user_roles r WHERE r.user_id = p.id
                    AND r.role IN ('admin','financeiro','suporte','tecnico'));
$$;

-- 3. Motor canônico único de métricas (interno).
CREATE OR REPLACE FUNCTION public.compute_brand_network_metrics(
  p_template_ids uuid[], p_from timestamptz, p_to timestamptz, p_bucket text DEFAULT 'day')
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_summary jsonb; v_templates jsonb; v_series jsonb; v_step interval;
BEGIN
  IF p_from IS NULL OR p_to IS NULL OR p_from >= p_to THEN
    RAISE EXCEPTION 'Período inválido: from deve ser menor que to' USING ERRCODE = '22023'; END IF;
  IF p_to - p_from > interval '366 days' THEN
    RAISE EXCEPTION 'Período máximo de 366 dias' USING ERRCODE = '22023'; END IF;
  IF p_bucket NOT IN ('day','week','month') THEN
    RAISE EXCEPTION 'Bucket inválido (day|week|month)' USING ERRCODE = '22023'; END IF;
  p_template_ids := COALESCE(p_template_ids, '{}');
  v_step := ('1 ' || p_bucket)::interval;

  CREATE TEMP TABLE IF NOT EXISTS _bn_act(store_id uuid, template_id uuid, activated_at timestamptz) ON COMMIT DROP;
  TRUNCATE _bn_act;
  INSERT INTO _bn_act SELECT * FROM _bn_valid_activations(p_template_ids);
  CREATE TEMP TABLE IF NOT EXISTS _bn_ready(store_id uuid, minimum_ready boolean) ON COMMIT DROP;
  TRUNCATE _bn_ready;
  INSERT INTO _bn_ready SELECT f.store_id, f.minimum_ready
    FROM _bn_store_facts(ARRAY(SELECT store_id FROM _bn_act)) f;

  WITH c AS (SELECT count(*) n FROM template_click_events e WHERE e.counted = true
               AND e.template_id = ANY(p_template_ids) AND e.created_at >= p_from AND e.created_at < p_to),
       a AS (SELECT count(DISTINCT store_id) FILTER (WHERE activated_at >= p_from AND activated_at < p_to) np,
                    count(DISTINCT store_id) nt FROM _bn_act),
       o AS (SELECT count(DISTINCT store_id) n FROM _bn_ready WHERE minimum_ready)
  SELECT jsonb_build_object(
    'validClicks', c.n, 'validActivations', a.np,
    'conversionPercent', CASE WHEN c.n = 0 THEN 0 ELSE round(a.np::numeric * 100 / c.n, 2) END,
    'totalValidActivations', a.nt, 'operationalTotal', o.n,
    'semantics', jsonb_build_object('period', jsonb_build_array('validClicks','validActivations','conversionPercent'),
                                    'current', jsonb_build_array('totalValidActivations','operationalTotal')))
  INTO v_summary FROM c, a, o;

  SELECT COALESCE(jsonb_agg(t ORDER BY t->>'name', t->>'templateId'), '[]') INTO v_templates FROM (
    SELECT jsonb_build_object(
      'templateId', bt.id, 'name', bt.name, 'status', bt.status,
      'productsCount', (SELECT count(*) FROM brand_template_products x WHERE x.template_id = bt.id),
      'linkAvailable', (bt.status = 'active' AND bt.is_link_active IS TRUE AND bt.template_slug IS NOT NULL),
      'templateSlug', CASE WHEN bt.status = 'active' AND bt.is_link_active IS TRUE THEN bt.template_slug END,
      'validClicks', ck.n, 'validActivations', ac.np,
      'conversionPercent', CASE WHEN ck.n = 0 THEN 0 ELSE round(ac.np::numeric * 100 / ck.n, 2) END,
      'totalValidActivations', ac.nt, 'operationalTotal', ac.nr) t
    FROM brand_templates bt
    CROSS JOIN LATERAL (SELECT count(*) n FROM template_click_events e WHERE e.counted = true
       AND e.template_id = bt.id AND e.created_at >= p_from AND e.created_at < p_to) ck
    CROSS JOIN LATERAL (SELECT count(DISTINCT x.store_id) FILTER (WHERE x.activated_at >= p_from AND x.activated_at < p_to) np,
       count(DISTINCT x.store_id) nt,
       count(DISTINCT x.store_id) FILTER (WHERE r.minimum_ready) nr
       FROM _bn_act x LEFT JOIN _bn_ready r ON r.store_id = x.store_id WHERE x.template_id = bt.id) ac
    WHERE bt.id = ANY(p_template_ids)) q;

  WITH b AS (SELECT gs AS bs FROM generate_series(date_trunc(p_bucket, p_from, 'UTC'), p_to - interval '1 microsecond', v_step) gs),
       ce AS (SELECT date_trunc(p_bucket, e.created_at, 'UTC') bs, count(*) n FROM template_click_events e
              WHERE e.counted = true AND e.template_id = ANY(p_template_ids) AND e.created_at >= p_from AND e.created_at < p_to GROUP BY 1),
       ae AS (SELECT date_trunc(p_bucket, activated_at, 'UTC') bs, count(DISTINCT store_id) n FROM _bn_act
              WHERE activated_at >= p_from AND activated_at < p_to GROUP BY 1)
  SELECT COALESCE(jsonb_agg(jsonb_build_object('bucketStart', b.bs, 'clicks', COALESCE(ce.n,0),
           'activations', COALESCE(ae.n,0),
           'conversionPercent', CASE WHEN COALESCE(ce.n,0)=0 THEN 0 ELSE round(COALESCE(ae.n,0)::numeric*100/ce.n,2) END)
         ORDER BY b.bs), '[]')
  INTO v_series FROM b LEFT JOIN ce ON ce.bs = b.bs LEFT JOIN ae ON ae.bs = b.bs;

  RETURN jsonb_build_object('period', jsonb_build_object('from', p_from, 'to', p_to, 'bucket', p_bucket, 'interval', '[from,to)', 'timezone', 'UTC'),
    'summary', v_summary, 'templates', v_templates, 'series', v_series);
END; $$;

-- 4. Lista paginada canônica (interna).
CREATE OR REPLACE FUNCTION public._bn_list_activations(
  p_key_salt uuid, p_template_ids uuid[], p_page int, p_page_size int,
  p_status text, p_plan text, p_search text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_total bigint; v_items jsonb; v_size int; v_page int; v_q text;
BEGIN
  v_size := LEAST(GREATEST(COALESCE(p_page_size,50),1),100);
  v_page := GREATEST(COALESCE(p_page,1),1);
  IF COALESCE(p_status,'all') NOT IN ('all','operational','configuring') THEN
    RAISE EXCEPTION 'Filtro de situação inválido' USING ERRCODE='22023'; END IF;
  IF p_plan IS NOT NULL AND p_plan NOT IN ('free','pro','premium','marca') THEN
    RAISE EXCEPTION 'Filtro de plano inválido' USING ERRCODE='22023'; END IF;
  v_q := NULLIF(btrim(COALESCE(p_search,'')),'');
  IF v_q IS NOT NULL THEN v_q := '%' || replace(replace(replace(left(v_q,100),'\','\\'),'%','\%'),'_','\_') || '%'; END IF;

  CREATE TEMP TABLE IF NOT EXISTS _bn_list(store_id uuid, template_id uuid, activated_at timestamptz,
    store_name text, store_slug text, account_status text, minimum_ready boolean, progress int, products int, plan text) ON COMMIT DROP;
  TRUNCATE _bn_list;
  INSERT INTO _bn_list
  SELECT a.store_id, a.template_id, a.activated_at, p.store_name, p.store_slug, p.account_status,
         f.minimum_ready, f.progress_percent, f.active_products, NULL
  FROM _bn_valid_activations(COALESCE(p_template_ids,'{}')) a
  JOIN profiles p ON p.id = a.store_id
  JOIN _bn_store_facts(ARRAY(SELECT store_id FROM _bn_valid_activations(COALESCE(p_template_ids,'{}')))) f ON f.store_id = a.store_id
  WHERE (v_q IS NULL OR p.store_name ILIKE v_q)
    AND (COALESCE(p_status,'all') = 'all' OR (p_status='operational' AND f.minimum_ready) OR (p_status='configuring' AND NOT f.minimum_ready));

  IF p_plan IS NOT NULL THEN
    UPDATE _bn_list SET plan = get_effective_store_plan(store_id)->>'plan';
    DELETE FROM _bn_list WHERE plan IS DISTINCT FROM p_plan;
  END IF;

  SELECT count(*) INTO v_total FROM _bn_list;
  SELECT COALESCE(jsonb_agg(it ORDER BY ord), '[]') INTO v_items FROM (
    SELECT row_number() OVER (ORDER BY l.activated_at DESC, l.store_id DESC) ord,
      jsonb_build_object(
        'storeKey', md5(p_key_salt::text || ':' || l.store_id::text),
        'storeName', l.store_name, 'templateId', l.template_id, 'templateName', bt.name,
        'activatedAt', l.activated_at, 'minimumReady', l.minimum_ready,
        'situation', CASE WHEN l.minimum_ready THEN 'operational' ELSE 'configuring' END,
        'progressPercent', l.progress, 'activeProductsCount', l.products,
        'currentPlan', COALESCE(l.plan, get_effective_store_plan(l.store_id)->>'plan'),
        'publicPath', CASE WHEN l.account_status = 'active' AND COALESCE(btrim(l.store_slug),'')<>'' THEN '/' || l.store_slug END) it
    FROM _bn_list l JOIN brand_templates bt ON bt.id = l.template_id
    ORDER BY l.activated_at DESC, l.store_id DESC
    OFFSET (v_page-1)*v_size LIMIT v_size) s;

  RETURN jsonb_build_object('page', v_page, 'pageSize', v_size, 'totalCount', v_total, 'items', v_items);
END; $$;

CREATE OR REPLACE FUNCTION public._bn_activation_detail(p_key_salt uuid, p_template_ids uuid[], p_store_key text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid; v_tpl uuid; v_at timestamptz; r record; f record;
BEGIN
  SELECT a.store_id, a.template_id, a.activated_at INTO v_id, v_tpl, v_at
  FROM _bn_valid_activations(COALESCE(p_template_ids,'{}')) a
  WHERE md5(p_key_salt::text || ':' || a.store_id::text) = p_store_key;
  IF v_id IS NULL THEN RAISE EXCEPTION 'Acesso negado' USING ERRCODE='42501'; END IF;
  SELECT store_name, store_slug, account_status INTO r FROM profiles WHERE id = v_id;
  SELECT * INTO f FROM _bn_store_facts(ARRAY[v_id]);
  RETURN jsonb_build_object('storeKey', p_store_key, 'storeName', r.store_name,
    'templateId', v_tpl, 'templateName', (SELECT name FROM brand_templates WHERE id = v_tpl),
    'activatedAt', v_at, 'minimumReady', f.minimum_ready,
    'situation', CASE WHEN f.minimum_ready THEN 'operational' ELSE 'configuring' END,
    'progressPercent', f.progress_percent, 'activeProductsCount', f.active_products,
    'currentPlan', get_effective_store_plan(v_id)->>'plan',
    'publicPath', CASE WHEN r.account_status='active' AND COALESCE(btrim(r.store_slug),'')<>'' THEN '/'||r.store_slug END);
END; $$;

-- 5. Autorização do cliente: owner + primary + MARCA direto + flag.
CREATE OR REPLACE FUNCTION public._bn_resolve_caller_account(p_brand_account_id uuid)
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_acc uuid; v_n int; v_plan jsonb;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Não autenticado' USING ERRCODE='42501'; END IF;
  IF NOT is_plan_marca_enabled() THEN RAISE EXCEPTION 'Recurso indisponível' USING ERRCODE='42501'; END IF;
  IF p_brand_account_id IS NOT NULL THEN
    SELECT id INTO v_acc FROM brand_accounts WHERE id = p_brand_account_id AND owner_profile_id = v_uid;
  ELSE
    SELECT count(*) INTO v_n FROM brand_accounts WHERE owner_profile_id = v_uid;
    IF v_n > 1 THEN RAISE EXCEPTION 'Selecione a empresa' USING ERRCODE='22023'; END IF;
    SELECT id INTO v_acc FROM brand_accounts WHERE owner_profile_id = v_uid;
  END IF;
  IF v_acc IS NULL THEN RAISE EXCEPTION 'Acesso negado' USING ERRCODE='42501'; END IF;
  IF NOT EXISTS (SELECT 1 FROM brand_account_owned_stores WHERE brand_account_id = v_acc
                 AND store_profile_id = v_uid AND store_role = 'primary') THEN
    RAISE EXCEPTION 'Acesso negado' USING ERRCODE='42501'; END IF;
  v_plan := get_effective_store_plan(v_uid);
  IF v_plan->>'basePlan' <> 'marca' OR v_plan->>'planSource' <> 'direct' THEN
    RAISE EXCEPTION 'Acesso negado' USING ERRCODE='42501'; END IF;
  RETURN v_acc;
END; $$;

CREATE OR REPLACE FUNCTION public._bn_template_filter(p_account uuid, p_template_id uuid)
RETURNS uuid[] LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_template_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM brand_templates WHERE id = p_template_id AND brand_account_id = p_account) THEN
      RAISE EXCEPTION 'Template não pertence à empresa' USING ERRCODE='42501'; END IF;
    RETURN ARRAY[p_template_id];
  END IF;
  RETURN ARRAY(SELECT id FROM brand_templates WHERE brand_account_id = p_account);
END; $$;

-- 6. Wrappers do cliente.
CREATE OR REPLACE FUNCTION public.get_my_brand_network_dashboard(p_from timestamptz, p_to timestamptz,
  p_bucket text DEFAULT 'day', p_template_id uuid DEFAULT NULL, p_brand_account_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_acc uuid := _bn_resolve_caller_account(p_brand_account_id);
BEGIN
  RETURN compute_brand_network_metrics(_bn_template_filter(v_acc, p_template_id), p_from, p_to, p_bucket);
END; $$;

CREATE OR REPLACE FUNCTION public.get_my_brand_network_activations(p_page int DEFAULT 1, p_page_size int DEFAULT 50,
  p_template_id uuid DEFAULT NULL, p_status text DEFAULT 'all', p_plan text DEFAULT NULL,
  p_search text DEFAULT NULL, p_brand_account_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_acc uuid := _bn_resolve_caller_account(p_brand_account_id);
BEGIN
  RETURN _bn_list_activations(v_acc, _bn_template_filter(v_acc, p_template_id), p_page, p_page_size, p_status, p_plan, p_search);
END; $$;

CREATE OR REPLACE FUNCTION public.get_my_brand_network_activation_detail(p_store_key text, p_brand_account_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_acc uuid := _bn_resolve_caller_account(p_brand_account_id);
BEGIN
  RETURN _bn_activation_detail(v_acc, _bn_template_filter(v_acc, NULL), p_store_key);
END; $$;

-- 7. Wrappers administrativos (auditoria; aceitam template não vinculado, ex. AROMA).
CREATE OR REPLACE FUNCTION public._bn_admin_templates(p_brand_account_id uuid, p_template_id uuid)
RETURNS uuid[] LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Acesso negado' USING ERRCODE='42501'; END IF;
  IF p_brand_account_id IS NULL AND p_template_id IS NULL THEN
    RAISE EXCEPTION 'Informe brand_account_id ou template_id' USING ERRCODE='22023'; END IF;
  IF p_template_id IS NOT NULL THEN
    IF p_brand_account_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM brand_templates WHERE id=p_template_id AND brand_account_id=p_brand_account_id) THEN
      RAISE EXCEPTION 'Template não pertence à empresa' USING ERRCODE='22023'; END IF;
    IF NOT EXISTS (SELECT 1 FROM brand_templates WHERE id=p_template_id) THEN
      RAISE EXCEPTION 'Template inexistente' USING ERRCODE='22023'; END IF;
    RETURN ARRAY[p_template_id];
  END IF;
  RETURN ARRAY(SELECT id FROM brand_templates WHERE brand_account_id = p_brand_account_id);
END; $$;

CREATE OR REPLACE FUNCTION public.admin_get_brand_network_metrics(p_from timestamptz, p_to timestamptz,
  p_bucket text DEFAULT 'day', p_brand_account_id uuid DEFAULT NULL, p_template_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN compute_brand_network_metrics(_bn_admin_templates(p_brand_account_id, p_template_id), p_from, p_to, p_bucket);
END; $$;

CREATE OR REPLACE FUNCTION public.admin_get_brand_network_activations(p_brand_account_id uuid DEFAULT NULL,
  p_template_id uuid DEFAULT NULL, p_page int DEFAULT 1, p_page_size int DEFAULT 50,
  p_status text DEFAULT 'all', p_plan text DEFAULT NULL, p_search text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_t uuid[] := _bn_admin_templates(p_brand_account_id, p_template_id);
BEGIN
  RETURN _bn_list_activations(COALESCE(p_brand_account_id, p_template_id), v_t, p_page, p_page_size, p_status, p_plan, p_search);
END; $$;

-- 8. EXECUTE: internos fechados; wrappers só authenticated.
REVOKE ALL ON FUNCTION public._bn_store_facts(uuid[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._bn_valid_activations(uuid[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.compute_brand_network_metrics(uuid[], timestamptz, timestamptz, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._bn_list_activations(uuid, uuid[], int, int, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._bn_activation_detail(uuid, uuid[], text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._bn_resolve_caller_account(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._bn_template_filter(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._bn_admin_templates(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.compute_brand_network_metrics(uuid[], timestamptz, timestamptz, text) TO service_role;
REVOKE ALL ON FUNCTION public.get_my_brand_network_dashboard(timestamptz, timestamptz, text, uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_my_brand_network_activations(int, int, uuid, text, text, text, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_my_brand_network_activation_detail(text, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_get_brand_network_metrics(timestamptz, timestamptz, text, uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_get_brand_network_activations(uuid, uuid, int, int, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_brand_network_dashboard(timestamptz, timestamptz, text, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_brand_network_activations(int, int, uuid, text, text, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_brand_network_activation_detail(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_brand_network_metrics(timestamptz, timestamptz, text, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_brand_network_activations(uuid, uuid, int, int, text, text, text) TO authenticated;