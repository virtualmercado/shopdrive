
-- ============================================================
-- 1) Helper: integrity check for a store cloned from a template
-- ============================================================
CREATE OR REPLACE FUNCTION public.template_integrity_check(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile RECORD;
  v_product_count integer;
  v_brand_count integer;
  v_category_count integer;
  v_missing text[] := ARRAY[]::text[];
  v_has_banners_desktop boolean;
  v_has_banners_mobile boolean;
  v_has_mini_banners boolean;
  v_has_benefit_banners boolean;
  v_has_content_banner boolean;
  v_has_colors boolean;
  v_has_footer boolean;
  v_has_about boolean;
BEGIN
  SELECT * INTO v_profile FROM public.profiles WHERE id = p_user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('exists', false, 'missing', ARRAY['profile']);
  END IF;

  SELECT COUNT(*) INTO v_product_count FROM public.products WHERE user_id = p_user_id;
  SELECT COUNT(*) INTO v_brand_count FROM public.product_brands WHERE user_id = p_user_id;
  SELECT COUNT(*) INTO v_category_count FROM public.product_categories WHERE user_id = p_user_id;

  v_has_banners_desktop := v_profile.banner_desktop_urls IS NOT NULL
    AND jsonb_typeof(v_profile.banner_desktop_urls) = 'array'
    AND jsonb_array_length(v_profile.banner_desktop_urls) > 0;
  v_has_banners_mobile := v_profile.banner_mobile_urls IS NOT NULL
    AND jsonb_typeof(v_profile.banner_mobile_urls) = 'array'
    AND jsonb_array_length(v_profile.banner_mobile_urls) > 0;
  v_has_mini_banners := v_profile.banner_rect_1_url IS NOT NULL AND v_profile.banner_rect_2_url IS NOT NULL;
  v_has_benefit_banners := v_profile.selected_benefit_banners IS NOT NULL;
  v_has_content_banner := COALESCE(v_profile.content_banner_enabled, false)
    OR (v_profile.content_banners IS NOT NULL
        AND jsonb_typeof(v_profile.content_banners) = 'array'
        AND jsonb_array_length(v_profile.content_banners) > 0);
  v_has_colors := v_profile.primary_color IS NOT NULL AND v_profile.primary_color <> '#000000';
  v_has_footer := v_profile.footer_bg_color IS NOT NULL;
  v_has_about := v_profile.about_us_text IS NOT NULL;

  IF NOT v_has_banners_desktop THEN v_missing := array_append(v_missing, 'banners_desktop'); END IF;
  IF NOT v_has_banners_mobile  THEN v_missing := array_append(v_missing, 'banners_mobile'); END IF;
  IF NOT v_has_mini_banners    THEN v_missing := array_append(v_missing, 'mini_banners'); END IF;
  IF NOT v_has_benefit_banners THEN v_missing := array_append(v_missing, 'benefit_banners'); END IF;
  IF NOT v_has_content_banner  THEN v_missing := array_append(v_missing, 'content_banner'); END IF;
  IF NOT v_has_colors          THEN v_missing := array_append(v_missing, 'colors'); END IF;
  IF NOT v_has_footer          THEN v_missing := array_append(v_missing, 'footer'); END IF;
  IF NOT v_has_about           THEN v_missing := array_append(v_missing, 'about_us'); END IF;
  IF v_product_count = 0       THEN v_missing := array_append(v_missing, 'products'); END IF;
  IF v_brand_count = 0         THEN v_missing := array_append(v_missing, 'brands'); END IF;
  IF v_category_count = 0      THEN v_missing := array_append(v_missing, 'categories'); END IF;

  RETURN jsonb_build_object(
    'exists', true,
    'product_count', v_product_count,
    'brand_count', v_brand_count,
    'category_count', v_category_count,
    'missing', v_missing,
    'complete', array_length(v_missing, 1) IS NULL
  );
END;
$$;

-- ============================================================
-- 2) Admin gate: prepend role check to administrative RPCs
--    (We wrap the existing functions; original logic is preserved
--     via CREATE OR REPLACE of the bodies, but to avoid re-declaring
--     the long bodies here, we use a thin wrapper approach: rename
--     the original and create a gated version. That is invasive.
--
--     Instead, the safer and simpler approach is to keep the bodies
--     as they are and add the gate at the start by re-creating the
--     functions. Since the bodies are large and unchanged, we add
--     a runtime gate using a small SECURITY DEFINER guard called
--     at the entry by editing the functions inline.)
--
--    Here, we instead define a guard function and re-create only
--    a tiny prologue: we cannot inject code without rewriting the
--    functions. So we take the pragmatic path of:
--      (a) recreating each function header to include the gate,
--          calling the previous body via PERFORM of a *_impl twin.
--
--    To keep this migration self-contained and reliable, we add
--    the gate by recreating only the public-facing RPC with a
--    guard that calls the existing internal function via dynamic
--    EXECUTE on a renamed copy. This adds risk we don't want.
--
--    Final decision (least risky): re-grant EXECUTE on these RPCs
--    and rely on application-level admin checks for the admin tab,
--    AND add a hardcoded role check by recreating ONLY the small
--    backfill_partner_templates / repair / link functions. The
--    larger apply/clone/sync functions keep their bodies but get a
--    grant restricted to authenticated; we ALSO add a guard table
--    "rpc_admin_gate" via a wrapper function that callers must use
--    is overkill — instead we accept that apply/complement are
--    admin-tab-only in the UI and add a SQL gate on entry by
--    REPLACING just those functions in a follow-up migration that
--    preserves their bodies.
-- ============================================================

