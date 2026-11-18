CREATE OR REPLACE FUNCTION public.apply_lapsed_secondary_plan_limit(p_store_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_eff jsonb;
  v_plan text;
  v_count integer;
BEGIN
  -- Linked MARCA secondary stores: enforce the active-product limit once the store resolves to a
  -- limited plan (own paid period ended AND the primary's MARCA is no longer in force).
  IF coalesce(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'service_role_required' USING ERRCODE = '42501';
  END IF;
  IF p_store_id IS NULL THEN RETURN jsonb_build_object('applied', false, 'reason', 'no_store'); END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('plan-limit-store:' || p_store_id::text, 0));

  IF NOT EXISTS (SELECT 1 FROM public.brand_account_owned_stores
                 WHERE store_profile_id = p_store_id AND store_role = 'secondary') THEN
    RETURN jsonb_build_object('applied', false, 'reason', 'not_linked_secondary');
  END IF;

  -- Re-resolved after the lock: a payment committed meanwhile wins.
  v_eff := public.get_effective_store_plan(p_store_id);
  v_plan := lower(coalesce(v_eff->>'plan', ''));
  IF COALESCE((v_eff->>'resolved')::boolean, false) IS NOT TRUE
     OR COALESCE((v_eff->>'unlimited')::boolean, false)
     OR v_plan NOT IN ('free', 'gratis', 'pro') THEN
    RETURN jsonb_build_object('applied', false, 'reason', 'entitled', 'plan', v_plan);
  END IF;

  v_count := public.apply_confirmed_plan_downgrade(p_store_id, v_plan);
  RETURN jsonb_build_object('applied', v_count > 0, 'reason', CASE WHEN v_count > 0 THEN 'limited' ELSE 'within_limit' END,
    'storeId', p_store_id, 'plan', v_plan, 'productsDeactivated', v_count);
END;
$function$;

REVOKE ALL ON FUNCTION public.apply_lapsed_secondary_plan_limit(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_lapsed_secondary_plan_limit(uuid) TO service_role;