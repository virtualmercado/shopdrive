-- 1. Link: allow a secondary store with a currently paid own subscription (active, period not ended). Pending/past_due still blocked.
CREATE OR REPLACE FUNCTION public.validate_brand_owned_store()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_owner uuid; p record;
BEGIN
  SELECT owner_profile_id INTO v_owner FROM public.brand_accounts WHERE id = NEW.brand_account_id;
  SELECT id, is_template_profile, source_template_id, account_status INTO p
    FROM public.profiles WHERE id = NEW.store_profile_id;
  IF p.id IS NULL THEN RAISE EXCEPTION 'Loja não encontrada.' USING ERRCODE='P0001'; END IF;
  IF COALESCE(p.is_template_profile,false) THEN RAISE EXCEPTION 'Perfis de template não podem ser lojas próprias.' USING ERRCODE='P0001'; END IF;
  IF p.account_status IN ('excluida','exclusao_solicitada') THEN RAISE EXCEPTION 'Conta excluída ou em exclusão não pode ser loja própria.' USING ERRCODE='P0001'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = NEW.store_profile_id AND role = 'user')
     OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = NEW.store_profile_id AND role NOT IN ('user','admin')) THEN
    RAISE EXCEPTION 'Contas internas não podem ser lojas próprias.' USING ERRCODE='P0001'; END IF;
  IF NEW.store_role = 'primary' THEN
    IF v_owner IS NULL OR NEW.store_profile_id <> v_owner THEN
      RAISE EXCEPTION 'A loja principal deve ser a do responsável da empresa.' USING ERRCODE='P0001'; END IF;
  ELSE
    IF v_owner IS NOT NULL AND NEW.store_profile_id = v_owner THEN
      RAISE EXCEPTION 'A loja adicional deve ser diferente da principal.' USING ERRCODE='P0001'; END IF;
    IF p.source_template_id IS NOT NULL THEN
      RAISE EXCEPTION 'Lojas originadas de template (revendedores) não podem ser lojas próprias.' USING ERRCODE='P0001'; END IF;
    -- Own paid plan may coexist only while its already-paid period is running (status active, period end in the future).
    IF EXISTS (SELECT 1 FROM public.master_subscriptions
               WHERE user_id = NEW.store_profile_id AND status IN ('active','past_due','pending')
                 AND lower(coalesce(plan_id,'')) NOT IN ('gratis','free')
                 AND NOT (status = 'active' AND current_period_end IS NOT NULL AND current_period_end > now())) THEN
      RAISE EXCEPTION 'Esta loja possui uma assinatura própria pendente ou inadimplente. Regularize a assinatura antes de vinculá-la como loja adicional do Plano MARCA.' USING ERRCODE='P0001'; END IF;
  END IF;
  RETURN NEW;
END $function$;

-- 2. Secondary stores: no new/extended/reactivated own paid entitlement; closing or unchanged-period updates allowed.
CREATE OR REPLACE FUNCTION public.guard_secondary_store_subscription()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF lower(coalesce(NEW.plan_id,'')) NOT IN ('gratis','free')
     AND NEW.status IN ('active','past_due','pending')
     AND EXISTS (SELECT 1 FROM public.brand_account_owned_stores WHERE store_profile_id = NEW.user_id AND store_role = 'secondary') THEN
    IF TG_OP = 'UPDATE'
       AND OLD.status IN ('active','past_due')
       AND NEW.status = OLD.status
       AND lower(coalesce(NEW.plan_id,'')) = lower(coalesce(OLD.plan_id,''))
       AND NEW.current_period_end IS NOT DISTINCT FROM OLD.current_period_end THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Esta loja está vinculada a uma empresa do Plano MARCA e utiliza a assinatura principal da empresa.' USING ERRCODE='P0001';
  END IF;
  RETURN NEW;
END $function$;

-- 3. Resolver: for a linked secondary, own paid plan counts only until its paid period ends; then MARCA inherited (never Free).
CREATE OR REPLACE FUNCTION public.get_effective_store_plan(p_store_id uuid)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
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
$function$;

