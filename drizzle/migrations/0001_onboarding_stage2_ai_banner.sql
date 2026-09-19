-- Etapa 2 do onboarding híbrido: allowlist de IA por loja, logs enriquecidos
-- de geração de banner e separação explícita entre prontidão e completude.
-- Somente alterações aditivas (nenhuma coluna removida ou renomeada).

ALTER TABLE public.store_onboarding_state
  ADD COLUMN IF NOT EXISTS ai_image_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_enabled_at timestamptz,
  ADD COLUMN IF NOT EXISTS ai_enabled_by uuid;

ALTER TABLE public.ai_media_generation_logs
  ADD COLUMN IF NOT EXISTS generation_id uuid,
  ADD COLUMN IF NOT EXISTS kind text,
  ADD COLUMN IF NOT EXISTS image_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS duration_ms integer,
  ADD COLUMN IF NOT EXISTS usage_payload jsonb,
  ADD COLUMN IF NOT EXISTS output_desktop_url text,
  ADD COLUMN IF NOT EXISTS output_mobile_url text,
  ADD COLUMN IF NOT EXISTS source_sizes jsonb,
  ADD COLUMN IF NOT EXISTS normalized_sizes jsonb,
  ADD COLUMN IF NOT EXISTS applied_at timestamptz,
  ADD COLUMN IF NOT EXISTS discarded_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_ai_media_logs_store_created
  ON public.ai_media_generation_logs (store_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_media_logs_generation
  ON public.ai_media_generation_logs (generation_id);

-- Prontidão operacional (binária) exposta no snapshot, sem duplicar lógica.
CREATE OR REPLACE FUNCTION public.compute_store_completion_snapshot(p_store_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  p record;
  v_active_products integer := 0;
  v_total_products integer := 0;
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
  SELECT count(*) INTO v_total_products FROM public.products
    WHERE user_id = p_store_id;
  SELECT count(*) INTO v_categories FROM public.product_categories
    WHERE user_id = p_store_id AND is_active IS TRUE;
  SELECT count(*) INTO v_orders FROM public.orders WHERE store_owner_id = p_store_id;
  SELECT count(*) INTO v_customers FROM public.store_customers WHERE store_owner_id = p_store_id;

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
      OR lower(COALESCE(p.secondary_color, '#ffffff')) <> '#ffffff');

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
    -- Conceitos separados: prontidão operacional (binária) x completude (%)
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

-- Admin concede/remove a autorização piloto de IA por loja (auditável).
CREATE OR REPLACE FUNCTION public.admin_set_store_ai_access(p_store_id uuid, p_enabled boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_actor uuid := auth.uid();
BEGIN
  IF v_actor IS NULL OR NOT public.has_role(v_actor, 'admin') THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  INSERT INTO public.store_onboarding_state (store_id, user_id, ai_image_enabled, ai_enabled_at, ai_enabled_by)
  VALUES (p_store_id, p_store_id, p_enabled,
          CASE WHEN p_enabled THEN now() ELSE NULL END,
          CASE WHEN p_enabled THEN v_actor ELSE NULL END)
  ON CONFLICT (store_id) DO UPDATE SET
    ai_image_enabled = p_enabled,
    ai_enabled_at = CASE WHEN p_enabled THEN now() ELSE NULL END,
    ai_enabled_by = CASE WHEN p_enabled THEN v_actor ELSE NULL END,
    updated_at = now();

  INSERT INTO public.store_onboarding_events (store_id, user_id, event_type, metadata)
  VALUES (p_store_id, v_actor,
          CASE WHEN p_enabled THEN 'AI_ACCESS_GRANTED' ELSE 'AI_ACCESS_REVOKED' END,
          jsonb_build_object('actor', v_actor, 'at', now()));

  RETURN jsonb_build_object('store_id', p_store_id, 'ai_image_enabled', p_enabled);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.admin_set_store_ai_access(uuid, boolean) TO authenticated;