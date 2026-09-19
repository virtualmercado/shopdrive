-- ============================================================
-- ETAPA 1 — Onboarding híbrido: estado, progresso, flags e logs de IA
-- Camada guiada SOBRE a estrutura existente (profiles/products/
-- product_categories/orders). Não substitui nem duplica nada.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.store_onboarding_state (
  store_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  started_at timestamptz,
  completed_at timestamptz,
  last_activity_at timestamptz,
  onboarding_required boolean NOT NULL DEFAULT false,
  onboarding_completed boolean NOT NULL DEFAULT false,
  onboarding_source text CHECK (onboarding_source IN ('new_user','recovery_existing','manual_admin')),
  classification text NOT NULL DEFAULT 'STORE_NEW_REQUIRED'
    CHECK (classification IN ('STORE_READY','STORE_RECOVERY_REQUIRED','STORE_NEW_REQUIRED','STORE_EXEMPT_OPERATIONAL')),
  current_step text,
  last_completed_step text,
  progress_percent integer NOT NULL DEFAULT 0 CHECK (progress_percent BETWEEN 0 AND 100),
  completion_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  steps_status jsonb NOT NULL DEFAULT '{}'::jsonb,
  blocking_enabled boolean NOT NULL DEFAULT false,
  manual_exempt boolean NOT NULL DEFAULT false,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.store_onboarding_state TO authenticated;
GRANT ALL ON public.store_onboarding_state TO service_role;
ALTER TABLE public.store_onboarding_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners view their onboarding state"
ON public.store_onboarding_state FOR SELECT TO authenticated
USING (auth.uid() = store_id);

CREATE POLICY "Admins view all onboarding state"
ON public.store_onboarding_state FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Owners update their onboarding state"
ON public.store_onboarding_state FOR UPDATE TO authenticated
USING (auth.uid() = store_id)
WITH CHECK (auth.uid() = store_id);

CREATE INDEX IF NOT EXISTS idx_onboarding_state_classification
  ON public.store_onboarding_state (classification);
CREATE INDEX IF NOT EXISTS idx_onboarding_state_required
  ON public.store_onboarding_state (onboarding_required) WHERE onboarding_required;

CREATE TABLE IF NOT EXISTS public.store_onboarding_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_id uuid,
  event_type text NOT NULL,
  step text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.store_onboarding_events TO authenticated;
GRANT ALL ON public.store_onboarding_events TO service_role;
ALTER TABLE public.store_onboarding_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners view their onboarding events"
ON public.store_onboarding_events FOR SELECT TO authenticated
USING (auth.uid() = store_id);

CREATE POLICY "Admins view all onboarding events"
ON public.store_onboarding_events FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Owners insert their onboarding events"
ON public.store_onboarding_events FOR INSERT TO authenticated
WITH CHECK (auth.uid() = store_id);

CREATE INDEX IF NOT EXISTS idx_onboarding_events_store
  ON public.store_onboarding_events (store_id, created_at DESC);

-- ------------------------------------------------------------
-- Feature flags de rollout (lidas pelo painel do lojista).
-- platform_settings é admin-only, por isso uma tabela dedicada
-- somente-leitura para authenticated.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.onboarding_feature_flags (
  flag_key text PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT false,
  description text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.onboarding_feature_flags TO authenticated;
GRANT ALL ON public.onboarding_feature_flags TO service_role;
ALTER TABLE public.onboarding_feature_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read onboarding flags"
ON public.onboarding_feature_flags FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Admins manage onboarding flags"
ON public.onboarding_feature_flags FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.onboarding_feature_flags (flag_key, enabled, description) VALUES
  ('ENABLE_STORE_ONBOARDING', true,  'Exibe o onboarding guiado no painel do lojista'),
  ('ENABLE_ONBOARDING_BLOCKING', false, 'Redireciona/bloqueia contas elegíveis (desligado em produção)'),
  ('ENABLE_AI_IMAGE_GENERATION', false, 'Libera geração de imagem por IA (restrito a admin/lojas de teste)'),
  ('ENABLE_RECOVERY_FOR_EXISTING_INCOMPLETE', true, 'Convida lojas antigas incompletas à recuperação assistida')
ON CONFLICT (flag_key) DO NOTHING;

-- ------------------------------------------------------------
-- Logs de geração de imagem por IA
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_media_generation_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL,
  user_id uuid NOT NULL,
  origin text NOT NULL,
  target_slot text,
  model_name text,
  request_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  prompt_summary text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','success','error')),
  output_url text,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);

GRANT SELECT ON public.ai_media_generation_logs TO authenticated;
GRANT ALL ON public.ai_media_generation_logs TO service_role;
ALTER TABLE public.ai_media_generation_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners view their ai media logs"
ON public.ai_media_generation_logs FOR SELECT TO authenticated
USING (auth.uid() = store_id);

CREATE POLICY "Admins view all ai media logs"
ON public.ai_media_generation_logs FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_ai_media_logs_store
  ON public.ai_media_generation_logs (store_id, created_at DESC);

-- ============================================================
-- Função central única de snapshot de conclusão da loja
-- ============================================================
CREATE OR REPLACE FUNCTION public.compute_store_completion_snapshot(p_store_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p record;
  v_active_products integer := 0;
  v_categories integer := 0;
  v_orders integer := 0;
  v_customers integer := 0;
  v_banner_count integer := 0;
  s_company boolean;
  s_visual boolean;
  s_contacts boolean;
  s_banner boolean;
  s_categories boolean;
  s_products boolean;
  s_navigation boolean;
  s_institutional boolean;
  v_products_score integer := 0;
  v_progress integer := 0;
  v_minimum boolean;
  v_operational boolean;
BEGIN
  SELECT * INTO p FROM public.profiles WHERE id = p_store_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('exists', false);
  END IF;

  SELECT count(*) INTO v_active_products FROM public.products
    WHERE user_id = p_store_id AND is_active IS TRUE;
  SELECT count(*) INTO v_categories FROM public.product_categories
    WHERE user_id = p_store_id AND is_active IS TRUE;
  SELECT count(*) INTO v_orders FROM public.orders WHERE store_owner_id = p_store_id;
  SELECT count(*) INTO v_customers FROM public.store_customers WHERE store_owner_id = p_store_id;

  v_banner_count := COALESCE(jsonb_array_length(
    CASE WHEN jsonb_typeof(p.banner_desktop_urls) = 'array' THEN p.banner_desktop_urls ELSE '[]'::jsonb END
  ), 0) + COALESCE(jsonb_array_length(
    CASE WHEN jsonb_typeof(p.banner_mobile_urls) = 'array' THEN p.banner_mobile_urls ELSE '[]'::jsonb END
  ), 0);

  -- Empresa: nome + slug + (descrição ou segmento)
  s_company := COALESCE(btrim(p.store_name), '') <> ''
    AND COALESCE(btrim(p.store_slug), '') <> ''
    AND (COALESCE(btrim(p.store_description), '') <> '' OR COALESCE(btrim(p.store_category), '') <> '');

  -- Identidade visual: logo + cor personalizada (diferente do default)
  s_visual := COALESCE(btrim(p.store_logo_url), '') <> ''
    AND (lower(COALESCE(p.primary_color, '#000000')) <> '#000000'
      OR lower(COALESCE(p.secondary_color, '#ffffff')) <> '#ffffff');

  -- Contatos: ao menos 1 contato útil
  s_contacts := COALESCE(btrim(p.whatsapp_number), '') <> ''
    OR COALESCE(btrim(p.phone), '') <> ''
    OR COALESCE(btrim(p.instagram_url), '') <> '';

  s_banner := v_banner_count > 0
    OR COALESCE(btrim(p.banner_desktop_url), '') <> ''
    OR COALESCE(btrim(p.banner_mobile_url), '') <> '';

  s_categories := v_categories >= 1;
  s_products := v_active_products >= 1;

  s_navigation := (p.topbar_enabled IS TRUE AND COALESCE(btrim(p.topbar_text), '') <> '')
    OR v_categories >= 2;

  s_institutional := COALESCE(btrim(p.about_us_text), '') <> ''
    OR COALESCE(btrim(p.return_policy_text), '') <> '';

  -- Produtos: score parcial (1 produto = metade, 3+ = total)
  v_products_score := CASE
    WHEN v_active_products >= 3 THEN 20
    WHEN v_active_products >= 1 THEN 10
    ELSE 0 END;

  v_progress :=
      (CASE WHEN s_company THEN 20 ELSE 0 END)
    + (CASE WHEN s_visual THEN 15 ELSE 0 END)
    + (CASE WHEN s_contacts THEN 10 ELSE 0 END)
    + (CASE WHEN s_banner THEN 15 ELSE 0 END)
    + (CASE WHEN s_categories THEN 10 ELSE 0 END)
    + v_products_score
    + (CASE WHEN s_navigation THEN 5 ELSE 0 END)
    + (CASE WHEN s_institutional THEN 5 ELSE 0 END);

  v_minimum := s_company AND s_contacts AND s_visual AND s_banner AND s_categories AND s_products;

  -- Sinais concretos de operação real (conservador: nunca bloquear quem usa)
  v_operational := v_orders > 0 OR v_customers > 0 OR v_active_products >= 5;

  RETURN jsonb_build_object(
    'exists', true,
    'computed_at', now(),
    'progress_percent', v_progress,
    'minimum_ready', v_minimum,
    'operational', v_operational,
    'metrics', jsonb_build_object(
      'active_products', v_active_products,
      'categories', v_categories,
      'orders', v_orders,
      'customers', v_customers,
      'banners', v_banner_count,
      'has_logo', COALESCE(btrim(p.store_logo_url), '') <> '',
      'has_banner', s_banner,
      'account_status', p.account_status,
      'last_activity', p.last_activity
    ),
    'steps', jsonb_build_object(
      'company',       jsonb_build_object('done', s_company, 'weight', 20),
      'visual',        jsonb_build_object('done', s_visual, 'weight', 15),
      'contacts',      jsonb_build_object('done', s_contacts, 'weight', 10),
      'banner',        jsonb_build_object('done', s_banner, 'weight', 15),
      'categories',    jsonb_build_object('done', s_categories, 'weight', 10),
      'products',      jsonb_build_object('done', s_products, 'weight', 20, 'score', v_products_score),
      'navigation',    jsonb_build_object('done', s_navigation, 'weight', 5),
      'institutional', jsonb_build_object('done', s_institutional, 'weight', 5)
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.compute_store_completion_snapshot(uuid) FROM PUBLIC, anon;

-- ============================================================
-- Recomputação central e idempotente do estado de onboarding
-- ============================================================
CREATE OR REPLACE FUNCTION public.recompute_store_onboarding_state(p_store_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_snap jsonb;
  v_progress integer;
  v_minimum boolean;
  v_operational boolean;
  v_class text;
  v_step text;
  v_required boolean;
  v_source text;
  v_existing record;
  v_is_new boolean;
  v_user uuid;
BEGIN
  IF auth.uid() IS NOT NULL
     AND auth.uid() <> p_store_id
     AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  v_snap := public.compute_store_completion_snapshot(p_store_id);
  IF COALESCE((v_snap->>'exists')::boolean, false) IS NOT TRUE THEN
    RETURN v_snap;
  END IF;

  SELECT id INTO v_user FROM public.profiles WHERE id = p_store_id;
  v_progress := (v_snap->>'progress_percent')::int;
  v_minimum := (v_snap->>'minimum_ready')::boolean;
  v_operational := (v_snap->>'operational')::boolean;

  SELECT * INTO v_existing FROM public.store_onboarding_state WHERE store_id = p_store_id;

  v_is_new := (SELECT created_at > now() - interval '3 days' FROM public.profiles WHERE id = p_store_id);

  v_step := CASE
    WHEN NOT (v_snap->'steps'->'company'->>'done')::boolean THEN 'company'
    WHEN NOT (v_snap->'steps'->'visual'->>'done')::boolean THEN 'visual'
    WHEN NOT (v_snap->'steps'->'contacts'->>'done')::boolean THEN 'contacts'
    WHEN NOT (v_snap->'steps'->'banner'->>'done')::boolean THEN 'banner'
    WHEN NOT (v_snap->'steps'->'categories'->>'done')::boolean THEN 'categories'
    WHEN NOT (v_snap->'steps'->'products'->>'done')::boolean THEN 'products'
    WHEN NOT (v_snap->'steps'->'navigation'->>'done')::boolean THEN 'navigation'
    WHEN NOT (v_snap->'steps'->'institutional'->>'done')::boolean THEN 'institutional'
    ELSE NULL
  END;

  -- Classificação conservadora
  IF COALESCE(v_existing.manual_exempt, false) THEN
    v_class := 'STORE_EXEMPT_OPERATIONAL';
  ELSIF v_operational THEN
    v_class := CASE WHEN v_minimum THEN 'STORE_READY' ELSE 'STORE_EXEMPT_OPERATIONAL' END;
  ELSIF v_minimum THEN
    v_class := 'STORE_READY';
  ELSIF COALESCE(v_is_new, false) THEN
    v_class := 'STORE_NEW_REQUIRED';
  ELSE
    v_class := 'STORE_RECOVERY_REQUIRED';
  END IF;

  v_required := v_class IN ('STORE_RECOVERY_REQUIRED','STORE_NEW_REQUIRED');

  v_source := COALESCE(
    v_existing.onboarding_source,
    CASE
      WHEN v_class = 'STORE_NEW_REQUIRED' THEN 'new_user'
      WHEN v_class = 'STORE_RECOVERY_REQUIRED' THEN 'recovery_existing'
      ELSE NULL
    END
  );

  INSERT INTO public.store_onboarding_state AS st (
    store_id, user_id, onboarding_required, onboarding_completed, onboarding_source,
    classification, current_step, progress_percent, completion_snapshot, steps_status,
    completed_at, last_activity_at, updated_at
  ) VALUES (
    p_store_id, v_user, v_required, v_minimum, v_source,
    v_class, v_step, v_progress, v_snap, v_snap->'steps',
    CASE WHEN v_minimum THEN now() ELSE NULL END, now(), now()
  )
  ON CONFLICT (store_id) DO UPDATE SET
    onboarding_required = v_required,
    onboarding_completed = v_minimum,
    onboarding_source = v_source,
    classification = v_class,
    current_step = v_step,
    progress_percent = v_progress,
    completion_snapshot = v_snap,
    steps_status = v_snap->'steps',
    completed_at = CASE WHEN v_minimum THEN COALESCE(st.completed_at, now()) ELSE NULL END,
    updated_at = now();

  RETURN jsonb_build_object(
    'store_id', p_store_id,
    'classification', v_class,
    'progress_percent', v_progress,
    'current_step', v_step,
    'onboarding_required', v_required,
    'onboarding_completed', v_minimum,
    'snapshot', v_snap
  );
END;
$$;

REVOKE ALL ON FUNCTION public.recompute_store_onboarding_state(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.recompute_store_onboarding_state(uuid) TO authenticated;

-- ============================================================
-- Marcação manual de isenção (admin)
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_set_onboarding_exempt(p_store_id uuid, p_exempt boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  INSERT INTO public.store_onboarding_state (store_id, user_id, manual_exempt)
  VALUES (p_store_id, p_store_id, p_exempt)
  ON CONFLICT (store_id) DO UPDATE SET manual_exempt = p_exempt, updated_at = now();

  INSERT INTO public.store_onboarding_events (store_id, user_id, event_type, metadata)
  VALUES (p_store_id, auth.uid(), CASE WHEN p_exempt THEN 'admin_exempt_on' ELSE 'admin_exempt_off' END, '{}'::jsonb);

  RETURN public.recompute_store_onboarding_state(p_store_id);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_onboarding_exempt(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_onboarding_exempt(uuid, boolean) TO authenticated;

-- ============================================================
-- Backfill idempotente de todas as lojas existentes
-- ============================================================
CREATE OR REPLACE FUNCTION public.backfill_store_onboarding_states(p_limit integer DEFAULT 5000)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  v_count integer := 0;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  FOR r IN
    SELECT id FROM public.profiles
    WHERE deleted_at IS NULL AND COALESCE(is_template_profile, false) = false
    ORDER BY created_at DESC
    LIMIT p_limit
  LOOP
    PERFORM public.recompute_store_onboarding_state(r.id);
    v_count := v_count + 1;
  END LOOP;

  RETURN jsonb_build_object('processed', v_count);
END;
$$;

REVOKE ALL ON FUNCTION public.backfill_store_onboarding_states(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.backfill_store_onboarding_states(integer) TO authenticated;

-- ============================================================
-- Semeia o estado para novas contas (sem tocar handle_new_user)
-- ============================================================
CREATE OR REPLACE FUNCTION public.seed_store_onboarding_state()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF COALESCE(NEW.is_template_profile, false) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.store_onboarding_state (store_id, user_id, onboarding_required, onboarding_source, classification, current_step, started_at, last_activity_at)
  VALUES (NEW.id, NEW.id, true, 'new_user', 'STORE_NEW_REQUIRED', 'company', now(), now())
  ON CONFLICT (store_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_seed_store_onboarding_state ON public.profiles;
CREATE TRIGGER trg_seed_store_onboarding_state
AFTER INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.seed_store_onboarding_state();

COMMENT ON TABLE public.store_onboarding_state IS
  'Camada de onboarding guiado sobre profiles. Fonte única de progresso: compute_store_completion_snapshot + recompute_store_onboarding_state.';