-- 4. Defense: never deactivate products of a store whose effective plan is unlimited.
CREATE OR REPLACE FUNCTION public.apply_confirmed_plan_downgrade(p_store_id uuid, p_new_plan text)
 RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_plan text := lower(coalesce(p_new_plan, ''));
  v_limit integer;
  v_deactivated integer := 0;
BEGIN
  IF p_store_id IS NULL THEN RAISE EXCEPTION 'Loja obrigatória'; END IF;
  IF v_plan IN ('gratis', 'free') THEN v_limit := 20;
  ELSIF v_plan = 'pro' THEN v_limit := 150;
  ELSIF v_plan IN ('premium', 'marca') THEN RETURN 0;
  ELSE RAISE EXCEPTION 'Plano inválido: %', p_new_plan; END IF;

  IF COALESCE((public.get_effective_store_plan(p_store_id)->>'unlimited')::boolean, false) THEN
    RETURN 0;
  END IF;

  WITH ranked AS (
    SELECT id, row_number() OVER (PARTITION BY user_id
             ORDER BY COALESCE(sales_count, 0) DESC, COALESCE(is_featured, false) DESC, created_at DESC, id ASC) AS rn
    FROM public.products WHERE user_id = p_store_id AND is_active = true
  ), affected AS (
    UPDATE public.products p SET is_active = false, inactive_reason = 'plan_limit', updated_at = now()
    FROM ranked r WHERE p.id = r.id AND r.rn > v_limit RETURNING p.id
  )
  SELECT COUNT(*) INTO v_deactivated FROM affected;
  RETURN v_deactivated;
END;
$function$;

-- 5. Unlink: an own paid subscription whose period already ended while linked is closed, so normal Free rules apply; valid ones are kept.
CREATE OR REPLACE FUNCTION public.admin_unlink_brand_owned_store(p_brand_account_id uuid, p_store_profile_id uuid)
 RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_role text; v jsonb; r record;
BEGIN
  PERFORM public.assert_caller_is_admin();
  PERFORM 1 FROM public.brand_accounts WHERE id = p_brand_account_id FOR UPDATE;
  SELECT store_role INTO v_role FROM public.brand_account_owned_stores
   WHERE brand_account_id = p_brand_account_id AND store_profile_id = p_store_profile_id;
  IF v_role IS NULL THEN RAISE EXCEPTION 'Vínculo não encontrado.' USING ERRCODE='P0001'; END IF;
  IF v_role = 'primary' THEN RAISE EXCEPTION 'A loja principal não pode ser desvinculada enquanto for do responsável da empresa.' USING ERRCODE='P0001'; END IF;
  DELETE FROM public.brand_account_owned_stores WHERE brand_account_id = p_brand_account_id AND store_profile_id = p_store_profile_id;
  FOR r IN SELECT id FROM public.master_subscriptions
           WHERE user_id = p_store_profile_id AND status IN ('active','past_due')
             AND lower(coalesce(plan_id,'')) NOT IN ('gratis','free')
             AND (current_period_end IS NULL OR current_period_end <= now())
  LOOP
    UPDATE public.master_subscriptions SET status='cancelled', cancelled_at=now(), updated_at=now() WHERE id = r.id;
    INSERT INTO public.master_subscription_logs(subscription_id, user_id, event_type, event_description, metadata)
    VALUES (r.id, p_store_profile_id, 'subscription_expired_after_marca_unlink',
            'Período próprio já encerrado durante o vínculo MARCA; encerrado ao desvincular.', jsonb_build_object('brand_account_id', p_brand_account_id));
  END LOOP;
  v := public.get_effective_store_plan(p_store_profile_id);
  IF NOT COALESCE((v->>'unlimited')::boolean, false) THEN
    PERFORM public.reapply_plan_limits_after_trial(p_store_profile_id, v->>'plan');
  END IF;
  PERFORM public.log_audit_event('BRAND_OWNED_STORE_UNLINKED', 'brand_account', p_brand_account_id,
    jsonb_build_object('store_profile_id', p_store_profile_id, 'new_plan', v->>'plan'));
  RETURN true;
END $function$;