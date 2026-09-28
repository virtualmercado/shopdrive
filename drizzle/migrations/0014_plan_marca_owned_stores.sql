-- PROMPT 07: até 2 lojas próprias por brand_account, herança MARCA para a secondary.
CREATE TABLE IF NOT EXISTS public.brand_account_owned_stores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_account_id uuid NOT NULL REFERENCES public.brand_accounts(id) ON DELETE CASCADE,
  store_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  slot smallint NOT NULL CHECK (slot IN (1,2)),
  store_role text NOT NULL CHECK (store_role IN ('primary','secondary')),
  link_origin text CHECK (link_origin IS NULL OR link_origin IN ('owner_auto','admin_link','admin_clone')),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT baos_slot_role_chk CHECK ((slot = 1 AND store_role = 'primary') OR (slot = 2 AND store_role = 'secondary')),
  CONSTRAINT baos_account_slot_uq UNIQUE (brand_account_id, slot),
  CONSTRAINT baos_store_uq UNIQUE (store_profile_id)
);
COMMENT ON TABLE public.brand_account_owned_stores IS 'Lojas próprias (máx. 2) de um brand_account MARCA. Nunca derivar de profiles.source_template_id.';

GRANT SELECT ON public.brand_account_owned_stores TO authenticated;
GRANT ALL ON public.brand_account_owned_stores TO service_role;
ALTER TABLE public.brand_account_owned_stores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can read owned stores" ON public.brand_account_owned_stores
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Validação estrutural de cada vínculo (vale para RPCs e service_role).
CREATE OR REPLACE FUNCTION public.validate_brand_owned_store()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_owner uuid; p record;
BEGIN
  SELECT owner_profile_id INTO v_owner FROM public.brand_accounts WHERE id = NEW.brand_account_id;
  SELECT id, is_template_profile, source_template_id, account_status INTO p
    FROM public.profiles WHERE id = NEW.store_profile_id;
  IF p.id IS NULL THEN RAISE EXCEPTION 'Loja não encontrada.' USING ERRCODE='P0001'; END IF;
  IF COALESCE(p.is_template_profile,false) THEN RAISE EXCEPTION 'Perfis de template não podem ser lojas próprias.' USING ERRCODE='P0001'; END IF;
  IF p.account_status IN ('excluida','exclusao_solicitada') THEN RAISE EXCEPTION 'Conta excluída ou em exclusão não pode ser loja própria.' USING ERRCODE='P0001'; END IF;
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = NEW.store_profile_id AND role <> 'user') THEN
    RAISE EXCEPTION 'Contas internas não podem ser lojas próprias.' USING ERRCODE='P0001'; END IF;
  IF NEW.store_role = 'primary' THEN
    IF v_owner IS NULL OR NEW.store_profile_id <> v_owner THEN
      RAISE EXCEPTION 'A loja principal deve ser a do responsável da empresa.' USING ERRCODE='P0001'; END IF;
  ELSE
    IF v_owner IS NOT NULL AND NEW.store_profile_id = v_owner THEN
      RAISE EXCEPTION 'A loja adicional deve ser diferente da principal.' USING ERRCODE='P0001'; END IF;
    IF p.source_template_id IS NOT NULL THEN
      RAISE EXCEPTION 'Lojas originadas de template (revendedores) não podem ser lojas próprias.' USING ERRCODE='P0001'; END IF;
    IF EXISTS (SELECT 1 FROM public.master_subscriptions
               WHERE user_id = NEW.store_profile_id AND status IN ('active','past_due','pending')
                 AND lower(coalesce(plan_id,'')) NOT IN ('gratis','free')) THEN
      RAISE EXCEPTION 'Esta loja possui uma assinatura própria ativa ou pendente. Regularize a assinatura antes de vinculá-la como loja adicional do Plano MARCA.' USING ERRCODE='P0001'; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_validate_brand_owned_store BEFORE INSERT OR UPDATE ON public.brand_account_owned_stores
  FOR EACH ROW EXECUTE FUNCTION public.validate_brand_owned_store();

