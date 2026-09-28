-- ===== Versions =====
CREATE TABLE public.plan_contract_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id text NOT NULL REFERENCES public.master_plans(plan_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  version_label text NOT NULL CHECK (length(btrim(version_label)) > 0),
  title text NOT NULL CHECK (length(btrim(title)) > 0),
  content_markdown text NOT NULL DEFAULT '',
  acceptance_statement text NOT NULL DEFAULT '',
  requires_reacceptance boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
  content_hash_sha256 text NULL,
  created_by uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  published_by uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz NULL,
  CONSTRAINT plan_contract_versions_plan_label_key UNIQUE (plan_id, version_label),
  CONSTRAINT plan_contract_versions_published_consistency CHECK (
    (status = 'draft' AND published_at IS NULL AND content_hash_sha256 IS NULL)
    OR (status = 'published' AND published_at IS NOT NULL AND content_hash_sha256 IS NOT NULL)
  )
);
GRANT SELECT ON public.plan_contract_versions TO authenticated;
GRANT ALL ON public.plan_contract_versions TO service_role;
ALTER TABLE public.plan_contract_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view contract versions" ON public.plan_contract_versions
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX idx_plan_contract_versions_plan_id ON public.plan_contract_versions(plan_id);

CREATE OR REPLACE FUNCTION public.guard_plan_contract_version()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, extensions AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.status := 'draft';
    NEW.content_hash_sha256 := NULL;
    NEW.published_at := NULL;
    NEW.published_by := NULL;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.status = 'published' THEN
      RAISE EXCEPTION 'Versão publicada do contrato não pode ser excluída.' USING ERRCODE = 'P0001';
    END IF;
    RETURN OLD;
  END IF;
  -- UPDATE
  IF OLD.status = 'published' THEN
    RAISE EXCEPTION 'Versão publicada do contrato é imutável.' USING ERRCODE = 'P0001';
  END IF;
  IF NEW.plan_id IS DISTINCT FROM OLD.plan_id OR NEW.version_label IS DISTINCT FROM OLD.version_label THEN
    RAISE EXCEPTION 'Plano e rótulo da versão não podem ser alterados.' USING ERRCODE = 'P0001';
  END IF;
  IF NEW.status = 'published' THEN
    IF length(btrim(NEW.content_markdown)) = 0 OR length(btrim(NEW.acceptance_statement)) = 0 THEN
      RAISE EXCEPTION 'Conteúdo e frase de aceite são obrigatórios para publicar.' USING ERRCODE = 'P0001';
    END IF;
    -- hash always computed server-side from the stored UTF-8 bytes
    NEW.content_hash_sha256 := encode(extensions.digest(convert_to(NEW.content_markdown, 'UTF8'), 'sha256'), 'hex');
    NEW.published_at := now();
  ELSE
    NEW.content_hash_sha256 := NULL;
    NEW.published_at := NULL;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER trg_guard_plan_contract_version
  BEFORE INSERT OR UPDATE OR DELETE ON public.plan_contract_versions
  FOR EACH ROW EXECUTE FUNCTION public.guard_plan_contract_version();

