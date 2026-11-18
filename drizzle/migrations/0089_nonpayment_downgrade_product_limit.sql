-- Nonpayment downgrade must reconcile active products (limit by plan) atomically.
-- Root cause: check-billing-status skipped expired-grace subscriptions because the resolver
-- (correctly) no longer returns them, so apply_confirmed_plan_downgrade never ran.
-- Rollback: products deactivated here are listed per store in audit_logs
-- (action PLAN_LIMIT_PRODUCTS_DEACTIVATED, metadata.product_ids) and carry
-- inactive_reason='plan_limit' + was_active_before_plan_restriction=true.

CREATE OR REPLACE FUNCTION public.apply_confirmed_plan_downgrade(p_store_id uuid, p_new_plan text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_plan text := lower(coalesce(p_new_plan, ''));
  v_limit integer;
  v_eff jsonb;
  v_ids uuid[];
BEGIN
  IF p_store_id IS NULL THEN RAISE EXCEPTION 'Loja obrigatória'; END IF;
  IF v_plan IN ('gratis', 'free') THEN v_limit := 20;
  ELSIF v_plan = 'pro' THEN v_limit := 150;
  ELSIF v_plan IN ('premium', 'marca') THEN RETURN 0;
  ELSE RAISE EXCEPTION 'Plano inválido: %', p_new_plan; END IF;

  -- One reconciliation per store at a time (shared with reactivate_products_after_upgrade).
  PERFORM pg_advisory_xact_lock(hashtextextended('plan-limit-store:' || p_store_id::text, 0));

  v_eff := public.get_effective_store_plan(p_store_id);
  IF COALESCE((v_eff->>'unlimited')::boolean, false) THEN
    RETURN 0;
  END IF;
  -- Never go below what the store is effectively entitled to right now.
  v_limit := GREATEST(v_limit, COALESCE(NULLIF(v_eff->>'productLimit', '')::integer, v_limit));

  -- Keep the oldest active products (created_at, then id); only currently active rows are ranked.
  WITH ranked AS (
    SELECT id, row_number() OVER (ORDER BY created_at ASC, id ASC) AS rn
    FROM public.products WHERE user_id = p_store_id AND is_active = true
  ), affected AS (
    UPDATE public.products p
    SET is_active = false,
        inactive_reason = 'plan_limit',
        was_active_before_plan_restriction = true,
        updated_at = now()
    FROM ranked r WHERE p.id = r.id AND r.rn > v_limit
    RETURNING p.id
  )
  SELECT array_agg(id ORDER BY id) INTO v_ids FROM affected;

  IF v_ids IS NOT NULL THEN
    INSERT INTO public.audit_logs(user_id, action, entity_type, entity_id, metadata)
    VALUES (NULL, 'PLAN_LIMIT_PRODUCTS_DEACTIVATED', 'profile', p_store_id,
      jsonb_build_object('store_id', p_store_id, 'plan', v_plan, 'limit', v_limit,
        'rule', 'keep_oldest_active', 'count', cardinality(v_ids), 'product_ids', to_jsonb(v_ids)));
  END IF;

  RETURN COALESCE(cardinality(v_ids), 0);
END;
$function$;

CREATE OR REPLACE FUNCTION public.reactivate_products_after_upgrade(p_user_id uuid, p_max_products integer)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_active_count integer;
  v_ids uuid[];
BEGIN
  IF p_user_id IS NULL THEN RETURN 0; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('plan-limit-store:' || p_user_id::text, 0));

  SELECT COUNT(*) INTO v_active_count
  FROM public.products
  WHERE user_id = p_user_id AND is_active = true;

  -- Only products the system itself deactivated for plan limit; manual/previous inactive rows stay.
  SELECT array_agg(id) INTO v_ids FROM (
    SELECT id FROM public.products
    WHERE user_id = p_user_id
      AND is_active = false
      AND was_active_before_plan_restriction = true
      AND inactive_reason IN ('plan_limit', 'pending_plan_limit', 'clone_pending_plan_limit')
    ORDER BY created_at ASC, id ASC
    LIMIT CASE WHEN p_max_products IS NULL THEN NULL ELSE GREATEST(0, p_max_products - v_active_count) END
  ) sub;

  IF v_ids IS NULL THEN RETURN 0; END IF;

  UPDATE public.products
  SET is_active = true,
      inactive_reason = NULL,
      was_active_before_plan_restriction = false,
      updated_at = now()
  WHERE id = ANY(v_ids);

  INSERT INTO public.audit_logs(user_id, action, entity_type, entity_id, metadata)
  VALUES (NULL, 'PLAN_LIMIT_PRODUCTS_REACTIVATED', 'profile', p_user_id,
    jsonb_build_object('store_id', p_user_id, 'max_products', p_max_products,
      'count', cardinality(v_ids), 'product_ids', to_jsonb(v_ids)));

  RETURN cardinality(v_ids);
