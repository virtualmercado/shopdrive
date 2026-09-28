CREATE OR REPLACE FUNCTION public._marca_assert_owner_eligible(p_uid uuid)
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE p record;
BEGIN
  SELECT id, is_template_profile, account_status, deleted_at INTO p FROM profiles WHERE id = p_uid;
  IF p.id IS NULL THEN RAISE EXCEPTION 'Perfil inválido.' USING ERRCODE='42501'; END IF;
  IF COALESCE(p.is_template_profile,false) THEN RAISE EXCEPTION 'Esta conta não pode contratar o Plano MARCA.' USING ERRCODE='42501'; END IF;
  IF p.deleted_at IS NOT NULL OR p.account_status IN ('excluida','exclusao_solicitada') THEN
    RAISE EXCEPTION 'Conta excluída ou em exclusão.' USING ERRCODE='42501'; END IF;
  IF EXISTS (SELECT 1 FROM account_deletion_requests WHERE merchant_id = p_uid AND status IN ('pending','in_review','approved')) THEN
    RAISE EXCEPTION 'Conta excluída ou em exclusão.' USING ERRCODE='42501'; END IF;
  IF EXISTS (SELECT 1 FROM user_roles WHERE user_id = p_uid AND role <> 'user') THEN
    RAISE EXCEPTION 'Contas internas não podem contratar pelo painel do lojista.' USING ERRCODE='42501'; END IF;
  IF EXISTS (SELECT 1 FROM brand_account_owned_stores WHERE store_profile_id = p_uid AND store_role = 'secondary') THEN
    RAISE EXCEPTION 'A loja adicional não pode gerenciar a contratação.' USING ERRCODE='42501'; END IF;
