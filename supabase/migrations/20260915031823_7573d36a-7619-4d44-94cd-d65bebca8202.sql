-- 1. Plan rank helper
CREATE OR REPLACE FUNCTION public.plan_rank(_plan text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE lower(coalesce(_plan, ''))
    WHEN 'premium' THEN 3
    WHEN 'pro' THEN 2
    ELSE 1
  END
$$;

-- 2. Table
CREATE TABLE public.plan_trials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL,
  base_plan text NOT NULL,
  trial_plan text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'active',
  granted_by uuid,
  reason text,
  ended_at timestamptz,
  ended_by uuid,
  end_reason text,
  converted_plan text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.plan_trials
  ADD CONSTRAINT plan_trials_trial_plan_check CHECK (lower(trial_plan) IN ('pro','premium')),
  ADD CONSTRAINT plan_trials_status_check CHECK (status IN ('active','expired','cancelled','converted'));

CREATE UNIQUE INDEX plan_trials_one_active_per_store
  ON public.plan_trials (store_id) WHERE status = 'active';
CREATE INDEX plan_trials_store_idx ON public.plan_trials (store_id, created_at DESC);
CREATE INDEX plan_trials_active_ends_idx ON public.plan_trials (ends_at) WHERE status = 'active';

GRANT SELECT ON public.plan_trials TO authenticated;
GRANT ALL ON public.plan_trials TO service_role;

ALTER TABLE public.plan_trials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Store owner reads own trials"
  ON public.plan_trials FOR SELECT TO authenticated
  USING (store_id = auth.uid());

CREATE POLICY "Admins read all trials"
  ON public.plan_trials FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER plan_trials_updated_at
  BEFORE UPDATE ON public.plan_trials
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 3. Base plan resolver (subscription-only, no trial)
CREATE OR REPLACE FUNCTION public.get_base_store_plan(p_store_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
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

  RETURN CASE lower(coalesce(v_plan_id, ''))
    WHEN 'premium' THEN 'premium'
    WHEN 'pro' THEN 'pro'
    ELSE 'free'
  END;
END;
$$;

-- 4. Effective plan now considers a valid trial (timestamp is the source of truth)
CREATE OR REPLACE FUNCTION public.get_effective_store_plan(p_store_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
    v_base := CASE lower(coalesce(v_sub.plan_id, ''))
      WHEN 'premium' THEN 'premium'
      WHEN 'pro' THEN 'pro'
      ELSE 'free'
    END;
  END IF;

  v_plan := v_base;

  -- Temporary entitlement: only while not expired and strictly better than base
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
$function$;

-- 5. Shared helper: re-apply base plan limits after a trial ends (never deletes data)
CREATE OR REPLACE FUNCTION public.reapply_plan_limits_after_trial(p_store_id uuid, p_plan text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deactivated integer := 0;
BEGIN
  IF lower(coalesce(p_plan,'')) IN ('premium') THEN
    RETURN 0;
  END IF;

  v_deactivated := public.apply_confirmed_plan_downgrade(
    p_store_id,
    CASE WHEN lower(p_plan) = 'pro' THEN 'pro' ELSE 'gratis' END
  );

  -- Keep them restorable by the existing upgrade flow (nothing is deleted)
  UPDATE public.products
  SET was_active_before_plan_restriction = true
  WHERE user_id = p_store_id
    AND is_active = false
    AND inactive_reason = 'plan_limit'
    AND was_active_before_plan_restriction IS DISTINCT FROM true;

  RETURN v_deactivated;
END;
$$;

-- 6. Admin: grant trial (7 days, no billing side effects)
CREATE OR REPLACE FUNCTION public.admin_grant_plan_trial(
  p_store_id uuid,
  p_trial_plan text,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan text := lower(coalesce(p_trial_plan, ''));
  v_base text;
  v_effective jsonb;
  v_trial public.plan_trials;
  v_limit integer;
BEGIN
  PERFORM public.assert_caller_is_admin();

  IF p_store_id IS NULL THEN
    RAISE EXCEPTION 'Loja obrigatória';
  END IF;
  IF v_plan NOT IN ('pro','premium') THEN
    RAISE EXCEPTION 'Plano de degustação inválido: %', p_trial_plan;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_store_id) THEN
    RAISE EXCEPTION 'Assinante não encontrado';
  END IF;

  -- Serialize concurrent grants for the same store
  PERFORM pg_advisory_xact_lock(hashtextextended(p_store_id::text, 0));

  IF EXISTS (
    SELECT 1 FROM public.plan_trials
    WHERE store_id = p_store_id AND status = 'active' AND ends_at > now()
  ) THEN
    RAISE EXCEPTION 'Este assinante já possui uma degustação ativa' USING ERRCODE = '23505';
  END IF;

  v_effective := public.get_effective_store_plan(p_store_id);
  v_base := coalesce(v_effective->>'basePlan', 'free');

  IF public.plan_rank(v_plan) <= public.plan_rank(v_base) THEN
    RAISE EXCEPTION 'Este assinante já possui um plano igual ou superior ao selecionado';
  END IF;

  INSERT INTO public.plan_trials (
    store_id, base_plan, trial_plan, started_at, ends_at, status, granted_by, reason
  ) VALUES (
    p_store_id, v_base, v_plan, now(), now() + interval '7 days', 'active', auth.uid(), nullif(btrim(coalesce(p_reason,'')), '')
  )
  RETURNING * INTO v_trial;

  -- Restore products previously hidden by plan limits, within the trial plan limit
  v_limit := CASE WHEN v_plan = 'premium' THEN NULL ELSE 150 END;
  PERFORM public.reactivate_products_after_upgrade(p_store_id, v_limit);

  INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, metadata)
  VALUES (auth.uid(), 'plan_trial_granted', 'plan_trial', v_trial.id,
    jsonb_build_object('store_id', p_store_id, 'base_plan', v_base, 'trial_plan', v_plan,
                       'ends_at', v_trial.ends_at, 'reason', v_trial.reason));

  RETURN to_jsonb(v_trial);
END;
$$;

-- 7. Admin: end trial early (idempotent)
CREATE OR REPLACE FUNCTION public.admin_end_plan_trial(
  p_trial_id uuid,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_trial public.plan_trials;
  v_base text;
BEGIN
  PERFORM public.assert_caller_is_admin();

  SELECT * INTO v_trial FROM public.plan_trials WHERE id = p_trial_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Degustação não encontrada';
  END IF;

  IF v_trial.status <> 'active' THEN
    RETURN to_jsonb(v_trial); -- idempotent
  END IF;

  v_base := public.get_base_store_plan(v_trial.store_id);

  UPDATE public.plan_trials
  SET status = 'cancelled',
      ended_at = now(),
      ended_by = auth.uid(),
      end_reason = nullif(btrim(coalesce(p_reason,'')), ''),
      converted_plan = v_base
  WHERE id = p_trial_id
  RETURNING * INTO v_trial;

  PERFORM public.reapply_plan_limits_after_trial(v_trial.store_id, v_base);

  INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, metadata)
  VALUES (auth.uid(), 'plan_trial_cancelled', 'plan_trial', v_trial.id,
    jsonb_build_object('store_id', v_trial.store_id, 'base_plan', v_base,
                       'trial_plan', v_trial.trial_plan, 'reason', v_trial.end_reason));

  RETURN to_jsonb(v_trial);
END;
$$;

-- 8. Reconciliation job (idempotent). Timestamp already blocks access; this reapplies limits.
CREATE OR REPLACE FUNCTION public.expire_plan_trials()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
  v_base text;
  v_status text;
  v_processed integer := 0;
BEGIN
  FOR r IN
    SELECT * FROM public.plan_trials
    WHERE status = 'active' AND ends_at <= now()
    ORDER BY ends_at ASC
    FOR UPDATE SKIP LOCKED
  LOOP
    v_base := public.get_base_store_plan(r.store_id);
    -- User bought the same (or better) plan during the trial: conversion, no downgrade
    v_status := CASE WHEN public.plan_rank(v_base) >= public.plan_rank(r.trial_plan)
                     THEN 'converted' ELSE 'expired' END;

    UPDATE public.plan_trials
    SET status = v_status,
        ended_at = now(),
        end_reason = coalesce(end_reason, CASE WHEN v_status = 'converted' THEN 'converted_to_paid' ELSE 'expired' END),
        converted_plan = v_base
    WHERE id = r.id;

    IF v_status = 'expired' THEN
      PERFORM public.reapply_plan_limits_after_trial(r.store_id, v_base);
    END IF;

    v_processed := v_processed + 1;
  END LOOP;

  RETURN jsonb_build_object('processed', v_processed, 'ran_at', now());
END;
$$;

REVOKE ALL ON FUNCTION public.admin_grant_plan_trial(uuid, text, text) FROM public;
REVOKE ALL ON FUNCTION public.admin_end_plan_trial(uuid, text) FROM public;
REVOKE ALL ON FUNCTION public.expire_plan_trials() FROM public;
GRANT EXECUTE ON FUNCTION public.admin_grant_plan_trial(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_end_plan_trial(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.expire_plan_trials() TO service_role;
GRANT EXECUTE ON FUNCTION public.plan_rank(text) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.get_base_store_plan(uuid) TO authenticated, service_role;
