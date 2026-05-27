-- Definitive template activation/sync repair
-- 1) Harden product copy: idempotent products + brands + categories
CREATE OR REPLACE FUNCTION public.copy_template_products_to_store(p_template_id uuid, p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  copied_count integer := 0;
BEGIN
  INSERT INTO public.product_categories (user_id, name)
  SELECT DISTINCT p_user_id, COALESCE(NULLIF(trim(tp.category), ''), 'Geral')
  FROM public.brand_template_products tp
  WHERE tp.template_id = p_template_id
    AND tp.is_active = true
  ON CONFLICT (user_id, name) DO NOTHING;

  INSERT INTO public.product_brands (user_id, name, is_active)
  SELECT DISTINCT p_user_id, trim(tp.brand_name), true
  FROM public.brand_template_products tp
  WHERE tp.template_id = p_template_id
    AND tp.is_active = true
    AND NULLIF(trim(tp.brand_name), '') IS NOT NULL
  ON CONFLICT (user_id, name) DO NOTHING;

  INSERT INTO public.products (
    user_id, name, description, price, images, image_url, category_id, is_active, stock,
    weight, height, length, width, shipping_weight, variations, promotional_price,
    is_featured, is_new, brand_id
  )
  SELECT
    p_user_id,
    tp.name,
    tp.description,
    tp.price,
    CASE WHEN tp.images IS NOT NULL THEN to_jsonb(tp.images) ELSE '[]'::jsonb END,
    CASE WHEN tp.images IS NOT NULL AND array_length(tp.images, 1) > 0 THEN tp.images[1] ELSE NULL END,
    (
      SELECT pc.id
      FROM public.product_categories pc
      WHERE pc.user_id = p_user_id
        AND pc.name = COALESCE(NULLIF(trim(tp.category), ''), 'Geral')
      LIMIT 1
    ),
    true,
    999,
    tp.weight,
    tp.height,
    tp.length,
    tp.width,
    tp.shipping_weight,
    tp.variations,
    tp.promotional_price,
    COALESCE(tp.is_featured, false),
    COALESCE(tp.is_new, false),
    (
      SELECT pb.id
      FROM public.product_brands pb
      WHERE pb.user_id = p_user_id
        AND pb.name = trim(tp.brand_name)
      LIMIT 1
    )
  FROM public.brand_template_products tp
  WHERE tp.template_id = p_template_id
    AND tp.is_active = true
    AND NOT EXISTS (
      SELECT 1
      FROM public.products p
      WHERE p.user_id = p_user_id
        AND lower(trim(p.name)) = lower(trim(tp.name))
    );

  GET DIAGNOSTICS copied_count = ROW_COUNT;

  UPDATE public.products p
  SET
    category_id = COALESCE(
      p.category_id,
      (
        SELECT pc.id
        FROM public.product_categories pc
        WHERE pc.user_id = p_user_id
          AND pc.name = COALESCE(NULLIF(trim(tp.category), ''), 'Geral')
        LIMIT 1
      )
    ),
    brand_id = COALESCE(
      p.brand_id,
      (
        SELECT pb.id
        FROM public.product_brands pb
        WHERE pb.user_id = p_user_id
          AND pb.name = trim(tp.brand_name)
        LIMIT 1
      )
    ),
    weight = COALESCE(p.weight, tp.weight),
    height = COALESCE(p.height, tp.height),
    length = COALESCE(p.length, tp.length),
    width = COALESCE(p.width, tp.width),
    shipping_weight = COALESCE(p.shipping_weight, tp.shipping_weight),
    variations = COALESCE(p.variations, tp.variations),
    promotional_price = COALESCE(p.promotional_price, tp.promotional_price),
    image_url = COALESCE(p.image_url, CASE WHEN tp.images IS NOT NULL AND array_length(tp.images, 1) > 0 THEN tp.images[1] ELSE NULL END),
    images = CASE
      WHEN (p.images IS NULL OR p.images = '[]'::jsonb) AND tp.images IS NOT NULL THEN to_jsonb(tp.images)
      ELSE p.images
    END,
    updated_at = now()
  FROM public.brand_template_products tp
  WHERE p.user_id = p_user_id
    AND tp.template_id = p_template_id
    AND tp.is_active = true
    AND lower(trim(p.name)) = lower(trim(tp.name));

  IF copied_count > 0 THEN
    UPDATE public.brand_templates
    SET stores_created = stores_created + 1,
        updated_at = now()
    WHERE id = p_template_id;
  END IF;

  RETURN copied_count;
END;
$$;

-- 2) Public-safe activation for a logged-in user coming from a valid activation link
CREATE OR REPLACE FUNCTION public.activate_template_for_current_user(
  p_template_slug text,
  p_store_name text DEFAULT NULL,
  p_full_name text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_template record;
  v_profile record;
  v_result jsonb;
  v_integrity jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Autenticação requerida para ativar o template' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_template
  FROM public.brand_templates
  WHERE template_slug = p_template_slug
    AND is_link_active = true
    AND status = 'active';

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'stage', 'template_lookup',
      'error', 'Template não encontrado, inativo ou link desativado',
      'retry', false
    );
  END IF;

  SELECT * INTO v_profile
  FROM public.profiles
  WHERE id = v_user_id;

  IF NOT FOUND THEN
    INSERT INTO public.profiles (
      id, full_name, store_name, source_template_id, template_apply_status, template_apply_error
    ) VALUES (
      v_user_id,
      COALESCE(p_full_name, ''),
      COALESCE(NULLIF(trim(p_store_name), ''), v_template.store_name, v_template.name),
      v_template.id,
      'template_pending',
      NULL
    );
  ELSE
    UPDATE public.profiles
    SET full_name = COALESCE(NULLIF(trim(p_full_name), ''), full_name),
        store_name = COALESCE(NULLIF(trim(p_store_name), ''), store_name, v_template.store_name, v_template.name),
        source_template_id = COALESCE(source_template_id, v_template.id),
        template_apply_status = CASE
          WHEN template_apply_status = 'applied' AND source_template_id = v_template.id THEN template_apply_status
          ELSE 'template_pending'
        END,
        template_apply_error = NULL,
        updated_at = now()
    WHERE id = v_user_id;
  END IF;

  v_integrity := public.template_integrity_check(v_user_id);
  IF COALESCE((v_integrity ->> 'complete')::boolean, false) THEN
    UPDATE public.profiles
    SET template_applied = true,
        template_applied_at = COALESCE(template_applied_at, now()),
        template_apply_status = 'complete',
        template_apply_error = NULL,
        updated_at = now()
    WHERE id = v_user_id;

    RETURN jsonb_build_object(
      'success', true,
      'stage', 'complete',
      'user_id', v_user_id,
      'template_id', v_template.id,
      'integrity', v_integrity
    );
  END IF;

  BEGIN
    v_result := public.clone_template_to_store(v_template.id, v_user_id);
  EXCEPTION WHEN OTHERS THEN
    UPDATE public.profiles
    SET template_apply_status = 'failed_recoverable',
        template_apply_error = format('activate_template_for_current_user clone failed: %s', SQLERRM),
        updated_at = now()
    WHERE id = v_user_id;

    RETURN jsonb_build_object(
      'success', false,
      'stage', 'template_apply',
      'user_id', v_user_id,
      'template_id', v_template.id,
      'error', SQLERRM,
      'retry', true
    );
  END;

  v_integrity := public.template_integrity_check(v_user_id);

  IF COALESCE((v_integrity ->> 'complete')::boolean, false) THEN
    UPDATE public.profiles
    SET template_applied = true,
        template_applied_at = COALESCE(template_applied_at, now()),
        template_apply_status = 'complete',
        template_apply_error = NULL,
        updated_at = now()
    WHERE id = v_user_id;
  ELSE
    UPDATE public.profiles
    SET template_applied = true,
        template_apply_status = 'failed_recoverable',
        template_apply_error = 'Itens faltantes após ativação: ' || (v_integrity ->> 'missing'),
        updated_at = now()
    WHERE id = v_user_id;
  END IF;

  RETURN jsonb_build_object(
    'success', COALESCE((v_integrity ->> 'complete')::boolean, false),
    'stage', CASE WHEN COALESCE((v_integrity ->> 'complete')::boolean, false) THEN 'complete' ELSE 'failed_recoverable' END,
    'user_id', v_user_id,
    'template_id', v_template.id,
    'template_result', v_result,
    'integrity', v_integrity,
    'retry', NOT COALESCE((v_integrity ->> 'complete')::boolean, false)
  );
