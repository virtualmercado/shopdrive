-- Live public function bodies (read-only snapshot 2026-11-18) used by scripts/test-plan-limit-downgrade-db.py.
CREATE OR REPLACE FUNCTION public.activate_product_with_plan_validation(p_product_id uuid, p_active boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_product RECORD;
  v_plan jsonb;
  v_limit integer;
  v_active_count integer := 0;
  v_previous boolean;
BEGIN
  IF public.merchant_request_store_id() IS NULL THEN
    RAISE EXCEPTION 'Não autorizado';
  END IF;

  SELECT id, user_id, is_active, inactive_reason
  INTO v_product
  FROM public.products
  WHERE id = p_product_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Produto não encontrado';
  END IF;

  IF v_product.user_id <> public.merchant_request_store_id() THEN
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
          'message', CASE
            WHEN v_product.inactive_reason IN ('clone_pending_plan_limit', 'pending_plan_limit') THEN
              format('Seu plano atual permite até %s produtos ativos. Escolha e pague um plano compatível para liberar mais produtos.', COALESCE(v_limit, 0))
            ELSE
              'Você atingiu o limite de produtos ativos do seu plano. Faça upgrade para publicar mais produtos.'
          END,
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
      was_active_before_plan_restriction = CASE WHEN p_active THEN false ELSE was_active_before_plan_restriction END,
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
$function$
;

CREATE OR REPLACE FUNCTION public.get_brand_inherited_plan(p_store_id uuid)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT 'marca'::text
  FROM public.brand_account_owned_stores o
  JOIN public.brand_accounts b ON b.id = o.brand_account_id
  WHERE o.store_profile_id = p_store_id AND o.store_role = 'secondary'
    AND b.owner_profile_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM (
        SELECT plan_id FROM public.master_subscriptions
        WHERE user_id = b.owner_profile_id AND status IN ('active','past_due')
        ORDER BY created_at DESC NULLS LAST, updated_at DESC NULLS LAST, id DESC LIMIT 1
      ) s WHERE lower(s.plan_id) = 'marca')
  LIMIT 1
$function$
;