END;
$function$;

-- Atomic nonpayment downgrade for one subscription whose tolerance has ended.
CREATE OR REPLACE FUNCTION public.apply_nonpayment_downgrade(p_subscription_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  s public.master_subscriptions;
  v_latest uuid;
  v_count integer;
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'service_role_required' USING ERRCODE = '42501';
  END IF;

  -- Lock order: subscription row, then store (same order as payment application).
  SELECT * INTO s FROM public.master_subscriptions WHERE id = p_subscription_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('applied', false, 'reason', 'not_found'); END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('plan-limit-store:' || s.user_id::text, 0));

  IF s.no_charge IS TRUE OR lower(coalesce(s.plan_id, '')) IN ('', 'gratis', 'free') THEN
    RETURN jsonb_build_object('applied', false, 'reason', 'not_paid_plan');
  END IF;
  IF s.status NOT IN ('past_due', 'active') OR s.grace_period_ends_at IS NULL OR s.grace_period_ends_at >= now() THEN
    RETURN jsonb_build_object('applied', false, 'reason', 'grace_not_expired');
  END IF;
  IF s.current_period_end IS NOT NULL AND s.current_period_end > now() THEN
    RETURN jsonb_build_object('applied', false, 'reason', 'paid_period_running');
  END IF;
  -- Linked MARCA stores keep their existing billing rules (resolver handles them).
  IF EXISTS (SELECT 1 FROM public.brand_account_owned_stores
             WHERE store_profile_id = s.user_id AND store_role = 'secondary') THEN
    RETURN jsonb_build_object('applied', false, 'reason', 'linked_secondary');
  END IF;
  -- Only the store's newest active/past_due subscription can downgrade it (older rows, including a
  -- previous 'gratis' downgrade row, never block or trigger a new cycle). Entitlements from trials or
  -- other sources are re-checked by apply_confirmed_plan_downgrade.
  SELECT id INTO v_latest FROM public.master_subscriptions
  WHERE user_id = s.user_id AND status IN ('active', 'past_due')
  ORDER BY created_at DESC NULLS LAST, updated_at DESC NULLS LAST, id DESC LIMIT 1;
  IF v_latest IS DISTINCT FROM s.id THEN
    RETURN jsonb_build_object('applied', false, 'reason', 'superseded');
  END IF;

  UPDATE public.master_subscriptions
  SET status = 'active', plan_id = 'gratis', previous_plan_id = s.plan_id,
      downgraded_at = now(), downgrade_reason = 'nonpayment',
      monthly_price = 0, total_amount = 0, updated_at = now(),
      retry_count = 0, next_retry_at = NULL, grace_period_ends_at = NULL,
      last_decline_code = NULL, last_decline_message = NULL, decline_type = NULL,
      requires_card_update = false
  WHERE id = s.id;

  INSERT INTO public.master_subscription_logs(subscription_id, user_id, event_type, event_description, metadata)
  VALUES (s.id, s.user_id, 'subscription_downgraded',
    format('Downgrade automático para plano Grátis por inadimplência. Plano anterior: %s', s.plan_id),
    jsonb_build_object('previousPlanId', s.plan_id, 'previousStatus', s.status,
      'reason', 'nonpayment', 'gracePeriodEnd', s.grace_period_ends_at));

  v_count := public.apply_confirmed_plan_downgrade(s.user_id, 'free');

  RETURN jsonb_build_object('applied', true, 'storeId', s.user_id, 'previousPlan', s.plan_id,
    'productsDeactivated', v_count);
END;
$function$;

REVOKE ALL ON FUNCTION public.apply_nonpayment_downgrade(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_nonpayment_downgrade(uuid) TO service_role;

-- These change product availability without caller checks: server-side only.
REVOKE ALL ON FUNCTION public.apply_confirmed_plan_downgrade(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reactivate_products_after_upgrade(uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reapply_plan_limits_after_trial(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_confirmed_plan_downgrade(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.reactivate_products_after_upgrade(uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.reapply_plan_limits_after_trial(uuid, text) TO service_role;