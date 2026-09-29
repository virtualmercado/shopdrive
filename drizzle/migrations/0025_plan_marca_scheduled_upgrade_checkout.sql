-- Checkout da troca agendada: o servidor resolve a intenção do próprio usuário (nunca id vindo do navegador)
CREATE OR REPLACE FUNCTION public.claim_marca_upgrade_checkout(p_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE v record; v_acc record;
BEGIN
  SELECT * INTO v FROM public.marca_scheduled_upgrades
   WHERE store_profile_id = p_user_id AND status IN ('scheduled','awaiting_payment')
   ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('status','none'); END IF;
  -- transições preguiçosas (não depende da rotina diária)
  IF v.status = 'awaiting_payment' AND now() > v.grace_until THEN
    UPDATE public.marca_scheduled_upgrades SET status='expired', expired_at=now(), updated_at=now(), status_reason='not_paid_until_grace' WHERE id=v.id;
    RETURN jsonb_build_object('status','expired');
  END IF;
  IF v.status = 'scheduled' AND now() < v.effective_at THEN
    RETURN jsonb_build_object('status','scheduled','effective_at',v.effective_at);
  END IF;
  IF v.status = 'scheduled' THEN
    IF now() > v.grace_until THEN
      UPDATE public.marca_scheduled_upgrades SET status='expired', expired_at=now(), updated_at=now(), status_reason='not_paid_until_grace' WHERE id=v.id;
      RETURN jsonb_build_object('status','expired');
    END IF;
    UPDATE public.marca_scheduled_upgrades SET status='awaiting_payment', updated_at=now() WHERE id=v.id;
  END IF;
  SELECT monthly_price_snapshot, annual_discount_percent_snapshot INTO v_acc FROM public.plan_contract_acceptances WHERE id=v.contract_acceptance_id;
  RETURN jsonb_build_object('status','awaiting_payment','upgrade_id',v.id,'amount',v.frozen_amount,'currency',v.currency,
    'billing_cycle',v.target_billing_cycle,'acceptance_id',v.contract_acceptance_id,'brand_account_id',v.brand_account_id,
    'monthly_price',v_acc.monthly_price_snapshot,'annual_discount_percent',v_acc.annual_discount_percent_snapshot,
    'grace_until',v.grace_until,'target_subscription_id',v.target_subscription_id);
END $$;

CREATE OR REPLACE FUNCTION public.bind_marca_upgrade_target(p_upgrade_id uuid, p_subscription_id uuid)
RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE n int;
BEGIN
  UPDATE public.marca_scheduled_upgrades u SET target_subscription_id = p_subscription_id, updated_at = now()
   WHERE u.id = p_upgrade_id AND u.status = 'awaiting_payment'
     AND (u.target_subscription_id IS NULL OR u.target_subscription_id = p_subscription_id)
     AND EXISTS (SELECT 1 FROM public.master_subscriptions s WHERE s.id = p_subscription_id AND s.user_id = u.store_profile_id
                 AND lower(s.plan_id) = 'marca' AND s.contract_acceptance_id = u.contract_acceptance_id);
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n = 1;
END $$;

-- Ponto único: nenhuma rota de pagamento ativa um MARCA ligado a troca agendada fora das regras
CREATE OR REPLACE FUNCTION public._guard_marca_upgrade_target()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v record;
BEGIN
  IF NEW.status = 'active' AND OLD.status IS DISTINCT FROM 'active' THEN
    SELECT * INTO v FROM public.marca_scheduled_upgrades WHERE target_subscription_id = NEW.id FOR UPDATE;
    IF FOUND THEN
      IF v.status <> 'awaiting_payment' OR now() > v.grace_until
         OR NOT EXISTS (SELECT 1 FROM public.master_subscription_payments p WHERE p.subscription_id = NEW.id
                        AND p.status = 'paid' AND p.paid_at IS NOT NULL AND round(p.amount,2) = round(v.frozen_amount,2)) THEN
        INSERT INTO public.master_subscription_logs(subscription_id,user_id,event_type,event_description,metadata)
        VALUES (NEW.id, NEW.user_id, 'MARCA_UPGRADE_ACTIVATION_BLOCKED', 'Ativação MARCA bloqueada: troca agendada fora do prazo ou sem pagamento confirmado',
                jsonb_build_object('upgrade_id', v.id, 'upgrade_status', v.status));
        NEW.status := OLD.status;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public._after_marca_upgrade_target_active()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v record;
BEGIN
  IF NEW.status = 'active' AND OLD.status IS DISTINCT FROM 'active' THEN
    SELECT * INTO v FROM public.marca_scheduled_upgrades WHERE target_subscription_id = NEW.id AND status = 'awaiting_payment';
    IF FOUND THEN
      UPDATE public.marca_scheduled_upgrades SET status='activated', activated_at=now(), updated_at=now() WHERE id=v.id;
      UPDATE public.master_subscriptions SET status='cancelled', cancelled_at=now(), downgrade_reason='upgraded_to_marca', updated_at=now()
       WHERE id = v.source_subscription_id AND status IN ('active','past_due');
      INSERT INTO public.master_subscription_logs(subscription_id,user_id,event_type,event_description,metadata)
      VALUES (NEW.id, NEW.user_id, 'MARCA_UPGRADE_ACTIVATED', 'Troca agendada concluída após pagamento confirmado',
              jsonb_build_object('upgrade_id', v.id, 'source_subscription_id', v.source_subscription_id));
    END IF;
  END IF;
  RETURN NULL;
END $$;

CREATE TRIGGER trg_guard_marca_upgrade_target BEFORE UPDATE OF status ON public.master_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public._guard_marca_upgrade_target();
CREATE TRIGGER trg_after_marca_upgrade_target_active AFTER UPDATE OF status ON public.master_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public._after_marca_upgrade_target_active();

REVOKE ALL ON FUNCTION public.claim_marca_upgrade_checkout(uuid), public.bind_marca_upgrade_target(uuid,uuid),
  public._guard_marca_upgrade_target(), public._after_marca_upgrade_target_active() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_marca_upgrade_checkout(uuid), public.bind_marca_upgrade_target(uuid,uuid) TO service_role;