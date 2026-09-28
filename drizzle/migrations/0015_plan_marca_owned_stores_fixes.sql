REVOKE ALL ON public.brand_account_owned_stores FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.brand_account_owned_stores FROM authenticated;
GRANT SELECT ON public.brand_account_owned_stores TO authenticated;

-- Restauração roda como sistema: a trava de ativação por auth.uid() não deve barrar
-- a reativação automática da secondary quando o gatilho vem de sessão admin.
CREATE OR REPLACE FUNCTION public.propagate_brand_plan_to_secondaries(p_owner_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
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
END $$;
REVOKE ALL ON FUNCTION public.propagate_brand_plan_to_secondaries(uuid) FROM PUBLIC, anon, authenticated;