END $$;
REVOKE ALL ON FUNCTION public._marca_assert_owner_eligible(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.prepare_my_marca_brand_account(p_display_name text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_uid uuid := auth.uid(); v_n int; v_acc record; v_name text; v_id uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Não autenticado.' USING ERRCODE='42501'; END IF;
  IF NOT is_plan_marca_enabled() THEN RAISE EXCEPTION 'Recurso indisponível.' USING ERRCODE='42501'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('marca_prepare:' || v_uid::text));
  PERFORM _marca_assert_owner_eligible(v_uid);

  SELECT count(*) INTO v_n FROM brand_accounts WHERE owner_profile_id = v_uid;
  IF v_n > 1 THEN
    RETURN jsonb_build_object('status','selection_required',
      'message','Sua conta possui mais de uma empresa. Fale com o suporte para continuar.');
  END IF;

  IF v_n = 1 THEN
    SELECT id, display_name INTO v_acc FROM brand_accounts WHERE owner_profile_id = v_uid;
    IF NOT EXISTS (SELECT 1 FROM brand_account_owned_stores WHERE brand_account_id = v_acc.id
                   AND store_profile_id = v_uid AND slot = 1 AND store_role = 'primary') THEN
      IF EXISTS (SELECT 1 FROM brand_account_owned_stores WHERE brand_account_id = v_acc.id AND slot = 1) THEN
        RETURN jsonb_build_object('status','admin_required','message','Sua empresa precisa de revisão do suporte.');
      END IF;
      INSERT INTO brand_account_owned_stores(brand_account_id, store_profile_id, slot, store_role, link_origin, created_by)
      VALUES (v_acc.id, v_uid, 1, 'primary', 'owner_auto', v_uid);
    END IF;
    RETURN jsonb_build_object('status','reused','brand_account_id',v_acc.id,'display_name',v_acc.display_name);
  END IF;

  IF EXISTS (SELECT 1 FROM brand_account_owned_stores WHERE store_profile_id = v_uid) THEN
    RETURN jsonb_build_object('status','admin_required','message','Sua loja já está vinculada a outra empresa. Fale com o suporte.');
  END IF;

  v_name := btrim(COALESCE(NULLIF(btrim(p_display_name),''), (SELECT store_name FROM profiles WHERE id = v_uid), ''));
  v_name := regexp_replace(v_name, '\s+', ' ', 'g');
  IF length(v_name) < 2 THEN RAISE EXCEPTION 'Informe o nome da empresa.' USING ERRCODE='22023'; END IF;
  IF length(v_name) > 80 THEN RAISE EXCEPTION 'O nome da empresa deve ter no máximo 80 caracteres.' USING ERRCODE='22023'; END IF;
  IF v_name ~ '[<>]' OR v_name ~ '[[:cntrl:]]' OR v_name ~* '(javascript:|on[a-z]+=)' THEN
    RAISE EXCEPTION 'O nome da empresa contém caracteres não permitidos.' USING ERRCODE='22023'; END IF;

  INSERT INTO brand_accounts(display_name, owner_profile_id) VALUES (v_name, v_uid) RETURNING id INTO v_id;
  INSERT INTO brand_account_owned_stores(brand_account_id, store_profile_id, slot, store_role, link_origin, created_by)
  VALUES (v_id, v_uid, 1, 'primary', 'owner_auto', v_uid)
  ON CONFLICT (brand_account_id, slot) DO NOTHING;
  INSERT INTO audit_logs(user_id, action, entity_type, entity_id, metadata)
  VALUES (v_uid, 'BRAND_ACCOUNT_PREPARED_BY_OWNER', 'brand_account', v_id, jsonb_build_object('origin','marca_upgrade'));
  RETURN jsonb_build_object('status','created','brand_account_id',v_id,'display_name',v_name);
END $$;
REVOKE ALL ON FUNCTION public.prepare_my_marca_brand_account(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.prepare_my_marca_brand_account(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_current_marca_contract(p_brand_account_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_uid uuid := auth.uid(); v_acc uuid; v_n int; v_plan record; v_ver record;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Não autenticado.' USING ERRCODE='42501'; END IF;
  IF NOT is_plan_marca_enabled() THEN RAISE EXCEPTION 'Recurso indisponível.' USING ERRCODE='42501'; END IF;
  SELECT plan_id, display_name, monthly_price, annual_discount_percent, is_active INTO v_plan
    FROM master_plans WHERE plan_id = 'marca';
  IF v_plan.plan_id IS NULL OR NOT v_plan.is_active THEN
    RETURN jsonb_build_object('status','unavailable','message','O Plano MARCA ainda não está disponível para contratação.');
  END IF;
  PERFORM _marca_assert_owner_eligible(v_uid);
  IF p_brand_account_id IS NOT NULL THEN
    SELECT id INTO v_acc FROM brand_accounts WHERE id = p_brand_account_id AND owner_profile_id = v_uid;
  ELSE
    SELECT count(*) INTO v_n FROM brand_accounts WHERE owner_profile_id = v_uid;
    IF v_n > 1 THEN RETURN jsonb_build_object('status','selection_required','message','Selecione a empresa.'); END IF;
    SELECT id INTO v_acc FROM brand_accounts WHERE owner_profile_id = v_uid;
  END IF;
  IF v_acc IS NULL OR NOT EXISTS (SELECT 1 FROM brand_account_owned_stores WHERE brand_account_id = v_acc
       AND store_profile_id = v_uid AND slot = 1 AND store_role = 'primary') THEN
    RAISE EXCEPTION 'Acesso negado.' USING ERRCODE='42501';
  END IF;
  SELECT v.version_label, v.title, v.content_markdown, v.acceptance_statement, v.content_hash_sha256, v.published_at
    INTO v_ver
    FROM plan_contract_settings s JOIN plan_contract_versions v ON v.id = s.current_version_id
   WHERE s.plan_id = 'marca' AND v.plan_id = 'marca' AND v.status = 'published';
  IF v_ver.version_label IS NULL THEN
    RETURN jsonb_build_object('status','unavailable','message','O contrato do Plano MARCA ainda não está disponível.');
  END IF;
  RETURN jsonb_build_object('status','ok',
    'version', v_ver.version_label, 'title', v_ver.title, 'content', v_ver.content_markdown,
    'acceptance_statement', v_ver.acceptance_statement, 'contract_hash', v_ver.content_hash_sha256,
    'published_at', v_ver.published_at,
    'commercial', jsonb_build_object('plan_name', v_plan.display_name,
      'monthly_price', v_plan.monthly_price, 'annual_discount_percent', v_plan.annual_discount_percent));
END $$;
REVOKE ALL ON FUNCTION public.get_current_marca_contract(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_current_marca_contract(uuid) TO authenticated;