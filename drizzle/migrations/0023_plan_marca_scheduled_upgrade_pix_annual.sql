CREATE TABLE public.marca_scheduled_upgrades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_profile_id uuid NOT NULL,
  brand_account_id uuid NOT NULL REFERENCES public.brand_accounts(id),
  source_subscription_id uuid NOT NULL REFERENCES public.master_subscriptions(id),
  source_plan_id text NOT NULL,
  source_billing_cycle text NOT NULL,
  source_payment_method text NOT NULL,
  transition_mode text NOT NULL DEFAULT 'manual_payment',
  target_billing_cycle text NOT NULL,
  contract_acceptance_id uuid NOT NULL REFERENCES public.plan_contract_acceptances(id),
  frozen_amount numeric(12,2) NOT NULL,
  currency text NOT NULL DEFAULT 'BRL',
  effective_at timestamptz NOT NULL,
  grace_until timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'scheduled',
  target_subscription_id uuid REFERENCES public.master_subscriptions(id),
  activated_at timestamptz,
  expired_at timestamptz,
  cancelled_at timestamptz,
  status_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT msu_status_chk CHECK (status IN ('scheduled','awaiting_payment','activated','expired','cancelled')),
  CONSTRAINT msu_mode_chk CHECK (transition_mode = 'manual_payment'),
  CONSTRAINT msu_cycle_chk CHECK (target_billing_cycle IN ('monthly','annual')),
  CONSTRAINT msu_currency_chk CHECK (currency = 'BRL'),
  CONSTRAINT msu_amount_chk CHECK (frozen_amount > 0)
);
CREATE UNIQUE INDEX msu_one_open_per_source ON public.marca_scheduled_upgrades(source_subscription_id) WHERE status IN ('scheduled','awaiting_payment');
CREATE UNIQUE INDEX msu_one_open_per_store ON public.marca_scheduled_upgrades(store_profile_id) WHERE status IN ('scheduled','awaiting_payment');
CREATE INDEX msu_due_idx ON public.marca_scheduled_upgrades(status, effective_at);
GRANT ALL ON public.marca_scheduled_upgrades TO service_role;
ALTER TABLE public.marca_scheduled_upgrades ENABLE ROW LEVEL SECURITY;
COMMENT ON TABLE public.marca_scheduled_upgrades IS 'PRO/PREMIUM -> MARCA no vencimento (somente PIX mensal e anual). Cartao recorrente bloqueado. Acesso so via RPC/service_role.';