CREATE OR REPLACE FUNCTION public.get_effective_store_plan(p_store_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_sub RECORD; v_plan text := 'free'; v_base text := 'free'; v_limit integer := 20;
  v_unlimited boolean := false; v_trial RECORD; v_trial_active boolean := false;
  v_source text := 'free_fallback'; v_owned RECORD; v_is_secondary boolean := false;
BEGIN
  IF p_store_id IS NULL THEN
    RETURN jsonb_build_object('plan','unknown','productLimit',NULL,'unlimited',false,
      'subscriptionStatus','unknown','subscriptionId',NULL,'resolved',false);
  END IF;

  SELECT brand_account_id, store_role INTO v_owned
  FROM public.brand_account_owned_stores WHERE store_profile_id = p_store_id;
  v_is_secondary := COALESCE(v_owned.store_role = 'secondary', false);

  SELECT id, plan_id, status, no_charge, created_at, updated_at INTO v_sub
  FROM public.master_subscriptions
  WHERE user_id = p_store_id AND status IN ('active', 'past_due')
    AND NOT (status = 'past_due' AND grace_period_ends_at IS NOT NULL AND grace_period_ends_at < now())
    AND NOT (status = 'past_due' AND grace_period_ends_at IS NULL AND current_period_end IS NULL)
    AND NOT (v_is_secondary AND lower(coalesce(plan_id,'')) NOT IN ('gratis','free')
             AND (status <> 'active' OR current_period_end IS NULL OR current_period_end <= now()))
  ORDER BY created_at DESC NULLS LAST, updated_at DESC NULLS LAST, id DESC LIMIT 1;

  IF FOUND THEN
    IF v_sub.plan_id IS NOT NULL AND lower(v_sub.plan_id) NOT IN ('marca','premium','pro','gratis','free') THEN
      RAISE WARNING 'UNKNOWN_PLAN_CODE store=% value=% at=%', p_store_id, v_sub.plan_id, now();
    END IF;
    v_base := CASE lower(coalesce(v_sub.plan_id, '')) WHEN 'marca' THEN 'marca' WHEN 'premium' THEN 'premium' WHEN 'pro' THEN 'pro' ELSE 'free' END;
    IF v_base <> 'free' THEN v_source := 'direct'; END IF;
  END IF;

  IF v_base = 'free' AND public.get_brand_inherited_plan(p_store_id) = 'marca' THEN
    v_base := 'marca'; v_source := 'brand_inherited';
  END IF;

  v_plan := v_base;

  SELECT * INTO v_trial FROM public.plan_trials
  WHERE store_id = p_store_id AND status = 'active' AND ends_at > now()
  ORDER BY started_at DESC LIMIT 1;
  IF FOUND AND public.plan_rank(v_trial.trial_plan) > public.plan_rank(v_base) THEN
    v_plan := lower(v_trial.trial_plan); v_trial_active := true;
  END IF;

  IF v_plan IN ('premium', 'marca') THEN v_limit := NULL; v_unlimited := true;
  ELSIF v_plan = 'pro' THEN v_limit := 150;
  ELSE v_limit := 20; END IF;

  RETURN jsonb_build_object(
    'plan', v_plan, 'basePlan', v_base, 'productLimit', v_limit, 'unlimited', v_unlimited,
    'subscriptionStatus', COALESCE(v_sub.status, 'none'), 'subscriptionId', v_sub.id,
    'trialActive', v_trial_active,
    'trialPlan', CASE WHEN v_trial_active THEN lower(v_trial.trial_plan) ELSE NULL END,
    'trialEndsAt', CASE WHEN v_trial_active THEN v_trial.ends_at ELSE NULL END,
    'planSource', v_source,
    'brandAccountId', v_owned.brand_account_id,
    'ownedStoreRole', v_owned.store_role,
    'resolved', true);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_product_plan_usage(p_store_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_plan jsonb; v_total integer := 0; v_active integer := 0; v_limit integer; v_remaining integer;
BEGIN
  IF p_store_id IS NULL OR (public.merchant_request_store_id() IS NOT NULL AND public.merchant_request_store_id() <> p_store_id) THEN
    RAISE EXCEPTION 'Não autorizado';
  END IF;
  v_plan := public.get_effective_store_plan(p_store_id);
  v_limit := NULLIF(v_plan->>'productLimit', '')::integer;
  SELECT COUNT(*), COUNT(*) FILTER (WHERE is_active = true) INTO v_total, v_active
  FROM public.products WHERE user_id = p_store_id;
  v_remaining := CASE WHEN (v_plan->>'unlimited')::boolean THEN NULL ELSE GREATEST(0, COALESCE(v_limit, 0) - v_active) END;
  RETURN jsonb_build_object(
    'plan', v_plan->>'plan', 'productLimit', v_limit, 'unlimited', (v_plan->>'unlimited')::boolean,
    'subscriptionStatus', v_plan->>'subscriptionStatus', 'totalProducts', v_total, 'activeProducts', v_active,
    'remainingActivations', v_remaining,
    'canActivateMore', CASE WHEN (v_plan->>'unlimited')::boolean THEN true ELSE v_active < COALESCE(v_limit, 0) END,
    'planSource', v_plan->>'planSource', 'ownedStoreRole', v_plan->>'ownedStoreRole');
END;
$function$
;

CREATE OR REPLACE FUNCTION public.is_public_store(store_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = store_user_id
      AND store_slug IS NOT NULL
      AND COALESCE(account_status, 'active') = 'active'
      AND COALESCE(is_maintenance_mode, false) = false
  )
$function$
;

CREATE OR REPLACE FUNCTION public.plan_rank(_plan text)
 RETURNS integer
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  SELECT CASE lower(coalesce(_plan, ''))
    WHEN 'marca' THEN 4
    WHEN 'premium' THEN 3
    WHEN 'pro' THEN 2
    ELSE 1
  END
$function$
;

CREATE OR REPLACE FUNCTION public.propagate_brand_plan_to_secondaries(p_owner_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE r record; v jsonb; n integer := 0; v_claims text; v_actor uuid := auth.uid();
BEGIN
  FOR r IN SELECT o.store_profile_id FROM public.brand_account_owned_stores o
           JOIN public.brand_accounts b ON b.id = o.brand_account_id
           WHERE b.owner_profile_id = p_owner_id AND o.store_role = 'secondary'
  LOOP
    v := public.get_effective_store_plan(r.store_profile_id);
    IF COALESCE((v->>'unlimited')::boolean, false) THEN
      v_claims := current_setting('request.jwt.claims', true);
      BEGIN
        PERFORM set_config('request.jwt.claims', '', true);
        PERFORM public.reactivate_products_after_upgrade(r.store_profile_id, NULL);
        PERFORM set_config('request.jwt.claims', COALESCE(v_claims, ''), true);
      EXCEPTION WHEN others THEN
        PERFORM set_config('request.jwt.claims', COALESCE(v_claims, ''), true);
        INSERT INTO public.audit_logs(user_id, action, entity_type, entity_id, metadata)
        VALUES (v_actor, 'BRAND_SECONDARY_RESTORE_FAILED', 'profile', r.store_profile_id, jsonb_build_object('error', SQLERRM));
      END;
    ELSE
      PERFORM public.reapply_plan_limits_after_trial(r.store_profile_id, v->>'plan');
    END IF;
    n := n + 1;
  END LOOP;
  RETURN n;
END $function$
;

CREATE OR REPLACE FUNCTION public.reactivate_products_after_upgrade(p_user_id uuid, p_max_products integer)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
        was_active_before_plan_restriction = false,
        updated_at = now()
    WHERE user_id = p_user_id
      AND is_active = false
      AND was_active_before_plan_restriction = true
      AND inactive_reason IN ('plan_limit', 'pending_plan_limit', 'clone_pending_plan_limit');
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
          AND was_active_before_plan_restriction = true
          AND inactive_reason IN ('plan_limit', 'pending_plan_limit', 'clone_pending_plan_limit')
        ORDER BY created_at ASC, id ASC
        LIMIT v_can_reactivate
      ) sub;

      IF v_ids IS NOT NULL THEN
        UPDATE public.products
        SET is_active = true,
            inactive_reason = NULL,
            was_active_before_plan_restriction = false,
            updated_at = now()
        WHERE id = ANY(v_ids);
        GET DIAGNOSTICS v_reactivated = ROW_COUNT;
      END IF;
    END IF;
  END IF;

  RETURN v_reactivated;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.reapply_plan_limits_after_trial(p_store_id uuid, p_plan text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_deactivated integer := 0;
BEGIN
  IF lower(coalesce(p_plan,'')) IN ('premium', 'marca') THEN
    RETURN 0;
  END IF;

  v_deactivated := public.apply_confirmed_plan_downgrade(
    p_store_id,
    CASE WHEN lower(p_plan) = 'pro' THEN 'pro' ELSE 'gratis' END
  );

  UPDATE public.products
  SET was_active_before_plan_restriction = true
  WHERE user_id = p_store_id
    AND is_active = false
    AND inactive_reason = 'plan_limit'
    AND was_active_before_plan_restriction IS DISTINCT FROM true;

  RETURN v_deactivated;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.trg_propagate_brand_plan()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status AND NEW.plan_id IS NOT DISTINCT FROM OLD.plan_id THEN
    RETURN NEW;
  END IF;
  IF EXISTS (SELECT 1 FROM public.brand_accounts WHERE owner_profile_id = NEW.user_id) THEN
    PERFORM public.propagate_brand_plan_to_secondaries(NEW.user_id);
  END IF;
  RETURN NEW;
END $function$
;

CREATE OR REPLACE FUNCTION public.validate_product_activation_limit()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_plan jsonb;
  v_limit integer;
  v_active_count integer;
  v_user_id uuid;
BEGIN
  IF NEW.is_active IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.is_active IS TRUE THEN
    RETURN NEW;
  END IF;

  v_user_id := NEW.user_id;

  IF public.merchant_request_store_id() IS NOT NULL AND public.merchant_request_store_id() <> v_user_id THEN
    RAISE EXCEPTION 'Não autorizado';
  END IF;

  v_plan := public.get_effective_store_plan(v_user_id);

  IF COALESCE((v_plan->>'unlimited')::boolean, false) THEN
    IF TG_OP = 'UPDATE' THEN
      NEW.inactive_reason := NULL;
      NEW.was_active_before_plan_restriction := false;
    END IF;
    RETURN NEW;
  END IF;

  v_limit := NULLIF(v_plan->>'productLimit', '')::integer;

  SELECT COUNT(*)
  INTO v_active_count
  FROM public.products
  WHERE user_id = v_user_id
    AND is_active = true
    AND (TG_OP = 'INSERT' OR id <> NEW.id);

  IF v_active_count >= COALESCE(v_limit, 0) THEN
    RAISE EXCEPTION 'Você atingiu o limite de produtos ativos do seu plano. Faça upgrade para publicar mais produtos.';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    NEW.inactive_reason := NULL;
    NEW.was_active_before_plan_restriction := false;
  END IF;

  RETURN NEW;
END;
$function$
;
