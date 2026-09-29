-- Pausada/inadimplente sem nenhuma data financeira confiável não concede plano pago (revisão manual pela rotina diária).
CREATE OR REPLACE FUNCTION public.get_base_store_plan(p_store_id uuid)
 RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_plan_id text; v_res text;
BEGIN
  IF p_store_id IS NULL THEN RETURN 'free'; END IF;
  SELECT plan_id INTO v_plan_id FROM public.master_subscriptions
  WHERE user_id = p_store_id AND status IN ('active', 'past_due')
    AND NOT (status = 'past_due' AND grace_period_ends_at IS NOT NULL AND grace_period_ends_at < now())
    AND NOT (status = 'past_due' AND grace_period_ends_at IS NULL AND current_period_end IS NULL)
  ORDER BY created_at DESC NULLS LAST, updated_at DESC NULLS LAST, id DESC LIMIT 1;
  IF v_plan_id IS NOT NULL AND lower(v_plan_id) NOT IN ('marca','premium','pro','gratis','free') THEN
    RAISE WARNING 'UNKNOWN_PLAN_CODE store=% value=% at=%', p_store_id, v_plan_id, now();
  END IF;
  v_res := CASE lower(coalesce(v_plan_id, '')) WHEN 'marca' THEN 'marca' WHEN 'premium' THEN 'premium' WHEN 'pro' THEN 'pro' ELSE 'free' END;
  IF v_res = 'free' AND public.get_brand_inherited_plan(p_store_id) = 'marca' THEN v_res := 'marca'; END IF;
  RETURN v_res;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_effective_store_plan(p_store_id uuid)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_sub RECORD; v_plan text := 'free'; v_base text := 'free'; v_limit integer := 20;
  v_unlimited boolean := false; v_trial RECORD; v_trial_active boolean := false;
  v_source text := 'free_fallback'; v_owned RECORD;
BEGIN
  IF p_store_id IS NULL THEN
    RETURN jsonb_build_object('plan','unknown','productLimit',NULL,'unlimited',false,
      'subscriptionStatus','unknown','subscriptionId',NULL,'resolved',false);
  END IF;

  SELECT id, plan_id, status, no_charge, created_at, updated_at INTO v_sub
  FROM public.master_subscriptions
  WHERE user_id = p_store_id AND status IN ('active', 'past_due')
    AND NOT (status = 'past_due' AND grace_period_ends_at IS NOT NULL AND grace_period_ends_at < now())
    AND NOT (status = 'past_due' AND grace_period_ends_at IS NULL AND current_period_end IS NULL)
  ORDER BY created_at DESC NULLS LAST, updated_at DESC NULLS LAST, id DESC LIMIT 1;

  IF FOUND THEN
    IF v_sub.plan_id IS NOT NULL AND lower(v_sub.plan_id) NOT IN ('marca','premium','pro','gratis','free') THEN
      RAISE WARNING 'UNKNOWN_PLAN_CODE store=% value=% at=%', p_store_id, v_sub.plan_id, now();
    END IF;
    v_base := CASE lower(coalesce(v_sub.plan_id, '')) WHEN 'marca' THEN 'marca' WHEN 'premium' THEN 'premium' WHEN 'pro' THEN 'pro' ELSE 'free' END;
    IF v_base <> 'free' THEN v_source := 'direct'; END IF;
  END IF;

  SELECT brand_account_id, store_role INTO v_owned
  FROM public.brand_account_owned_stores WHERE store_profile_id = p_store_id;

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
$function$;