CREATE OR REPLACE FUNCTION public.get_effective_store_plan(p_store_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sub RECORD;
  v_plan text := 'free';
  v_limit integer := 20;
  v_unlimited boolean := false;
BEGIN
  IF p_store_id IS NULL THEN
    RETURN jsonb_build_object(
      'plan', 'unknown',
      'productLimit', NULL,
      'unlimited', false,
      'subscriptionStatus', 'unknown',
      'subscriptionId', NULL,
      'resolved', false
    );
  END IF;

  SELECT id, plan_id, status, no_charge, created_at, updated_at
  INTO v_sub
  FROM public.master_subscriptions
  WHERE user_id = p_store_id
    AND status IN ('active', 'past_due')
  ORDER BY
    CASE
      WHEN lower(coalesce(plan_id, '')) = 'premium' THEN 1
      WHEN lower(coalesce(plan_id, '')) = 'pro' THEN 2
      WHEN lower(coalesce(plan_id, '')) IN ('gratis', 'free') THEN 3
      ELSE 4
    END,
    created_at DESC NULLS LAST,
    updated_at DESC NULLS LAST
  LIMIT 1;

  IF FOUND THEN
    v_plan := CASE lower(coalesce(v_sub.plan_id, ''))
      WHEN 'premium' THEN 'premium'
      WHEN 'pro' THEN 'pro'
      WHEN 'gratis' THEN 'free'
      WHEN 'free' THEN 'free'
      ELSE 'free'
    END;
  ELSE
    v_plan := 'free';
  END IF;

  IF v_plan = 'premium' THEN
    v_limit := NULL;
    v_unlimited := true;
  ELSIF v_plan = 'pro' THEN
    v_limit := 150;
    v_unlimited := false;
  ELSE
    v_limit := 20;
    v_unlimited := false;
  END IF;

  RETURN jsonb_build_object(
    'plan', v_plan,
    'productLimit', v_limit,
    'unlimited', v_unlimited,
    'subscriptionStatus', COALESCE(v_sub.status, 'none'),
    'subscriptionId', v_sub.id,
    'resolved', true
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_effective_store_plan(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_product_plan_usage(p_store_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan jsonb;
  v_total integer := 0;
  v_active integer := 0;
  v_limit integer;
  v_remaining integer;
BEGIN
  IF p_store_id IS NULL OR (auth.uid() IS NOT NULL AND auth.uid() <> p_store_id) THEN
    RAISE EXCEPTION 'Não autorizado';
  END IF;

  v_plan := public.get_effective_store_plan(p_store_id);
  v_limit := NULLIF(v_plan->>'productLimit', '')::integer;

  SELECT COUNT(*), COUNT(*) FILTER (WHERE is_active = true)
  INTO v_total, v_active
  FROM public.products
  WHERE user_id = p_store_id;

  v_remaining := CASE
    WHEN (v_plan->>'unlimited')::boolean THEN NULL
    ELSE GREATEST(0, COALESCE(v_limit, 0) - v_active)
  END;

  RETURN jsonb_build_object(
    'plan', v_plan->>'plan',
    'productLimit', v_limit,
    'unlimited', (v_plan->>'unlimited')::boolean,
    'subscriptionStatus', v_plan->>'subscriptionStatus',
    'totalProducts', v_total,
    'activeProducts', v_active,
    'remainingActivations', v_remaining,
    'canActivateMore', CASE WHEN (v_plan->>'unlimited')::boolean THEN true ELSE v_active < COALESCE(v_limit, 0) END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_product_plan_usage(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.activate_product_with_plan_validation(p_product_id uuid, p_active boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_product RECORD;
  v_plan jsonb;
  v_limit integer;
  v_active_count integer := 0;
  v_previous boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autorizado';
  END IF;

  SELECT id, user_id, is_active
  INTO v_product
  FROM public.products
  WHERE id = p_product_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Produto não encontrado';
  END IF;

  IF v_product.user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Não autorizado';
  END IF;

  v_previous := v_product.is_active;

  IF p_active IS TRUE AND v_previous IS FALSE THEN
    v_plan := public.get_effective_store_plan(v_product.user_id);
    v_limit := NULLIF(v_plan->>'productLimit', '')::integer;

    IF COALESCE((v_plan->>'unlimited')::boolean, false) IS FALSE THEN
      SELECT COUNT(*)
      INTO v_active_count
      FROM public.products
      WHERE user_id = v_product.user_id
        AND is_active = true;

      IF v_active_count >= COALESCE(v_limit, 0) THEN
        RETURN jsonb_build_object(
          'success', false,
          'reason', 'plan_limit',
          'message', 'Você atingiu o limite de produtos ativos do seu plano. Faça upgrade para publicar mais produtos.',
          'plan', v_plan->>'plan',
          'productLimit', v_limit,
          'activeProducts', v_active_count,
          'previousActive', v_previous
        );
      END IF;
    END IF;
  END IF;

  UPDATE public.products
  SET is_active = p_active,
      inactive_reason = CASE WHEN p_active THEN NULL ELSE 'manual' END,
      updated_at = now()
  WHERE id = p_product_id;

  RETURN jsonb_build_object(
    'success', true,
    'productId', p_product_id,
    'previousActive', v_previous,
    'newActive', p_active,
    'origin', 'manual_toggle'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.activate_product_with_plan_validation(uuid, boolean) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.apply_confirmed_plan_downgrade(p_store_id uuid, p_new_plan text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan text := lower(coalesce(p_new_plan, ''));
  v_limit integer;
  v_deactivated integer := 0;
BEGIN
  IF p_store_id IS NULL THEN
    RAISE EXCEPTION 'Loja obrigatória';
  END IF;

  IF v_plan IN ('gratis', 'free') THEN
    v_limit := 20;
  ELSIF v_plan = 'pro' THEN
    v_limit := 150;
  ELSIF v_plan = 'premium' THEN
    RETURN 0;
  ELSE
    RAISE EXCEPTION 'Plano inválido: %', p_new_plan;
  END IF;

  WITH ranked AS (
    SELECT id,
           row_number() OVER (
             PARTITION BY user_id
             ORDER BY COALESCE(sales_count, 0) DESC,
                      COALESCE(is_featured, false) DESC,
                      created_at DESC,
                      id ASC
           ) AS rn
    FROM public.products
    WHERE user_id = p_store_id
      AND is_active = true
  ), affected AS (
    UPDATE public.products p
    SET is_active = false,
        inactive_reason = 'plan_limit',
        updated_at = now()
    FROM ranked r
    WHERE p.id = r.id
      AND r.rn > v_limit
    RETURNING p.id
  )
  SELECT COUNT(*) INTO v_deactivated FROM affected;

  RETURN v_deactivated;
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_confirmed_plan_downgrade(uuid, text) TO service_role;

CREATE OR REPLACE FUNCTION public.reactivate_products_after_upgrade(
  p_user_id uuid,
  p_max_products integer
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_active_count integer;
  v_can_reactivate integer;
  v_reactivated integer := 0;
  v_ids uuid[];
BEGIN
  SELECT COUNT(*) INTO v_active_count
  FROM public.products
  WHERE user_id = p_user_id AND is_active = true;

  IF p_max_products IS NULL THEN
    UPDATE public.products
    SET is_active = true,
        inactive_reason = NULL,
        updated_at = now()
    WHERE user_id = p_user_id
      AND is_active = false
      AND inactive_reason = 'plan_limit';
    GET DIAGNOSTICS v_reactivated = ROW_COUNT;
  ELSE
    v_can_reactivate := GREATEST(0, p_max_products - v_active_count);
    IF v_can_reactivate > 0 THEN
      SELECT ARRAY_AGG(id) INTO v_ids
      FROM (
        SELECT id
        FROM public.products
        WHERE user_id = p_user_id
          AND is_active = false
          AND inactive_reason = 'plan_limit'
        ORDER BY COALESCE(sales_count, 0) DESC,
                 COALESCE(is_featured, false) DESC,
                 created_at DESC,
                 id ASC
        LIMIT v_can_reactivate
      ) sub;

      IF v_ids IS NOT NULL THEN
        UPDATE public.products
        SET is_active = true,
            inactive_reason = NULL,
            updated_at = now()
        WHERE id = ANY(v_ids);
        GET DIAGNOSTICS v_reactivated = ROW_COUNT;
      END IF;
    END IF;
  END IF;

  RETURN v_reactivated;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reactivate_products_after_upgrade(uuid, integer) TO service_role;