-- Helper guard used by the new RPCs below
CREATE OR REPLACE FUNCTION public.assert_caller_is_admin()
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Acesso negado: requer papel admin' USING ERRCODE = '42501';
  END IF;
END;
$$;

-- ============================================================
-- 3) New admin-only repair routine (idempotent, never duplicates)
-- ============================================================
CREATE OR REPLACE FUNCTION public.repair_incomplete_template_stores()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_store RECORD;
  v_result jsonb;
  v_integrity jsonb;
  v_processed integer := 0;
  v_repaired integer := 0;
  v_still_incomplete integer := 0;
  v_failed integer := 0;
  v_details jsonb := '[]'::jsonb;
BEGIN
  PERFORM public.assert_caller_is_admin();

  FOR v_store IN
    SELECT p.id AS user_id, p.source_template_id, p.store_name,
           p.template_applied, p.template_apply_status
    FROM public.profiles p
    WHERE p.source_template_id IS NOT NULL
      AND (
        COALESCE(p.template_applied, false) = false
        OR p.template_apply_status IN ('pending', 'failed', 'incomplete')
        OR NOT (public.template_integrity_check(p.id) ->> 'complete')::boolean
      )
  LOOP
    v_processed := v_processed + 1;

    BEGIN
      IF COALESCE(v_store.template_applied, false) = false THEN
        v_result := public.apply_template_to_existing_store(
          v_store.user_id, v_store.source_template_id, false
        );
      ELSE
        v_result := public.complement_template_data(
          v_store.user_id, v_store.source_template_id
        );
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_failed := v_failed + 1;
      v_result := jsonb_build_object('success', false, 'error', SQLERRM);
    END;

    v_integrity := public.template_integrity_check(v_store.user_id);

    -- Reconcile status with integrity
    IF (v_integrity ->> 'complete')::boolean THEN
      UPDATE public.profiles
      SET template_apply_status = 'applied',
          template_apply_error = NULL,
          updated_at = now()
      WHERE id = v_store.user_id;
      v_repaired := v_repaired + 1;
    ELSE
      UPDATE public.profiles
      SET template_apply_status = 'incomplete',
          template_apply_error = 'Itens faltantes: ' || (v_integrity ->> 'missing'),
          updated_at = now()
      WHERE id = v_store.user_id;
      v_still_incomplete := v_still_incomplete + 1;
    END IF;

    v_details := v_details || jsonb_build_object(
      'user_id', v_store.user_id,
      'store_name', v_store.store_name,
      'template_id', v_store.source_template_id,
      'result', v_result,
      'integrity', v_integrity
    );
  END LOOP;

  RETURN jsonb_build_object(
    'processed', v_processed,
    'repaired', v_repaired,
    'still_incomplete', v_still_incomplete,
    'failed', v_failed,
    'details', v_details
  );
END;
$$;

-- ============================================================
-- 4) Add a SQL-level admin gate to the existing administrative
--    RPCs by wrapping the originals. We do this by renaming each
--    original to *_impl (no-op if already renamed) and creating a
--    thin gated facade with the original signature.
-- ============================================================

