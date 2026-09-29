-- Leitura única do caminho comercial MARCA para a tela do Financeiro. Não grava nada.
-- O servidor decide: imediato (sem plano pago), troca agendada (PRO/PREMIUM PIX/anual) ou bloqueado (cartão recorrente).
CREATE OR REPLACE FUNCTION public.get_my_marca_offer()
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_uid uuid := auth.uid(); v_mp record; v_sub record; v_up record; v_path text; v_eff timestamptz;
BEGIN
  IF v_uid IS NULL OR NOT public.is_plan_marca_enabled() THEN RETURN jsonb_build_object('status','unavailable'); END IF;
  SELECT monthly_price, annual_discount_percent, is_active INTO v_mp FROM public.master_plans WHERE plan_id='marca';
  IF v_mp.monthly_price IS NULL OR NOT v_mp.is_active THEN RETURN jsonb_build_object('status','unavailable'); END IF;

  IF EXISTS (SELECT 1 FROM public.brand_account_owned_stores WHERE store_profile_id=v_uid AND store_role='secondary') THEN
    v_path := 'secondary';
  ELSE
    BEGIN
      PERFORM public._marca_assert_owner_eligible(v_uid);
    EXCEPTION WHEN insufficient_privilege THEN
      RETURN jsonb_build_object('status','ok','path','not_eligible','monthly_price',v_mp.monthly_price,'annual_discount_percent',v_mp.annual_discount_percent);
    END;
    SELECT * INTO v_up FROM public.marca_scheduled_upgrades WHERE store_profile_id=v_uid AND status IN ('scheduled','awaiting_payment') LIMIT 1;
    IF FOUND THEN v_path := 'already_scheduled'; v_eff := v_up.effective_at;
    ELSE
      SELECT * INTO v_sub FROM public.master_subscriptions WHERE user_id=v_uid AND status='active' ORDER BY created_at DESC LIMIT 1;
      IF NOT FOUND OR coalesce(v_sub.no_charge,false) OR lower(v_sub.plan_id) NOT IN ('pro','premium','marca') THEN v_path := 'immediate';
      ELSIF lower(v_sub.plan_id)='marca' THEN v_path := 'current';
      ELSIF (v_sub.billing_cycle='monthly' AND coalesce(v_sub.payment_method,'')<>'pix') OR v_sub.gateway_subscription_id IS NOT NULL THEN v_path := 'card_blocked';
      ELSIF v_sub.current_period_end IS NULL OR v_sub.current_period_end <= now() OR v_sub.grace_period_ends_at IS NOT NULL THEN v_path := 'not_eligible';
      ELSE v_path := 'scheduled'; v_eff := v_sub.current_period_end;
      END IF;
    END IF;
  END IF;
  RETURN jsonb_build_object('status','ok','path',v_path,'effective_at',v_eff,
    'monthly_price',v_mp.monthly_price,'annual_discount_percent',v_mp.annual_discount_percent);
END $function$;
REVOKE ALL ON FUNCTION public.get_my_marca_offer() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_marca_offer() TO authenticated;