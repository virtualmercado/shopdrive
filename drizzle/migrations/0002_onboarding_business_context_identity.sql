-- Etapa 3: contexto do negócio (interno, para IA) + recomendação/aplicação de identidade visual.
ALTER TABLE public.store_onboarding_state
  ADD COLUMN IF NOT EXISTS business_context text,
  ADD COLUMN IF NOT EXISTS brand_profile jsonb,
  ADD COLUMN IF NOT EXISTS context_hash text,
  ADD COLUMN IF NOT EXISTS brand_analyzed_at timestamptz,
  ADD COLUMN IF NOT EXISTS brand_provider text,
  ADD COLUMN IF NOT EXISTS brand_model text,
  ADD COLUMN IF NOT EXISTS brand_confidence numeric,
  ADD COLUMN IF NOT EXISTS brand_status text NOT NULL DEFAULT 'not_analyzed',
  ADD COLUMN IF NOT EXISTS recommended_palette_id text,
  ADD COLUMN IF NOT EXISTS recommended_layout_id text,
  ADD COLUMN IF NOT EXISTS applied_palette_id text,
  ADD COLUMN IF NOT EXISTS applied_layout_id text,
  ADD COLUMN IF NOT EXISTS identity_applied_at timestamptz,
  ADD COLUMN IF NOT EXISTS identity_applications_count integer NOT NULL DEFAULT 0;