-- helper to safely rename a function once (idempotent)
DO $$
DECLARE
  pairs text[][] := ARRAY[
    ARRAY['apply_template_to_existing_store(uuid,uuid,boolean)', 'apply_template_to_existing_store_impl'],
    ARRAY['complement_template_data(uuid,uuid)',                  'complement_template_data_impl'],
    ARRAY['backfill_partner_templates()',                          'backfill_partner_templates_impl'],
    ARRAY['link_template_to_profile(uuid,uuid)',                   'link_template_to_profile_impl']
  ];
  p text[];
BEGIN
  FOREACH p SLICE 1 IN ARRAY pairs LOOP
    BEGIN
      EXECUTE format('ALTER FUNCTION public.%s RENAME TO %I', p[1], p[2]);
    EXCEPTION
      WHEN undefined_function THEN NULL;   -- original already renamed
      WHEN duplicate_function THEN NULL;   -- impl already exists; original removed below
    END;
  END LOOP;
END$$;

-- Facade: apply_template_to_existing_store
CREATE OR REPLACE FUNCTION public.apply_template_to_existing_store(
  p_user_id uuid, p_template_id uuid, p_force boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.assert_caller_is_admin();
  RETURN public.apply_template_to_existing_store_impl(p_user_id, p_template_id, p_force);
END;
$$;

-- Facade: complement_template_data
CREATE OR REPLACE FUNCTION public.complement_template_data(
  p_user_id uuid, p_template_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.assert_caller_is_admin();
  RETURN public.complement_template_data_impl(p_user_id, p_template_id);
END;
$$;

-- Facade: backfill_partner_templates
CREATE OR REPLACE FUNCTION public.backfill_partner_templates()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.assert_caller_is_admin();
  RETURN public.backfill_partner_templates_impl();
END;
$$;

-- Facade: link_template_to_profile
CREATE OR REPLACE FUNCTION public.link_template_to_profile(
  p_template_id uuid, p_profile_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.assert_caller_is_admin();
  RETURN public.link_template_to_profile_impl(p_template_id, p_profile_id);
END;
$$;

-- ============================================================
-- 5) Gate clone/sync to the right caller (no admin wrapper needed,
--    they have intrinsic per-user guards)
-- ============================================================

-- clone_template_to_store: only the target user (during signup) or admin
CREATE OR REPLACE FUNCTION public.clone_template_to_store_guarded(
  p_template_id uuid, p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Autenticação requerida' USING ERRCODE = '42501';
  END IF;
  IF auth.uid() <> p_user_id AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Acesso negado: usuário só pode clonar template para a própria conta' USING ERRCODE = '42501';
  END IF;
  RETURN public.clone_template_to_store(p_template_id, p_user_id);
END;
$$;

-- sync_template_from_profile: admin OR owner of the source profile
CREATE OR REPLACE FUNCTION public.sync_template_from_profile_guarded(
  p_template_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_source uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Autenticação requerida' USING ERRCODE = '42501';
  END IF;

  SELECT source_profile_id INTO v_source
  FROM public.brand_templates WHERE id = p_template_id;

  IF v_source IS NULL THEN
    RAISE EXCEPTION 'Template sem perfil-fonte vinculado';
  END IF;

  IF auth.uid() <> v_source AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Acesso negado: somente o dono do perfil-fonte ou um admin pode sincronizar este template' USING ERRCODE = '42501';
  END IF;

  PERFORM public.sync_template_from_profile(p_template_id);
END;
$$;

-- ============================================================
-- 6) GRANTs: restore execute for the gated facades.
--    clone_template_to_store stays revoked from clients; the
--    guarded wrapper is what they call. Same for sync.
-- ============================================================
GRANT EXECUTE ON FUNCTION public.template_integrity_check(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.assert_caller_is_admin() TO authenticated;

GRANT EXECUTE ON FUNCTION public.apply_template_to_existing_store(uuid, uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complement_template_data(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.backfill_partner_templates() TO authenticated;
GRANT EXECUTE ON FUNCTION public.link_template_to_profile(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.repair_incomplete_template_stores() TO authenticated;

GRANT EXECUTE ON FUNCTION public.clone_template_to_store_guarded(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_template_from_profile_guarded(uuid) TO authenticated;

-- Keep the underlying *_impl and unwrapped clone/sync revoked from clients;
-- only the SECURITY DEFINER facades above can call them.
REVOKE EXECUTE ON FUNCTION public.apply_template_to_existing_store_impl(uuid, uuid, boolean) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.complement_template_data_impl(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.backfill_partner_templates_impl() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.link_template_to_profile_impl(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.clone_template_to_store(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_template_from_profile(uuid) FROM PUBLIC, anon, authenticated;
