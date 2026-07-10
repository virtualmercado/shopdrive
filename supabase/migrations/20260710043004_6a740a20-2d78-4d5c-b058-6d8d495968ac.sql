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
  ORDER BY created_at DESC NULLS LAST,
           updated_at DESC NULLS LAST,
           id DESC
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