-- Contexto interno do negócio: nunca é conteúdo público.
CREATE OR REPLACE FUNCTION public.set_onboarding_business_context(
  p_store_id uuid,
  p_business_context text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS DISTINCT FROM p_store_id AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  PERFORM public.recompute_store_onboarding_state(p_store_id);

  UPDATE public.store_onboarding_state
     SET business_context = NULLIF(btrim(COALESCE(p_business_context, '')), ''),
         last_activity_at = now(),
         updated_at = now()
   WHERE store_id = p_store_id;
END;
$$;

REVOKE ALL ON FUNCTION public.set_onboarding_business_context(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.set_onboarding_business_context(uuid, text) TO authenticated;

-- Provisionamento inicial de identidade orientado pela ShopDrive.
-- Regra comercial: no máximo 2 aplicações antes da conclusão do onboarding
-- (1 inicial + 1 troca caso o lojista rejeite a primeira proposta).
-- Não desbloqueia o menu Personalizar: apenas autoriza a gravação feita pelo onboarding.
CREATE OR REPLACE FUNCTION public.authorize_onboarding_identity_application(
  p_store_id uuid,
  p_palette_id text,
  p_layout_id text,
  p_context_hash text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_state public.store_onboarding_state;
  v_max integer := 2;
BEGIN
  IF auth.uid() IS DISTINCT FROM p_store_id AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  IF p_layout_id IS NULL OR p_layout_id NOT IN ('layout_01', 'layout_02', 'layout_03') THEN
    RAISE EXCEPTION 'invalid_layout';
  END IF;

  IF COALESCE(btrim(p_palette_id), '') = '' THEN
    RAISE EXCEPTION 'invalid_palette';
  END IF;

  PERFORM public.recompute_store_onboarding_state(p_store_id);

  SELECT * INTO v_state FROM public.store_onboarding_state WHERE store_id = p_store_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'state_missing';
  END IF;

  IF NOT v_state.onboarding_completed
     AND COALESCE(v_state.identity_applications_count, 0) >= v_max THEN
    RETURN jsonb_build_object(
      'authorized', false,
      'reason', 'onboarding_identity_limit_reached',
      'applications', COALESCE(v_state.identity_applications_count, 0)
    );
  END IF;

  UPDATE public.store_onboarding_state
     SET applied_palette_id = p_palette_id,
         applied_layout_id = p_layout_id,
         identity_applied_at = now(),
         identity_applications_count = COALESCE(identity_applications_count, 0) + 1,
         context_hash = COALESCE(p_context_hash, context_hash),
         last_activity_at = now(),
         updated_at = now()
   WHERE store_id = p_store_id;

  INSERT INTO public.store_onboarding_events (store_id, user_id, event_type, step, metadata)
  VALUES (
    p_store_id,
    auth.uid(),
    'AI_STORE_IDENTITY_APPLIED',
    'visual',
    jsonb_build_object(
      'palette_id', p_palette_id,
      'layout_id', p_layout_id,
      'context_hash', p_context_hash,
      'origin', 'onboarding',
      'applied_at', now()
    )
  );

  RETURN jsonb_build_object('authorized', true, 'applications', COALESCE(v_state.identity_applications_count, 0) + 1);
END;
$$;

REVOKE ALL ON FUNCTION public.authorize_onboarding_identity_application(uuid, text, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.authorize_onboarding_identity_application(uuid, text, text, text) TO authenticated;

-- Identidade visual: logo válida + paleta realmente escolhida (cores fora do default
-- OU paleta oficial aplicada/confirmada). Valores default não contam como conclusão.
CREATE OR REPLACE FUNCTION public.compute_store_completion_snapshot(p_store_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  p record;
  v_active_products integer := 0;
  v_total_products integer := 0;
  v_categories integer := 0;
  v_orders integer := 0;
  v_customers integer := 0;
  v_banner_count integer := 0;
  v_applied_palette text;
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
  SELECT count(*) INTO v_total_products FROM public.products
    WHERE user_id = p_store_id;
  SELECT count(*) INTO v_categories FROM public.product_categories
    WHERE user_id = p_store_id AND is_active IS TRUE;
  SELECT count(*) INTO v_orders FROM public.orders WHERE store_owner_id = p_store_id;
  SELECT count(*) INTO v_customers FROM public.store_customers WHERE store_owner_id = p_store_id;

  SELECT applied_palette_id INTO v_applied_palette
    FROM public.store_onboarding_state WHERE store_id = p_store_id;

  v_banner_count := COALESCE(jsonb_array_length(
    CASE WHEN jsonb_typeof(p.banner_desktop_urls) = 'array' THEN p.banner_desktop_urls ELSE '[]'::jsonb END
  ), 0) + COALESCE(jsonb_array_length(
    CASE WHEN jsonb_typeof(p.banner_mobile_urls) = 'array' THEN p.banner_mobile_urls ELSE '[]'::jsonb END
  ), 0);

  s_company := COALESCE(btrim(p.store_name), '') <> ''
    AND COALESCE(btrim(p.store_slug), '') <> ''
    AND (COALESCE(btrim(p.store_description), '') <> '' OR COALESCE(btrim(p.store_category), '') <> '');

  s_visual := COALESCE(btrim(p.store_logo_url), '') <> ''
    AND (lower(COALESCE(p.primary_color, '#000000')) <> '#000000'
      OR lower(COALESCE(p.secondary_color, '#ffffff')) <> '#ffffff'
      OR COALESCE(btrim(v_applied_palette), '') <> '');

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
  v_operational := v_orders > 0 OR v_customers > 0 OR v_active_products >= 5;

  RETURN jsonb_build_object(
    'exists', true,
    'computed_at', now(),
    'progress_percent', v_progress,
    'minimum_ready', v_minimum,
    'operational', v_operational,
    'activation_readiness', CASE WHEN (v_minimum OR v_operational) THEN 'READY' ELSE 'NOT_READY' END,
    'store_completeness', v_progress,
    'metrics', jsonb_build_object(
      'active_products', v_active_products,
      'total_products', v_total_products,
      'categories', v_categories,
      'orders', v_orders,
      'customers', v_customers,
      'banners', v_banner_count,
      'has_logo', COALESCE(btrim(p.store_logo_url), '') <> '',
      'has_banner', s_banner,
      'applied_palette_id', v_applied_palette,
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
$function$;