END;
$$;

-- 3) Admin-only force sync for the master panel. It uses the internal sync and never stops on one broken store.
CREATE OR REPLACE FUNCTION public.force_sync_brand_template(p_template_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_template record;
  v_store record;
  v_result jsonb;
  v_integrity jsonb;
  v_processed integer := 0;
  v_synced integer := 0;
  v_failed integer := 0;
  v_details jsonb := '[]'::jsonb;
BEGIN
  PERFORM public.assert_caller_is_admin();

  SELECT id, name, source_profile_id INTO v_template
  FROM public.brand_templates
  WHERE id = p_template_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'stage', 'template_lookup', 'error', 'Template não encontrado');
  END IF;

  BEGIN
    PERFORM public.sync_template_from_profile(p_template_id);
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'stage', 'snapshot_sync',
      'template_id', p_template_id,
      'source_profile_id', v_template.source_profile_id,
      'error', SQLERRM,
      'hint', 'Falha ao executar sync_template_from_profile a partir do wrapper administrativo'
    );
  END;

  FOR v_store IN
    SELECT p.id, p.store_name, p.template_applied, p.template_apply_status
    FROM public.profiles p
    WHERE p.source_template_id = p_template_id
      AND COALESCE(p.is_template_profile, false) = false
  LOOP
    v_processed := v_processed + 1;

    BEGIN
      IF COALESCE(v_store.template_applied, false) = false
         OR v_store.template_apply_status IN ('pending', 'template_pending', 'failed', 'failed_recoverable') THEN
        v_result := public.apply_template_to_existing_store_impl(v_store.id, p_template_id, false);
      ELSE
        v_result := public.complement_template_data_impl(v_store.id, p_template_id);
      END IF;

      v_integrity := public.template_integrity_check(v_store.id);

      IF COALESCE((v_integrity ->> 'complete')::boolean, false) THEN
        UPDATE public.profiles
        SET template_apply_status = 'complete',
            template_apply_error = NULL,
            updated_at = now()
        WHERE id = v_store.id;
        v_synced := v_synced + 1;
      ELSE
        UPDATE public.profiles
        SET template_apply_status = 'failed_recoverable',
            template_apply_error = 'Itens faltantes após sincronização global: ' || (v_integrity ->> 'missing'),
            updated_at = now()
        WHERE id = v_store.id;
        v_failed := v_failed + 1;
      END IF;

      v_details := v_details || jsonb_build_object(
        'store_id', v_store.id,
        'store_name', v_store.store_name,
        'result', v_result,
        'integrity', v_integrity
      );
    EXCEPTION WHEN OTHERS THEN
      v_failed := v_failed + 1;
      UPDATE public.profiles
      SET template_apply_status = 'failed_recoverable',
          template_apply_error = format('force_sync_brand_template failed: %s', SQLERRM),
          updated_at = now()
      WHERE id = v_store.id;

      v_details := v_details || jsonb_build_object(
        'store_id', v_store.id,
        'store_name', v_store.store_name,
        'error', SQLERRM
      );
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'stage', 'complete',
    'template_id', p_template_id,
    'source_profile_id', v_template.source_profile_id,
    'processed', v_processed,
    'synced', v_synced,
    'failed', v_failed,
    'details', v_details
  );