-- Primary não sai enquanto for o owner (exclusão real do profile continua funcionando).
CREATE OR REPLACE FUNCTION public.guard_brand_owned_store_delete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF OLD.store_role = 'primary'
     AND EXISTS (SELECT 1 FROM public.profiles WHERE id = OLD.store_profile_id)
     AND EXISTS (SELECT 1 FROM public.brand_accounts WHERE id = OLD.brand_account_id AND owner_profile_id = OLD.store_profile_id)
     AND current_setting('app.brand_owner_sync', true) IS DISTINCT FROM 'on' THEN
    RAISE EXCEPTION 'A loja principal não pode ser desvinculada enquanto for do responsável da empresa.' USING ERRCODE='P0001';
  END IF;
  RETURN OLD;
END $$;
CREATE TRIGGER trg_guard_brand_owned_store_delete BEFORE DELETE ON public.brand_account_owned_stores
  FOR EACH ROW EXECUTE FUNCTION public.guard_brand_owned_store_delete();

-- Primary acompanha owner_profile_id.
CREATE OR REPLACE FUNCTION public.sync_brand_primary_store()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.owner_profile_id IS NOT DISTINCT FROM OLD.owner_profile_id THEN RETURN NEW; END IF;
  PERFORM set_config('app.brand_owner_sync', 'on', true);
  DELETE FROM public.brand_account_owned_stores WHERE brand_account_id = NEW.id AND slot = 1;
  PERFORM set_config('app.brand_owner_sync', 'off', true);
  IF NEW.owner_profile_id IS NOT NULL THEN
    INSERT INTO public.brand_account_owned_stores(brand_account_id, store_profile_id, slot, store_role, link_origin, created_by)
    VALUES (NEW.id, NEW.owner_profile_id, 1, 'primary', 'owner_auto', auth.uid());
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_sync_brand_primary_store AFTER UPDATE OF owner_profile_id ON public.brand_accounts
  FOR EACH ROW EXECUTE FUNCTION public.sync_brand_primary_store();

CREATE OR REPLACE FUNCTION public.admin_create_brand_account(p_display_name text, p_owner_profile_id uuid DEFAULT NULL::uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE v_id uuid;
BEGIN
  PERFORM public.assert_caller_is_admin();
  IF p_display_name IS NULL OR length(btrim(p_display_name)) = 0 THEN
    RAISE EXCEPTION 'Informe o nome da empresa.' USING ERRCODE = 'P0001';
  END IF;
  IF p_owner_profile_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_owner_profile_id) THEN
    RAISE EXCEPTION 'Perfil responsável não encontrado.' USING ERRCODE = 'P0001';
  END IF;
  INSERT INTO public.brand_accounts(display_name, owner_profile_id)
  VALUES (btrim(p_display_name), p_owner_profile_id) RETURNING id INTO v_id;
  IF p_owner_profile_id IS NOT NULL THEN
    INSERT INTO public.brand_account_owned_stores(brand_account_id, store_profile_id, slot, store_role, link_origin, created_by)
    VALUES (v_id, p_owner_profile_id, 1, 'primary', 'owner_auto', auth.uid())
    ON CONFLICT (brand_account_id, slot) DO NOTHING;
  END IF;
  PERFORM public.log_audit_event('BRAND_ACCOUNT_CREATED', 'brand_account', v_id,
    jsonb_build_object('owner_profile_id', p_owner_profile_id));
  RETURN v_id;
END;
$function$;

