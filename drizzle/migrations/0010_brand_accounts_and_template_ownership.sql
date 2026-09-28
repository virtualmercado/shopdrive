CREATE TABLE public.brand_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name text NOT NULL CHECK (length(btrim(display_name)) > 0),
  owner_profile_id uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.brand_accounts TO authenticated;
GRANT ALL ON public.brand_accounts TO service_role;
ALTER TABLE public.brand_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can read brand accounts" ON public.brand_accounts FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can insert brand accounts" ON public.brand_accounts FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update brand accounts" ON public.brand_accounts FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE INDEX idx_brand_accounts_owner_profile_id ON public.brand_accounts(owner_profile_id);
CREATE TRIGGER trg_brand_accounts_updated_at BEFORE UPDATE ON public.brand_accounts FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.brand_templates ADD COLUMN brand_account_id uuid NULL REFERENCES public.brand_accounts(id) ON DELETE RESTRICT;
CREATE INDEX idx_brand_templates_brand_account_id ON public.brand_templates(brand_account_id);

CREATE OR REPLACE FUNCTION public.brand_template_has_history(p_template_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE source_template_id = p_template_id)
      OR EXISTS (SELECT 1 FROM public.template_click_events WHERE template_id = p_template_id);
$$;
REVOKE ALL ON FUNCTION public.brand_template_has_history(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.enforce_brand_template_ownership()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count int;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.brand_account_id IS NOT DISTINCT FROM OLD.brand_account_id THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.brand_account_id IS NOT NULL
     AND public.brand_template_has_history(OLD.id) THEN
    RAISE EXCEPTION 'Este template já possui histórico comercial e não pode ser transferido ou desvinculado da empresa.' USING ERRCODE = 'P0001';
  END IF;
  IF NEW.brand_account_id IS NOT NULL THEN
    PERFORM 1 FROM public.brand_accounts WHERE id = NEW.brand_account_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Empresa não encontrada.' USING ERRCODE = 'P0001';
    END IF;
    SELECT count(*) INTO v_count FROM public.brand_templates
      WHERE brand_account_id = NEW.brand_account_id AND id <> NEW.id;
    IF v_count >= 2 THEN
      RAISE EXCEPTION 'Esta empresa já possui o limite máximo de 2 Templates por Marca.' USING ERRCODE = 'P0001';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_enforce_brand_template_ownership
BEFORE INSERT OR UPDATE OF brand_account_id ON public.brand_templates
FOR EACH ROW EXECUTE FUNCTION public.enforce_brand_template_ownership();

CREATE OR REPLACE FUNCTION public.admin_create_brand_account(p_display_name text, p_owner_profile_id uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
  PERFORM public.log_audit_event('BRAND_ACCOUNT_CREATED', 'brand_account', v_id,
    jsonb_build_object('owner_profile_id', p_owner_profile_id));
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_assign_brand_template(p_brand_account_id uuid, p_template_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_current uuid;
BEGIN
  PERFORM public.assert_caller_is_admin();
  PERFORM 1 FROM public.brand_accounts WHERE id = p_brand_account_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Empresa não encontrada.' USING ERRCODE = 'P0001'; END IF;
  SELECT brand_account_id INTO v_current FROM public.brand_templates WHERE id = p_template_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Template não encontrado.' USING ERRCODE = 'P0001'; END IF;
  IF v_current = p_brand_account_id THEN RETURN; END IF;
  UPDATE public.brand_templates SET brand_account_id = p_brand_account_id WHERE id = p_template_id;
  PERFORM public.log_audit_event('BRAND_TEMPLATE_ASSIGNED', 'brand_template', p_template_id,
    jsonb_build_object('brand_account_id', p_brand_account_id, 'previous_brand_account_id', v_current));
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_unassign_brand_template(p_template_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_current uuid;
BEGIN
  PERFORM public.assert_caller_is_admin();
  SELECT brand_account_id INTO v_current FROM public.brand_templates WHERE id = p_template_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Template não encontrado.' USING ERRCODE = 'P0001'; END IF;
  IF v_current IS NULL THEN RETURN; END IF;
  UPDATE public.brand_templates SET brand_account_id = NULL WHERE id = p_template_id;
  PERFORM public.log_audit_event('BRAND_TEMPLATE_UNASSIGNED', 'brand_template', p_template_id,
    jsonb_build_object('previous_brand_account_id', v_current));
END;
$$;

REVOKE ALL ON FUNCTION public.admin_create_brand_account(text, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_assign_brand_template(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_unassign_brand_template(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_create_brand_account(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_assign_brand_template(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_unassign_brand_template(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.enforce_brand_template_ownership() FROM PUBLIC, anon, authenticated;

COMMENT ON TABLE public.brand_accounts IS 'Empresa contratante (futuro Plano MARCA). Não é loja. Admin-only nesta fase.';
COMMENT ON COLUMN public.brand_templates.brand_account_id IS 'Empresa dona do template (0 ou 1). Máx 2 templates por empresa; transferência bloqueada com histórico.';