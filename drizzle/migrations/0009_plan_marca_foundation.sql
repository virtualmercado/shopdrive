-- Fail-safe global flag reader: missing row / error => false
CREATE OR REPLACE FUNCTION public.is_plan_marca_enabled()
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v boolean;
BEGIN
  SELECT enabled INTO v FROM public.onboarding_feature_flags WHERE flag_key = 'ENABLE_PLAN_MARCA';
  RETURN COALESCE(v, false);
EXCEPTION WHEN OTHERS THEN
  RETURN false;
END; $$;
REVOKE ALL ON FUNCTION public.is_plan_marca_enabled() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_plan_marca_enabled() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.plan_rank(_plan text)
RETURNS integer LANGUAGE sql IMMUTABLE SET search_path TO 'public' AS $$
  SELECT CASE lower(coalesce(_plan, ''))
    WHEN 'marca' THEN 4
    WHEN 'premium' THEN 3
    WHEN 'pro' THEN 2
    ELSE 1
  END
$$;

CREATE OR REPLACE FUNCTION public.get_base_store_plan(p_store_id uuid)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_plan_id text;
BEGIN
  IF p_store_id IS NULL THEN
    RETURN 'free';
  END IF;

  SELECT plan_id INTO v_plan_id
  FROM public.master_subscriptions
  WHERE user_id = p_store_id
    AND status IN ('active', 'past_due')
  ORDER BY created_at DESC NULLS LAST, updated_at DESC NULLS LAST, id DESC
  LIMIT 1;

  IF v_plan_id IS NOT NULL AND lower(v_plan_id) NOT IN ('marca','premium','pro','gratis','free') THEN
    RAISE WARNING 'UNKNOWN_PLAN_CODE store=% value=% at=%', p_store_id, v_plan_id, now();
  END IF;

  RETURN CASE lower(coalesce(v_plan_id, ''))
    WHEN 'marca' THEN 'marca'
    WHEN 'premium' THEN 'premium'
    WHEN 'pro' THEN 'pro'
    ELSE 'free'
  END;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_effective_store_plan(p_store_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_sub RECORD;
  v_plan text := 'free';
  v_base text := 'free';
  v_limit integer := 20;
  v_unlimited boolean := false;
  v_trial RECORD;
  v_trial_active boolean := false;
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
  ORDER BY created_at DESC NULLS LAST,
           updated_at DESC NULLS LAST,
           id DESC
  LIMIT 1;

  IF FOUND THEN
    IF v_sub.plan_id IS NOT NULL AND lower(v_sub.plan_id) NOT IN ('marca','premium','pro','gratis','free') THEN
      RAISE WARNING 'UNKNOWN_PLAN_CODE store=% value=% at=%', p_store_id, v_sub.plan_id, now();
    END IF;
    v_base := CASE lower(coalesce(v_sub.plan_id, ''))
      WHEN 'marca' THEN 'marca'
      WHEN 'premium' THEN 'premium'
      WHEN 'pro' THEN 'pro'
      ELSE 'free'
    END;
  END IF;

  v_plan := v_base;

  SELECT * INTO v_trial
  FROM public.plan_trials
  WHERE store_id = p_store_id
    AND status = 'active'
    AND ends_at > now()
  ORDER BY started_at DESC
  LIMIT 1;

  IF FOUND AND public.plan_rank(v_trial.trial_plan) > public.plan_rank(v_base) THEN
    v_plan := lower(v_trial.trial_plan);
    v_trial_active := true;
  END IF;

  IF v_plan IN ('premium', 'marca') THEN
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
    'basePlan', v_base,
    'productLimit', v_limit,
    'unlimited', v_unlimited,
    'subscriptionStatus', COALESCE(v_sub.status, 'none'),
    'subscriptionId', v_sub.id,
    'trialActive', v_trial_active,
    'trialPlan', CASE WHEN v_trial_active THEN lower(v_trial.trial_plan) ELSE NULL END,
    'trialEndsAt', CASE WHEN v_trial_active THEN v_trial.ends_at ELSE NULL END,
    'resolved', true
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_store_customer_limit(p_store_id uuid)
RETURNS integer LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_plan text;
BEGIN
  v_plan := coalesce(public.get_effective_store_plan(p_store_id) ->> 'plan', 'free');
  IF v_plan IN ('premium', 'marca') THEN
    RETURN NULL;
  ELSIF v_plan = 'pro' THEN
    RETURN 300;
  END IF;
  RETURN 40;
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_confirmed_plan_downgrade(p_store_id uuid, p_new_plan text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
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
  ELSIF v_plan IN ('premium', 'marca') THEN
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

CREATE OR REPLACE FUNCTION public.reapply_plan_limits_after_trial(p_store_id uuid, p_plan text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
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
$$;