-- Agendar: tudo derivado no servidor
CREATE OR REPLACE FUNCTION public.schedule_my_marca_upgrade(p_target_cycle text, p_contract_acceptance_id uuid)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid(); v_sub record; v_owned record; v_acc record; v_mp record;
  v_grace int; v_amount numeric; v_existing record; v_id uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated' USING ERRCODE='42501'; END IF;
  IF NOT public.is_plan_marca_enabled() THEN RETURN jsonb_build_object('status','unavailable','message','Plano MARCA indisponível.'); END IF;
  IF p_target_cycle NOT IN ('monthly','annual') THEN RAISE EXCEPTION 'invalid cycle' USING ERRCODE='22023'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('marca_upgrade:'||v_uid::text,0));
  PERFORM public._marca_assert_owner_eligible(v_uid);

  SELECT * INTO v_owned FROM public.brand_account_owned_stores WHERE store_profile_id = v_uid;
  IF NOT FOUND OR v_owned.store_role <> 'primary' THEN RAISE EXCEPTION 'primary store required' USING ERRCODE='42501'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.brand_accounts WHERE id=v_owned.brand_account_id AND owner_profile_id=v_uid) THEN
    RAISE EXCEPTION 'not owner' USING ERRCODE='42501'; END IF;

  SELECT * INTO v_existing FROM public.marca_scheduled_upgrades WHERE store_profile_id=v_uid AND status IN ('scheduled','awaiting_payment');
  IF FOUND THEN RETURN jsonb_build_object('status','already_scheduled','upgrade_id',v_existing.id,'effective_at',v_existing.effective_at); END IF;

  SELECT * INTO v_sub FROM public.master_subscriptions WHERE user_id=v_uid AND status='active'
    ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
  IF NOT FOUND OR lower(v_sub.plan_id) NOT IN ('pro','premium') OR coalesce(v_sub.no_charge,false) THEN
    RETURN jsonb_build_object('status','not_eligible','message','Disponível apenas para PRO ou PREMIUM pagos e em dia.'); END IF;
  IF v_sub.billing_cycle = 'monthly' AND coalesce(v_sub.payment_method,'') <> 'pix' THEN
    RETURN jsonb_build_object('status','card_blocked','message','Troca a partir de cartão recorrente ainda não disponível.'); END IF;
  IF v_sub.gateway_subscription_id IS NOT NULL THEN
    RETURN jsonb_build_object('status','card_blocked','message','Troca a partir de cobrança recorrente ainda não disponível.'); END IF;
  IF v_sub.current_period_end IS NULL OR v_sub.current_period_end <= now() OR v_sub.grace_period_ends_at IS NOT NULL THEN
    RETURN jsonb_build_object('status','not_eligible','message','Assinatura sem período pago vigente.'); END IF;

  SELECT * INTO v_acc FROM public.plan_contract_acceptances WHERE id=p_contract_acceptance_id;
  IF NOT FOUND OR v_acc.accepted_by_profile_id <> v_uid OR v_acc.brand_account_id <> v_owned.brand_account_id
     OR lower(v_acc.plan_id_snapshot) <> 'marca' OR v_acc.billing_cycle <> p_target_cycle THEN
    RAISE EXCEPTION 'invalid acceptance' USING ERRCODE='42501'; END IF;

  v_amount := CASE WHEN p_target_cycle='monthly' THEN v_acc.monthly_price_snapshot
    ELSE round(v_acc.monthly_price_snapshot*12*(1 - coalesce(v_acc.annual_discount_percent_snapshot,0)/100.0),2) END;
  v_grace := CASE WHEN v_sub.billing_cycle='annual' THEN 14 ELSE 7 END;

  INSERT INTO public.marca_scheduled_upgrades(store_profile_id,brand_account_id,source_subscription_id,source_plan_id,
    source_billing_cycle,source_payment_method,target_billing_cycle,contract_acceptance_id,frozen_amount,effective_at,grace_until)
  VALUES (v_uid,v_owned.brand_account_id,v_sub.id,lower(v_sub.plan_id),v_sub.billing_cycle,coalesce(v_sub.payment_method,'pix'),
    p_target_cycle,v_acc.id,v_amount,v_sub.current_period_end,v_sub.current_period_end + make_interval(days=>v_grace))
  RETURNING id INTO v_id;

  INSERT INTO public.master_subscription_logs(subscription_id,user_id,event_type,event_description,metadata)
  VALUES (v_sub.id,v_uid,'marca_upgrade_scheduled','Troca para MARCA agendada para o vencimento',
    jsonb_build_object('upgrade_id',v_id,'effective_at',v_sub.current_period_end));
  RETURN jsonb_build_object('status','scheduled','upgrade_id',v_id,'effective_at',v_sub.current_period_end,
    'grace_until',v_sub.current_period_end + make_interval(days=>v_grace),'amount',v_amount,'currency','BRL');
END $$;

CREATE OR REPLACE FUNCTION public.get_my_marca_upgrade()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN auth.uid() IS NULL OR NOT public.is_plan_marca_enabled() THEN jsonb_build_object('status','unavailable')
  ELSE coalesce((SELECT jsonb_build_object('status',u.status,'upgrade_id',u.id,'effective_at',u.effective_at,
      'grace_until',u.grace_until,'amount',u.frozen_amount,'currency',u.currency,'target_cycle',u.target_billing_cycle,'source_plan',u.source_plan_id)
    FROM public.marca_scheduled_upgrades u WHERE u.store_profile_id=auth.uid() ORDER BY u.created_at DESC LIMIT 1),
    jsonb_build_object('status','none')) END