-- ===== Current version pointer =====
CREATE TABLE public.plan_contract_settings (
  plan_id text PRIMARY KEY REFERENCES public.master_plans(plan_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  current_version_id uuid NULL REFERENCES public.plan_contract_versions(id) ON DELETE RESTRICT,
  updated_by uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.plan_contract_settings TO authenticated;
GRANT ALL ON public.plan_contract_settings TO service_role;
ALTER TABLE public.plan_contract_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view contract settings" ON public.plan_contract_settings
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.guard_plan_contract_settings()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_plan text; v_status text;
BEGIN
  IF NEW.current_version_id IS NOT NULL THEN
    SELECT plan_id, status INTO v_plan, v_status FROM public.plan_contract_versions WHERE id = NEW.current_version_id;
    IF v_plan IS DISTINCT FROM NEW.plan_id THEN
      RAISE EXCEPTION 'A versão não pertence a este plano.' USING ERRCODE = 'P0001';
    END IF;
    IF v_status <> 'published' THEN
      RAISE EXCEPTION 'Somente versões publicadas podem ser a versão vigente.' USING ERRCODE = 'P0001';
    END IF;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER trg_guard_plan_contract_settings
  BEFORE INSERT OR UPDATE ON public.plan_contract_settings
  FOR EACH ROW EXECUTE FUNCTION public.guard_plan_contract_settings();

-- ===== Acceptances (immutable) =====
CREATE TABLE public.plan_contract_acceptances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_version_id uuid NOT NULL REFERENCES public.plan_contract_versions(id) ON DELETE RESTRICT,
  brand_account_id uuid NOT NULL REFERENCES public.brand_accounts(id) ON DELETE RESTRICT,
  accepted_by_profile_id uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  accepted_by_profile_id_snapshot uuid NOT NULL,
  plan_id_snapshot text NOT NULL,
  billing_cycle text NOT NULL CHECK (billing_cycle IN ('monthly','annual')),
  monthly_price_snapshot numeric NOT NULL,
  annual_discount_percent_snapshot integer NOT NULL,
  contract_hash_snapshot text NOT NULL,
  version_label_snapshot text NOT NULL,
  brand_display_name_snapshot text NOT NULL,
  acceptance_statement_snapshot text NOT NULL,
  commercial_terms_hash text NOT NULL,
  ip_address text NULL,
  user_agent text NULL,
  request_id text NULL,
  evidence_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  accepted_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT plan_contract_acceptances_idempotency_key UNIQUE (brand_account_id, contract_version_id, commercial_terms_hash)
);
GRANT SELECT ON public.plan_contract_acceptances TO authenticated;
GRANT SELECT, INSERT ON public.plan_contract_acceptances TO service_role;
ALTER TABLE public.plan_contract_acceptances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view contract acceptances" ON public.plan_contract_acceptances
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX idx_plan_contract_acceptances_version ON public.plan_contract_acceptances(contract_version_id);
CREATE INDEX idx_plan_contract_acceptances_profile ON public.plan_contract_acceptances(accepted_by_profile_id);

CREATE OR REPLACE FUNCTION public.guard_plan_contract_acceptance()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  -- allow only the FK SET NULL of accepted_by_profile_id when a profile is deleted
  IF TG_OP = 'UPDATE'
     AND OLD.accepted_by_profile_id IS NOT NULL AND NEW.accepted_by_profile_id IS NULL
     AND (to_jsonb(NEW) - 'accepted_by_profile_id') = (to_jsonb(OLD) - 'accepted_by_profile_id') THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'Aceite de contrato é imutável e não pode ser alterado ou excluído.' USING ERRCODE = 'P0001';
END $$;
CREATE TRIGGER trg_guard_plan_contract_acceptance
  BEFORE UPDATE OR DELETE ON public.plan_contract_acceptances
  FOR EACH ROW EXECUTE FUNCTION public.guard_plan_contract_acceptance();

-- ===== Readiness =====
CREATE OR REPLACE FUNCTION public.is_plan_contract_ready(p_plan_id text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((
    SELECT true FROM public.plan_contract_settings s
    JOIN public.plan_contract_versions v ON v.id = s.current_version_id
    WHERE s.plan_id = p_plan_id AND v.status = 'published' AND v.plan_id = p_plan_id
  ), false)
$$;
REVOKE ALL ON FUNCTION public.is_plan_contract_ready(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_plan_contract_ready(text) TO authenticated, service_role;

-- ===== Admin RPCs =====
CREATE OR REPLACE FUNCTION public.admin_create_contract_draft(
  p_plan_id text, p_version_label text, p_title text, p_content_markdown text,
  p_acceptance_statement text, p_requires_reacceptance boolean DEFAULT true)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  PERFORM public.assert_caller_is_admin();
  INSERT INTO public.plan_contract_versions(plan_id, version_label, title, content_markdown, acceptance_statement, requires_reacceptance, created_by)
  VALUES (p_plan_id, btrim(p_version_label), p_title, COALESCE(p_content_markdown,''), COALESCE(p_acceptance_statement,''), COALESCE(p_requires_reacceptance,true), auth.uid())
  RETURNING id INTO v_id;
  PERFORM public.log_audit_event('PLAN_CONTRACT_DRAFT_CREATED','plan_contract_version', v_id,
    jsonb_build_object('plan_id', p_plan_id, 'version_label', btrim(p_version_label)), NULL);
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.admin_update_contract_draft(
  p_version_id uuid, p_title text, p_content_markdown text,
  p_acceptance_statement text, p_requires_reacceptance boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.assert_caller_is_admin();
  UPDATE public.plan_contract_versions
     SET title = p_title, content_markdown = COALESCE(p_content_markdown,''),
         acceptance_statement = COALESCE(p_acceptance_statement,''),
         requires_reacceptance = COALESCE(p_requires_reacceptance, requires_reacceptance)
   WHERE id = p_version_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Versão não encontrada.' USING ERRCODE = 'P0001'; END IF;
  PERFORM public.log_audit_event('PLAN_CONTRACT_DRAFT_UPDATED','plan_contract_version', p_version_id, '{}'::jsonb, NULL);
END $$;

CREATE OR REPLACE FUNCTION public.admin_delete_contract_draft(p_version_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.assert_caller_is_admin();
  DELETE FROM public.plan_contract_versions WHERE id = p_version_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Versão não encontrada.' USING ERRCODE = 'P0001'; END IF;
  PERFORM public.log_audit_event('PLAN_CONTRACT_DRAFT_DELETED','plan_contract_version', p_version_id, '{}'::jsonb, NULL);
END $$;

CREATE OR REPLACE FUNCTION public.admin_set_current_contract_version(p_version_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_plan text; v_prev uuid;
BEGIN
  PERFORM public.assert_caller_is_admin();
  SELECT plan_id INTO v_plan FROM public.plan_contract_versions WHERE id = p_version_id;
  IF v_plan IS NULL THEN RAISE EXCEPTION 'Versão não encontrada.' USING ERRCODE = 'P0001'; END IF;
  SELECT current_version_id INTO v_prev FROM public.plan_contract_settings WHERE plan_id = v_plan FOR UPDATE;
  INSERT INTO public.plan_contract_settings(plan_id, current_version_id, updated_by)
  VALUES (v_plan, p_version_id, auth.uid())
  ON CONFLICT (plan_id) DO UPDATE SET current_version_id = EXCLUDED.current_version_id, updated_by = EXCLUDED.updated_by;
  PERFORM public.log_audit_event('PLAN_CONTRACT_CURRENT_VERSION_CHANGED','plan_contract_version', p_version_id,
    jsonb_build_object('plan_id', v_plan, 'previous_version_id', v_prev), NULL);
END $$;

CREATE OR REPLACE FUNCTION public.admin_publish_contract_version(p_version_id uuid, p_set_current boolean DEFAULT true)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_hash text; v_plan text;
BEGIN
  PERFORM public.assert_caller_is_admin();
  UPDATE public.plan_contract_versions SET status = 'published', published_by = auth.uid()
   WHERE id = p_version_id AND status = 'draft'
   RETURNING content_hash_sha256, plan_id INTO v_hash, v_plan;
  IF v_hash IS NULL THEN RAISE EXCEPTION 'Versão não encontrada ou já publicada.' USING ERRCODE = 'P0001'; END IF;
  PERFORM public.log_audit_event('PLAN_CONTRACT_PUBLISHED','plan_contract_version', p_version_id,
    jsonb_build_object('plan_id', v_plan, 'content_hash_sha256', v_hash), NULL);
  IF COALESCE(p_set_current, true) THEN
    PERFORM public.admin_set_current_contract_version(p_version_id);
  END IF;
  RETURN v_hash;
END $$;

REVOKE ALL ON FUNCTION public.admin_create_contract_draft(text,text,text,text,text,boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_update_contract_draft(uuid,text,text,text,boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_delete_contract_draft(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_set_current_contract_version(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_publish_contract_version(uuid,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_create_contract_draft(text,text,text,text,text,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_contract_draft(uuid,text,text,text,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_contract_draft(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_current_contract_version(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_publish_contract_version(uuid,boolean) TO authenticated;

-- ===== Acceptance (service-only; called by edge function with verified user id) =====
CREATE OR REPLACE FUNCTION public.record_plan_contract_acceptance(
  p_user_id uuid, p_brand_account_id uuid, p_plan_id text, p_billing_cycle text,
  p_ip_address text DEFAULT NULL, p_user_agent text DEFAULT NULL, p_request_id text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  v_brand record; v_ver record; v_plan record; v_terms text; v_terms_hash text;
  v_id uuid; v_created boolean := false; v_now timestamptz := now();
BEGIN
  IF p_user_id IS NULL THEN RAISE EXCEPTION 'Usuário não autenticado.' USING ERRCODE = 'P0001'; END IF;
  IF p_billing_cycle NOT IN ('monthly','annual') THEN
    RAISE EXCEPTION 'Ciclo de cobrança inválido.' USING ERRCODE = 'P0001';
  END IF;
  IF p_plan_id <> 'marca' THEN
    RAISE EXCEPTION 'Plano sem contrato eletrônico.' USING ERRCODE = 'P0001';
  END IF;
  IF NOT public.is_plan_marca_enabled() THEN
    RAISE EXCEPTION 'Este plano ainda não está disponível para contratação.' USING ERRCODE = 'P0001';
  END IF;
  SELECT plan_id, monthly_price, annual_discount_percent, is_active INTO v_plan
    FROM public.master_plans WHERE plan_id = p_plan_id;
  IF v_plan.plan_id IS NULL OR NOT v_plan.is_active THEN
    RAISE EXCEPTION 'Este plano ainda não está disponível para contratação.' USING ERRCODE = 'P0001';
  END IF;
  SELECT v.* INTO v_ver FROM public.plan_contract_settings s
    JOIN public.plan_contract_versions v ON v.id = s.current_version_id
   WHERE s.plan_id = p_plan_id AND v.status = 'published';
  IF v_ver.id IS NULL THEN
    RAISE EXCEPTION 'O contrato deste plano ainda não está disponível.' USING ERRCODE = 'P0001';
  END IF;
  SELECT id, display_name, owner_profile_id INTO v_brand FROM public.brand_accounts WHERE id = p_brand_account_id;
  IF v_brand.id IS NULL THEN RAISE EXCEPTION 'Empresa não encontrada.' USING ERRCODE = 'P0001'; END IF;
  IF v_brand.owner_profile_id IS NULL THEN
    RAISE EXCEPTION 'Esta empresa não possui responsável definido para aceitar o contrato.' USING ERRCODE = 'P0001';
  END IF;
  IF v_brand.owner_profile_id <> p_user_id THEN
    RAISE EXCEPTION 'Somente o responsável da empresa pode aceitar o contrato.' USING ERRCODE = '42501';
  END IF;

  v_terms := jsonb_build_object(
    'plan_id', v_plan.plan_id, 'billing_cycle', p_billing_cycle,
    'monthly_price', v_plan.monthly_price::text, 'annual_discount_percent', v_plan.annual_discount_percent,
    'contract_version_id', v_ver.id, 'contract_hash', v_ver.content_hash_sha256,
    'acceptance_statement', v_ver.acceptance_statement)::text;
  v_terms_hash := encode(extensions.digest(convert_to(v_terms, 'UTF8'), 'sha256'), 'hex');

  INSERT INTO public.plan_contract_acceptances(
    contract_version_id, brand_account_id, accepted_by_profile_id, accepted_by_profile_id_snapshot,
    plan_id_snapshot, billing_cycle, monthly_price_snapshot, annual_discount_percent_snapshot,
    contract_hash_snapshot, version_label_snapshot, brand_display_name_snapshot, acceptance_statement_snapshot,
    commercial_terms_hash, ip_address, user_agent, request_id, evidence_snapshot, accepted_at)
  VALUES (v_ver.id, v_brand.id, p_user_id, p_user_id, v_plan.plan_id, p_billing_cycle,
    v_plan.monthly_price, v_plan.annual_discount_percent, v_ver.content_hash_sha256, v_ver.version_label,
    v_brand.display_name, v_ver.acceptance_statement, v_terms_hash,
    left(p_ip_address, 100), left(p_user_agent, 500), left(p_request_id, 200),
    jsonb_build_object('terms', v_terms::jsonb, 'brand_account_id', v_brand.id,
      'brand_display_name', v_brand.display_name, 'accepted_by', p_user_id,
      'version_label', v_ver.version_label, 'accepted_at', v_now,
      'ip_address', left(p_ip_address,100), 'user_agent', left(p_user_agent,500)),
    v_now)
  ON CONFLICT ON CONSTRAINT plan_contract_acceptances_idempotency_key DO NOTHING
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    SELECT id INTO v_id FROM public.plan_contract_acceptances
     WHERE brand_account_id = v_brand.id AND contract_version_id = v_ver.id AND commercial_terms_hash = v_terms_hash;
  ELSE
    v_created := true;
    INSERT INTO public.audit_logs(user_id, action, entity_type, entity_id, metadata)
    VALUES (p_user_id, 'PLAN_CONTRACT_ACCEPTED', 'plan_contract_acceptance', v_id,
      jsonb_build_object('brand_account_id', v_brand.id, 'contract_version_id', v_ver.id, 'billing_cycle', p_billing_cycle));
  END IF;

  RETURN jsonb_build_object('acceptance_id', v_id, 'created', v_created,
    'contract_version_id', v_ver.id, 'commercial_terms_hash', v_terms_hash);
END $$;
REVOKE ALL ON FUNCTION public.record_plan_contract_acceptance(uuid,uuid,text,text,text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_plan_contract_acceptance(uuid,uuid,text,text,text,text,text) TO service_role;