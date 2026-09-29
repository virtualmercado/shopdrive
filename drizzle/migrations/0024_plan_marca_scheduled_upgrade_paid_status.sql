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
  IF v_t.id IS NULL OR v_t.user_id<>v_u.store_profile_id OR lower(v_t.plan_id)<>'marca' OR v_t.contract_acceptance_id IS DISTINCT FROM v_u.contract_acceptance_id
     OR v_p.id IS NULL OR v_p.status<>'paid' OR v_p.paid_at IS NULL OR v_p.amount<>v_u.frozen_amount THEN
    RETURN jsonb_build_object('status','payment_mismatch'); END IF;
  UPDATE public.marca_scheduled_upgrades SET status='activated', activated_at=now(), target_subscription_id=v_t.id, updated_at=now() WHERE id=v_u.id;
  UPDATE public.master_subscriptions SET status='cancelled', cancelled_at=now(), updated_at=now(), downgrade_reason='upgraded_to_marca'
   WHERE id=v_u.source_subscription_id AND status IN ('active','past_due');
  RETURN jsonb_build_object('status','activated');
END $$;
REVOKE ALL ON FUNCTION public.activate_marca_scheduled_upgrade(uuid,uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.activate_marca_scheduled_upgrade(uuid,uuid,uuid) TO service_role;