$$;

-- Processador (service_role): scheduled -> awaiting_payment; awaiting -> expired; origem cancelada/rebaixada -> cancelled
CREATE OR REPLACE FUNCTION public.process_marca_scheduled_upgrades()
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_due int; v_exp int; v_cxl int;
BEGIN
  UPDATE public.marca_scheduled_upgrades u SET status='cancelled', cancelled_at=now(), updated_at=now(), status_reason='source_changed'
  WHERE u.status='scheduled' AND NOT EXISTS (SELECT 1 FROM public.master_subscriptions s WHERE s.id=u.source_subscription_id
    AND s.status IN ('active','past_due') AND lower(s.plan_id)=u.source_plan_id);
  GET DIAGNOSTICS v_cxl = ROW_COUNT;
  UPDATE public.marca_scheduled_upgrades SET status='awaiting_payment', updated_at=now()
  WHERE status='scheduled' AND effective_at <= now();
  GET DIAGNOSTICS v_due = ROW_COUNT;
  UPDATE public.marca_scheduled_upgrades SET status='expired', expired_at=now(), updated_at=now(), status_reason='not_paid_until_grace'
  WHERE status='awaiting_payment' AND grace_until <= now();
  GET DIAGNOSTICS v_exp = ROW_COUNT;
  RETURN jsonb_build_object('cancelled',v_cxl,'awaiting_payment',v_due,'expired',v_exp);
END $$;

-- Ativação: só com pagamento MARCA aprovado de valor/moeda idênticos (chamada pelo backend de billing)
CREATE OR REPLACE FUNCTION public.activate_marca_scheduled_upgrade(p_upgrade_id uuid, p_target_subscription_id uuid, p_payment_id uuid)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_u record; v_t record; v_p record;
BEGIN
  SELECT * INTO v_u FROM public.marca_scheduled_upgrades WHERE id=p_upgrade_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('status','not_found'); END IF;
  IF v_u.status='activated' THEN RETURN jsonb_build_object('status','already_activated'); END IF;
  IF v_u.status NOT IN ('scheduled','awaiting_payment') THEN RETURN jsonb_build_object('status','late_payment_refused','upgrade_status',v_u.status); END IF;
  SELECT * INTO v_t FROM public.master_subscriptions WHERE id=p_target_subscription_id;
  SELECT * INTO v_p FROM public.master_subscription_payments WHERE id=p_payment_id AND subscription_id=p_target_subscription_id;
  IF v_t.id IS NULL OR v_t.user_id<>v_u.store_profile_id OR lower(v_t.plan_id)<>'marca' OR v_t.contract_acceptance_id<>v_u.contract_acceptance_id
     OR v_p.id IS NULL OR v_p.status<>'approved' OR v_p.amount<>v_u.frozen_amount THEN
    RETURN jsonb_build_object('status','payment_mismatch'); END IF;
  UPDATE public.marca_scheduled_upgrades SET status='activated', activated_at=now(), target_subscription_id=v_t.id, updated_at=now() WHERE id=v_u.id;
  UPDATE public.master_subscriptions SET status='cancelled', cancelled_at=now(), updated_at=now(), downgrade_reason='upgraded_to_marca'
   WHERE id=v_u.source_subscription_id AND status IN ('active','past_due');
  RETURN jsonb_build_object('status','activated');
END $$;

REVOKE ALL ON FUNCTION public.schedule_my_marca_upgrade(text,uuid), public.get_my_marca_upgrade(),
  public.process_marca_scheduled_upgrades(), public.activate_marca_scheduled_upgrade(uuid,uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.schedule_my_marca_upgrade(text,uuid), public.get_my_marca_upgrade() TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_marca_scheduled_upgrades(), public.activate_marca_scheduled_upgrade(uuid,uuid,uuid) TO service_role;