END;
$$;

-- 4) Make the legacy sync safe if anything still reaches it directly: no more permission denied, but still guarded.
CREATE OR REPLACE FUNCTION public.sync_template_from_profile_guarded(p_template_id uuid)
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
  FROM public.brand_templates
  WHERE id = p_template_id;

  IF v_source IS NULL THEN
    RAISE EXCEPTION 'Template sem perfil-fonte vinculado';
  END IF;

  IF auth.uid() <> v_source AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Acesso negado: somente o dono do perfil-fonte ou um admin pode sincronizar este template' USING ERRCODE = '42501';
  END IF;

  PERFORM public.sync_template_from_profile(p_template_id);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.copy_template_products_to_store(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.copy_template_products_to_store(uuid, uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.activate_template_for_current_user(text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.activate_template_for_current_user(text, text, text) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.force_sync_brand_template(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.force_sync_brand_template(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.sync_template_from_profile_guarded(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sync_template_from_profile_guarded(uuid) TO authenticated, service_role;

-- Keep internal functions unavailable to direct clients.
REVOKE EXECUTE ON FUNCTION public.sync_template_from_profile(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.clone_template_to_store(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.apply_template_to_existing_store_impl(uuid, uuid, boolean) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.complement_template_data_impl(uuid, uuid) FROM PUBLIC, anon, authenticated;