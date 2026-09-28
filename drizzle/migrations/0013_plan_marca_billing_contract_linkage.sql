-- Prompt 06: vínculo aditivo entre cobrança MARCA, empresa e aceite do contrato.
ALTER TABLE public.master_subscriptions
  ADD COLUMN IF NOT EXISTS contract_acceptance_id uuid NULL REFERENCES public.plan_contract_acceptances(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS brand_account_id uuid NULL REFERENCES public.brand_accounts(id) ON DELETE RESTRICT;
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS contract_acceptance_id uuid NULL REFERENCES public.plan_contract_acceptances(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS brand_account_id uuid NULL REFERENCES public.brand_accounts(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_master_subscriptions_contract_acceptance_id ON public.master_subscriptions(contract_acceptance_id) WHERE contract_acceptance_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_master_subscriptions_brand_account_id ON public.master_subscriptions(brand_account_id) WHERE brand_account_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_contract_acceptance_id ON public.invoices(contract_acceptance_id) WHERE contract_acceptance_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_brand_account_id ON public.invoices(brand_account_id) WHERE brand_account_id IS NOT NULL;

-- Idempotência: no máximo uma intenção MARCA pendente por usuário (duplo clique concorrente).
CREATE UNIQUE INDEX IF NOT EXISTS uq_master_subscriptions_marca_pending_per_user
  ON public.master_subscriptions(user_id) WHERE plan_id = 'marca' AND status = 'pending';

-- Validação completa do checkout MARCA (somente service_role).
CREATE OR REPLACE FUNCTION public.validate_marca_checkout(
  p_user_id uuid, p_brand_account_id uuid, p_acceptance_id uuid, p_billing_cycle text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public','extensions' AS $$
DECLARE v_plan record; v_brand record; v_acc record; v_ver record; v_terms text; v_hash text;
BEGIN
  IF p_user_id IS NULL THEN RAISE EXCEPTION 'Não foi possível validar os dados da contratação.' USING ERRCODE='P0001'; END IF;
  IF NOT public.is_plan_marca_enabled() THEN
    RAISE EXCEPTION 'Este plano ainda não está disponível para contratação.' USING ERRCODE='P0001'; END IF;
  SELECT plan_id, monthly_price, annual_discount_percent, is_active INTO v_plan FROM public.master_plans WHERE plan_id='marca';
  IF v_plan.plan_id IS NULL OR NOT v_plan.is_active THEN
    RAISE EXCEPTION 'Este plano ainda não está disponível para contratação.' USING ERRCODE='P0001'; END IF;
  IF p_brand_account_id IS NULL OR p_acceptance_id IS NULL THEN
    RAISE EXCEPTION 'É necessário aceitar a versão atual do contrato antes de continuar.' USING ERRCODE='P0001'; END IF;
  SELECT id, owner_profile_id INTO v_brand FROM public.brand_accounts WHERE id=p_brand_account_id;
  IF v_brand.id IS NULL OR v_brand.owner_profile_id IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Não foi possível validar os dados da contratação.' USING ERRCODE='42501'; END IF;
  SELECT * INTO v_acc FROM public.plan_contract_acceptances WHERE id=p_acceptance_id;
  IF v_acc.id IS NULL OR v_acc.plan_id_snapshot <> 'marca' OR v_acc.brand_account_id <> v_brand.id
     OR v_acc.accepted_by_profile_id IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Não foi possível validar os dados da contratação.' USING ERRCODE='42501'; END IF;
  SELECT v.* INTO v_ver FROM public.plan_contract_settings s JOIN public.plan_contract_versions v ON v.id=s.current_version_id
   WHERE s.plan_id='marca' AND v.status='published';
  IF v_ver.id IS NULL OR v_ver.id <> v_acc.contract_version_id OR v_ver.content_hash_sha256 <> v_acc.contract_hash_snapshot THEN
    RAISE EXCEPTION 'É necessário aceitar a versão atual do contrato antes de continuar.' USING ERRCODE='P0001'; END IF;
  IF p_billing_cycle IS DISTINCT FROM v_acc.billing_cycle OR p_billing_cycle NOT IN ('monthly','annual') THEN
    RAISE EXCEPTION 'Os termos comerciais foram atualizados. Revise e aceite novamente.' USING ERRCODE='P0001'; END IF;
  IF v_acc.monthly_price_snapshot <> v_plan.monthly_price
     OR v_acc.annual_discount_percent_snapshot IS DISTINCT FROM v_plan.annual_discount_percent THEN
    RAISE EXCEPTION 'Os termos comerciais foram atualizados. Revise e aceite novamente.' USING ERRCODE='P0001'; END IF;
  -- Mesma construção de termos usada em record_plan_contract_acceptance.
  v_terms := jsonb_build_object('plan_id', v_plan.plan_id, 'billing_cycle', p_billing_cycle,
    'monthly_price', v_plan.monthly_price::text, 'annual_discount_percent', v_plan.annual_discount_percent,
    'contract_version_id', v_ver.id, 'contract_hash', v_ver.content_hash_sha256,
    'acceptance_statement', v_ver.acceptance_statement)::text;
  v_hash := encode(extensions.digest(convert_to(v_terms,'UTF8'),'sha256'),'hex');
  IF v_hash <> v_acc.commercial_terms_hash THEN
    RAISE EXCEPTION 'Os termos comerciais foram atualizados. Revise e aceite novamente.' USING ERRCODE='P0001'; END IF;
  RETURN jsonb_build_object('ok', true, 'acceptance_id', v_acc.id, 'brand_account_id', v_brand.id,
    'contract_version_id', v_ver.id, 'commercial_terms_hash', v_acc.commercial_terms_hash,
    'monthly_price', v_plan.monthly_price, 'annual_discount_percent', v_plan.annual_discount_percent);
END; $$;
REVOKE ALL ON FUNCTION public.validate_marca_checkout(uuid,uuid,uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.validate_marca_checkout(uuid,uuid,uuid,text) TO service_role;

-- Motivo de bloqueio da ativação MARCA (NULL = pode ativar). Usa só termos congelados.
CREATE OR REPLACE FUNCTION public.marca_activation_block_reason(p_subscription_id uuid)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE s record; a record; p record; v_ref text;
BEGIN
  SELECT * INTO s FROM public.master_subscriptions WHERE id=p_subscription_id;
  IF s.id IS NULL THEN RETURN 'subscription_not_found'; END IF;
  IF s.contract_acceptance_id IS NULL OR s.brand_account_id IS NULL THEN RETURN 'missing_acceptance'; END IF;
  SELECT * INTO a FROM public.plan_contract_acceptances WHERE id=s.contract_acceptance_id;
  IF a.id IS NULL OR a.plan_id_snapshot <> 'marca' OR a.brand_account_id <> s.brand_account_id
     OR a.billing_cycle <> s.billing_cycle OR a.accepted_by_profile_id IS DISTINCT FROM s.user_id THEN
    RETURN 'acceptance_mismatch'; END IF;
  SELECT * INTO p FROM public.master_subscription_payments
   WHERE subscription_id=s.id AND status='paid' AND gateway_payment_id IS NOT NULL
   ORDER BY COALESCE(paid_at, updated_at) DESC LIMIT 1;
  IF p.id IS NULL THEN RETURN 'no_confirmed_payment'; END IF;
  IF p.gateway_response ? 'currency_id' AND p.gateway_response->>'currency_id' <> 'BRL' THEN RETURN 'currency_mismatch'; END IF;
  IF p.gateway_response ? 'transaction_amount'
     AND round((p.gateway_response->>'transaction_amount')::numeric,2) <> round(p.amount,2) THEN RETURN 'amount_mismatch'; END IF;
  v_ref := NULLIF(p.gateway_response->>'external_reference','');
  IF NOT EXISTS (SELECT 1 FROM public.invoices i
     WHERE i.subscription_id=s.id AND i.contract_acceptance_id=s.contract_acceptance_id
       AND i.brand_account_id=s.brand_account_id AND i.status IN ('pending','paid')
       AND round(i.amount,2)=round(p.amount,2)
       AND (v_ref IS NULL OR i.invoice_id=v_ref)) THEN
    RETURN 'invoice_mismatch'; END IF;
  RETURN NULL;
END; $$;
REVOKE ALL ON FUNCTION public.marca_activation_block_reason(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.marca_activation_block_reason(uuid) TO service_role;

-- Guarda no banco: nenhum caminho ativa MARCA sem pagamento confirmado e aceite coerente.
CREATE OR REPLACE FUNCTION public.guard_marca_subscription()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_reason text; v_acc record;
BEGIN
  IF NEW.plan_id = 'marca' AND (TG_OP='INSERT' OR OLD.plan_id IS DISTINCT FROM 'marca'
       OR NEW.contract_acceptance_id IS DISTINCT FROM OLD.contract_acceptance_id
       OR NEW.brand_account_id IS DISTINCT FROM OLD.brand_account_id) THEN
    IF NEW.contract_acceptance_id IS NULL OR NEW.brand_account_id IS NULL THEN
      RAISE EXCEPTION 'Contratação MARCA exige aceite do contrato.' USING ERRCODE='P0001'; END IF;
    SELECT brand_account_id INTO v_acc FROM public.plan_contract_acceptances WHERE id=NEW.contract_acceptance_id;
    IF v_acc.brand_account_id IS DISTINCT FROM NEW.brand_account_id THEN
      RAISE EXCEPTION 'Empresa da assinatura não corresponde ao aceite.' USING ERRCODE='P0001'; END IF;
  END IF;
  IF NEW.plan_id = 'marca' AND NEW.status = 'active'
     AND (TG_OP='INSERT' OR OLD.status IS DISTINCT FROM 'active' OR OLD.plan_id IS DISTINCT FROM 'marca') THEN
    IF TG_OP='INSERT' THEN v_reason := 'no_confirmed_payment';
    ELSE
      -- avalia com os valores novos de vínculo
      v_reason := public.marca_activation_block_reason(NEW.id);
    END IF;
    IF v_reason IS NOT NULL THEN
      IF TG_OP='INSERT' THEN NEW.status := 'pending';
      ELSE NEW.status := OLD.status; NEW.plan_id := OLD.plan_id; END IF;
      IF TG_OP='UPDATE' THEN
        INSERT INTO public.master_subscription_logs(subscription_id, user_id, event_type, event_description, metadata)
        VALUES (NEW.id, NEW.user_id, 'MARCA_ACTIVATION_BLOCKED', 'Ativação MARCA bloqueada pela validação financeira',
                jsonb_build_object('reason', v_reason));
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_guard_marca_subscription ON public.master_subscriptions;
CREATE TRIGGER trg_guard_marca_subscription BEFORE INSERT OR UPDATE ON public.master_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.guard_marca_subscription();

-- Faturas: herdam aceite/empresa da assinatura; fatura MARCA sem aceite é recusada.
CREATE OR REPLACE FUNCTION public.guard_marca_invoice()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE s record;
BEGIN
  IF NEW.subscription_id IS NOT NULL THEN
    SELECT contract_acceptance_id, brand_account_id INTO s FROM public.master_subscriptions WHERE id=NEW.subscription_id;
    IF s.contract_acceptance_id IS NOT NULL THEN
      NEW.contract_acceptance_id := COALESCE(NEW.contract_acceptance_id, s.contract_acceptance_id);
      NEW.brand_account_id := COALESCE(NEW.brand_account_id, s.brand_account_id);
      IF NEW.contract_acceptance_id <> s.contract_acceptance_id OR NEW.brand_account_id <> s.brand_account_id THEN
        RAISE EXCEPTION 'Fatura não corresponde ao aceite da assinatura.' USING ERRCODE='P0001'; END IF;
    END IF;
  END IF;
  IF NEW.plan = 'marca' AND (NEW.contract_acceptance_id IS NULL OR NEW.brand_account_id IS NULL) THEN
    RAISE EXCEPTION 'Fatura MARCA exige aceite do contrato.' USING ERRCODE='P0001'; END IF;
  IF TG_OP='UPDATE' AND (NEW.contract_acceptance_id IS DISTINCT FROM OLD.contract_acceptance_id
       OR NEW.brand_account_id IS DISTINCT FROM OLD.brand_account_id) AND OLD.contract_acceptance_id IS NOT NULL THEN
    RAISE EXCEPTION 'O aceite de uma fatura não pode ser alterado.' USING ERRCODE='P0001'; END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_guard_marca_invoice ON public.invoices;
CREATE TRIGGER trg_guard_marca_invoice BEFORE INSERT OR UPDATE OF contract_acceptance_id, brand_account_id, plan, subscription_id ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.guard_marca_invoice();