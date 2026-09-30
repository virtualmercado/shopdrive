CREATE OR REPLACE FUNCTION public.validate_brand_owned_store()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_owner uuid; p record;
BEGIN
  SELECT owner_profile_id INTO v_owner FROM public.brand_accounts WHERE id = NEW.brand_account_id;
  SELECT id, is_template_profile, source_template_id, account_status INTO p
    FROM public.profiles WHERE id = NEW.store_profile_id;
  IF p.id IS NULL THEN RAISE EXCEPTION 'Loja não encontrada.' USING ERRCODE='P0001'; END IF;
  IF COALESCE(p.is_template_profile,false) THEN RAISE EXCEPTION 'Perfis de template não podem ser lojas próprias.' USING ERRCODE='P0001'; END IF;
  IF p.account_status IN ('excluida','exclusao_solicitada') THEN RAISE EXCEPTION 'Conta excluída ou em exclusão não pode ser loja própria.' USING ERRCODE='P0001'; END IF;
  -- Mesma regra de _marca_assert_owner_eligible: exige 'user'; 'admin' adicional não bloqueia; papéis operacionais bloqueiam.
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
    IF EXISTS (SELECT 1 FROM public.master_subscriptions
               WHERE user_id = NEW.store_profile_id AND status IN ('active','past_due','pending')
                 AND lower(coalesce(plan_id,'')) NOT IN ('gratis','free')) THEN
      RAISE EXCEPTION 'Esta loja possui uma assinatura própria ativa ou pendente. Regularize a assinatura antes de vinculá-la como loja adicional do Plano MARCA.' USING ERRCODE='P0001'; END IF;
  END IF;
  RETURN NEW;
END $function$;