-- Herança: retorna 'marca' só para secondary cujo owner tem MARCA direta active/past_due.
CREATE OR REPLACE FUNCTION public.get_brand_inherited_plan(p_store_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
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
$$;
REVOKE ALL ON FUNCTION public.get_brand_inherited_plan(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_base_store_plan(p_store_id uuid)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE v_plan_id text; v_res text;
BEGIN
  IF p_store_id IS NULL THEN RETURN 'free'; END IF;
  SELECT plan_id INTO v_plan_id FROM public.master_subscriptions
  WHERE user_id = p_store_id AND status IN ('active', 'past_due')
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
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
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

CREATE OR REPLACE FUNCTION public.get_product_plan_usage(p_store_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE v_plan jsonb; v_total integer := 0; v_active integer := 0; v_limit integer; v_remaining integer;
BEGIN
  IF p_store_id IS NULL OR (auth.uid() IS NOT NULL AND auth.uid() <> p_store_id) THEN
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
$function$;

-- Contexto do plano (dono da loja ou admin).
CREATE OR REPLACE FUNCTION public.get_store_plan_context(p_store_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v jsonb;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_store_id AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Não autorizado' USING ERRCODE='42501';
  END IF;
  v := public.get_effective_store_plan(p_store_id);
  RETURN jsonb_build_object('plan_code', v->>'plan', 'plan_source', v->>'planSource',
    'brand_account_id', v->>'brandAccountId', 'owned_store_role', v->>'ownedStoreRole');
END $$;
REVOKE ALL ON FUNCTION public.get_store_plan_context(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_store_plan_context(uuid) TO authenticated, service_role;

-- Reaplica limites/restaurações nas secondaries quando a assinatura do owner muda.
CREATE OR REPLACE FUNCTION public.propagate_brand_plan_to_secondaries(p_owner_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE r record; v jsonb; n integer := 0;
BEGIN
  FOR r IN SELECT o.store_profile_id FROM public.brand_account_owned_stores o
           JOIN public.brand_accounts b ON b.id = o.brand_account_id
           WHERE b.owner_profile_id = p_owner_id AND o.store_role = 'secondary'
  LOOP
    v := public.get_effective_store_plan(r.store_profile_id);
    IF COALESCE((v->>'unlimited')::boolean, false) THEN
      BEGIN
        PERFORM public.reactivate_products_after_upgrade(r.store_profile_id, NULL);
      EXCEPTION WHEN others THEN
        INSERT INTO public.audit_logs(user_id, action, entity_type, entity_id, metadata)
        VALUES (auth.uid(), 'BRAND_SECONDARY_RESTORE_FAILED', 'profile', r.store_profile_id, jsonb_build_object('error', SQLERRM));
      END;
    ELSE
      PERFORM public.reapply_plan_limits_after_trial(r.store_profile_id, v->>'plan');
    END IF;
    n := n + 1;
  END LOOP;
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.propagate_brand_plan_to_secondaries(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.trg_propagate_brand_plan()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status AND NEW.plan_id IS NOT DISTINCT FROM OLD.plan_id THEN
    RETURN NEW;
  END IF;
  IF EXISTS (SELECT 1 FROM public.brand_accounts WHERE owner_profile_id = NEW.user_id) THEN
    PERFORM public.propagate_brand_plan_to_secondaries(NEW.user_id);
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_propagate_brand_plan AFTER INSERT OR UPDATE OF status, plan_id ON public.master_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.trg_propagate_brand_plan();

-- Secondary não contrata plano pago próprio (defesa no banco, além da edge function).
CREATE OR REPLACE FUNCTION public.guard_secondary_store_subscription()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF lower(coalesce(NEW.plan_id,'')) NOT IN ('gratis','free')
     AND NEW.status IN ('active','past_due','pending')
     AND EXISTS (SELECT 1 FROM public.brand_account_owned_stores WHERE store_profile_id = NEW.user_id AND store_role = 'secondary') THEN
    RAISE EXCEPTION 'Esta loja está vinculada a uma empresa do Plano MARCA e utiliza a assinatura principal da empresa.' USING ERRCODE='P0001';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_guard_secondary_store_subscription BEFORE INSERT ON public.master_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.guard_secondary_store_subscription();

-- RPCs administrativas.
CREATE OR REPLACE FUNCTION public.admin_link_brand_owned_store(p_brand_account_id uuid, p_store_profile_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_owner uuid; v_id uuid;
BEGIN
  PERFORM public.assert_caller_is_admin();
  SELECT owner_profile_id INTO v_owner FROM public.brand_accounts WHERE id = p_brand_account_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Empresa não encontrada.' USING ERRCODE='P0001'; END IF;
  IF v_owner IS NULL OR NOT EXISTS (SELECT 1 FROM public.brand_account_owned_stores WHERE brand_account_id = p_brand_account_id AND slot = 1) THEN
    RAISE EXCEPTION 'A empresa precisa de responsável e loja principal antes da loja adicional.' USING ERRCODE='P0001'; END IF;
  IF EXISTS (SELECT 1 FROM public.brand_account_owned_stores WHERE store_profile_id = p_store_profile_id) THEN
    RAISE EXCEPTION 'Esta loja já pertence a uma empresa.' USING ERRCODE='P0001'; END IF;
  IF EXISTS (SELECT 1 FROM public.brand_account_owned_stores WHERE brand_account_id = p_brand_account_id AND slot = 2) THEN
    RAISE EXCEPTION 'Limite de 2 lojas próprias atingido.' USING ERRCODE='P0001'; END IF;
  INSERT INTO public.brand_account_owned_stores(brand_account_id, store_profile_id, slot, store_role, link_origin, created_by)
  VALUES (p_brand_account_id, p_store_profile_id, 2, 'secondary', 'admin_link', auth.uid()) RETURNING id INTO v_id;
  PERFORM public.log_audit_event('BRAND_OWNED_STORE_LINKED', 'brand_account', p_brand_account_id,
    jsonb_build_object('store_profile_id', p_store_profile_id, 'slot', 2));
  PERFORM public.propagate_brand_plan_to_secondaries(v_owner);
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.admin_unlink_brand_owned_store(p_brand_account_id uuid, p_store_profile_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_role text; v jsonb;
BEGIN
  PERFORM public.assert_caller_is_admin();
  PERFORM 1 FROM public.brand_accounts WHERE id = p_brand_account_id FOR UPDATE;
  SELECT store_role INTO v_role FROM public.brand_account_owned_stores
   WHERE brand_account_id = p_brand_account_id AND store_profile_id = p_store_profile_id;
  IF v_role IS NULL THEN RAISE EXCEPTION 'Vínculo não encontrado.' USING ERRCODE='P0001'; END IF;
  IF v_role = 'primary' THEN RAISE EXCEPTION 'A loja principal não pode ser desvinculada enquanto for do responsável da empresa.' USING ERRCODE='P0001'; END IF;
  DELETE FROM public.brand_account_owned_stores WHERE brand_account_id = p_brand_account_id AND store_profile_id = p_store_profile_id;
  v := public.get_effective_store_plan(p_store_profile_id);
  IF NOT COALESCE((v->>'unlimited')::boolean, false) THEN
    PERFORM public.reapply_plan_limits_after_trial(p_store_profile_id, v->>'plan');
  END IF;
  PERFORM public.log_audit_event('BRAND_OWNED_STORE_UNLINKED', 'brand_account', p_brand_account_id,
    jsonb_build_object('store_profile_id', p_store_profile_id, 'new_plan', v->>'plan'));
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.get_brand_owned_stores(p_brand_account_id uuid)
RETURNS TABLE(slot smallint, store_role text, store_profile_id uuid, store_name text, store_slug text, link_origin text, created_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  PERFORM public.assert_caller_is_admin();
  RETURN QUERY SELECT o.slot, o.store_role, o.store_profile_id, p.store_name, p.store_slug, o.link_origin, o.created_at
    FROM public.brand_account_owned_stores o JOIN public.profiles p ON p.id = o.store_profile_id
    WHERE o.brand_account_id = p_brand_account_id ORDER BY o.slot;
END $$;

REVOKE ALL ON FUNCTION public.admin_link_brand_owned_store(uuid,uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_unlink_brand_owned_store(uuid,uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_brand_owned_stores(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_link_brand_owned_store(uuid,uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_unlink_brand_owned_store(uuid,uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_brand_owned_stores(uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.validate_brand_owned_store() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_brand_owned_store_delete() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_brand_primary_store() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_propagate_brand_plan() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_secondary_store_subscription() FROM PUBLIC, anon, authenticated;