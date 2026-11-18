-- Regularization of an already-contracted, delinquent subscription: same subscription, server-derived terms,
-- one open PIX charge per subscription, entitlement restored only by the existing payment reconciliation.
CREATE TABLE public.master_subscription_regularizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL REFERENCES public.master_subscriptions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  plan_id text NOT NULL CHECK (plan_id IN ('pro','premium','marca')),
  billing_cycle text NOT NULL CHECK (billing_cycle IN ('monthly','annual')),
  monthly_price numeric(12,2) NOT NULL CHECK (monthly_price > 0),
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  invoice_id uuid NOT NULL UNIQUE REFERENCES public.invoices(id) ON DELETE CASCADE,
  payment_id uuid UNIQUE REFERENCES public.master_subscription_payments(id) ON DELETE SET NULL,
  gateway_payment_id text UNIQUE,
  idempotency_key text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','failed','expired','cancelled')),
  pix_expires_at timestamptz NOT NULL,
  charging_until timestamptz,
  charge_attempts integer NOT NULL DEFAULT 0,
  applied_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX master_subscription_regularizations_one_open ON public.master_subscription_regularizations(subscription_id) WHERE status = 'pending';
CREATE INDEX master_subscription_regularizations_user ON public.master_subscription_regularizations(user_id, created_at DESC);
REVOKE ALL ON public.master_subscription_regularizations FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.master_subscription_regularizations TO service_role;
ALTER TABLE public.master_subscription_regularizations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role manages subscription regularizations" ON public.master_subscription_regularizations
  FOR ALL TO service_role USING (true) WITH CHECK (true);
COMMENT ON TABLE public.master_subscription_regularizations IS 'Service-only ledger: one open regularization charge per delinquent contracted subscription; never a new subscription or contract.';

-- Contracted plan and cycle of the caller's delinquent subscription. The accepted contract is only legal
-- evidence (plan/cycle/company must match); the amount comes from the subscription's own financial record
-- (its price fields, else its latest paid invoice of the same plan/cycle), with the official price table as last resort.
CREATE OR REPLACE FUNCTION public._subscription_regularization_terms(p_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO ''
AS $$
DECLARE s public.master_subscriptions; a public.plan_contract_acceptances; inv public.invoices; v_plan text; v_price numeric; v_disc numeric;
  v_amount numeric; v_name text; v_official numeric; v_source text;
BEGIN
  IF p_user_id IS NULL THEN RETURN jsonb_build_object('eligible',false,'reason','unauthenticated'); END IF;
  IF EXISTS (SELECT 1 FROM public.brand_account_owned_stores WHERE store_profile_id=p_user_id AND store_role='secondary') THEN
    RETURN jsonb_build_object('eligible',false,'reason','secondary_store'); END IF;
  SELECT * INTO s FROM public.master_subscriptions WHERE user_id=p_user_id AND status IN ('active','past_due')
   ORDER BY created_at DESC, id DESC LIMIT 1;
  IF s.id IS NULL THEN RETURN jsonb_build_object('eligible',false,'reason','no_subscription'); END IF;
  IF coalesce(s.no_charge,false) THEN RETURN jsonb_build_object('eligible',false,'reason','no_charge'); END IF;
  IF s.gateway IS DISTINCT FROM 'mercadopago' THEN RETURN jsonb_build_object('eligible',false,'reason','unsupported_gateway'); END IF;
  -- An external recurrence could charge again on its own: never offer a parallel one-off charge.
  IF nullif(s.gateway_subscription_id,'') IS NOT NULL THEN RETURN jsonb_build_object('eligible',false,'reason','recurring_charge'); END IF;
  IF s.billing_cycle NOT IN ('monthly','annual') THEN RETURN jsonb_build_object('eligible',false,'reason','unsupported_cycle'); END IF;
  IF lower(coalesce(s.plan_id,'')) IN ('gratis','free') AND s.downgrade_reason='nonpayment' THEN
    v_plan := lower(coalesce(s.previous_plan_id,''));
  ELSIF s.status='past_due' AND s.current_period_end IS NOT NULL AND s.current_period_end<=now() THEN
    v_plan := lower(coalesce(s.plan_id,''));
  ELSE
    RETURN jsonb_build_object('eligible',false,'reason','not_delinquent');
  END IF;
  IF v_plan NOT IN ('pro','premium','marca') THEN RETURN jsonb_build_object('eligible',false,'reason','not_paid_plan'); END IF;
  IF v_plan='marca' THEN
    SELECT * INTO a FROM public.plan_contract_acceptances WHERE id=s.contract_acceptance_id;
    IF a.id IS NULL OR s.brand_account_id IS NULL OR a.plan_id_snapshot<>'marca' OR a.brand_account_id IS DISTINCT FROM s.brand_account_id
       OR a.accepted_by_profile_id IS DISTINCT FROM p_user_id OR a.billing_cycle IS DISTINCT FROM s.billing_cycle
       OR NOT EXISTS (SELECT 1 FROM public.brand_accounts b WHERE b.id=s.brand_account_id AND b.owner_profile_id=p_user_id) THEN
      RETURN jsonb_build_object('eligible',false,'reason','contract_mismatch');
    END IF;
  END IF;
  SELECT display_name, CASE WHEN is_active THEN monthly_price END, coalesce(nullif(annual_discount_percent,0),30)
    INTO v_name, v_official, v_disc FROM public.master_plans WHERE plan_id=v_plan;
  IF lower(coalesce(s.plan_id,''))=v_plan AND coalesce(s.total_amount,0)>0 THEN
    v_amount := round(s.total_amount,2); v_price := round(coalesce(nullif(s.monthly_price,0),s.total_amount),2); v_source := 'subscription';
  ELSE
    SELECT * INTO inv FROM public.invoices WHERE subscription_id=s.id AND status='paid' AND lower(coalesce(plan,''))=v_plan AND amount>0
       AND CASE s.billing_cycle WHEN 'annual' THEN reference_period_end-reference_period_start >= 300
                                ELSE reference_period_end-reference_period_start BETWEEN 20 AND 45 END
     ORDER BY reference_period_end DESC, paid_at DESC NULLS LAST LIMIT 1;
    IF inv.id IS NOT NULL THEN
      v_amount := round(inv.amount,2); v_source := 'subscription_invoice';
      v_price := CASE s.billing_cycle WHEN 'monthly' THEN v_amount ELSE round(coalesce(nullif(s.monthly_price,0),v_official,v_amount/12),2) END;
    ELSIF v_official IS NOT NULL AND v_official>0 THEN
      v_price := round(v_official,2); v_source := 'official_price';
      v_amount := CASE s.billing_cycle WHEN 'annual' THEN round(v_official*12*(100-v_disc)/100.0,2) ELSE round(v_official,2) END;
    END IF;
  END IF;
  IF v_amount IS NULL OR v_amount<=0 OR v_price IS NULL OR v_price<=0 THEN RETURN jsonb_build_object('eligible',false,'reason','price_unavailable'); END IF;
  RETURN jsonb_build_object('eligible',true,'subscription_id',s.id,'plan_id',v_plan,'plan_name',coalesce(v_name,upper(v_plan)),
    'billing_cycle',s.billing_cycle,'monthly_price',v_price,'amount',v_amount,'value_source',v_source,
    'temporarily_limited',lower(coalesce(s.plan_id,'')) IN ('gratis','free'),
    'contract_acceptance_id',s.contract_acceptance_id,'brand_account_id',s.brand_account_id);
END $$;
REVOKE ALL ON FUNCTION public._subscription_regularization_terms(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._subscription_regularization_terms(uuid) TO service_role;

-- Owner-only projection for the panel: contracted plan, pending status and the open PIX (if any). Never accepts values.
CREATE OR REPLACE FUNCTION public.get_my_subscription_regularization()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO ''
AS $$
DECLARE v_uid uuid := auth.uid(); t jsonb; g public.master_subscription_regularizations; p public.master_subscription_payments;
  l public.master_subscription_regularizations; v_last jsonb; v_open jsonb;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('state','none'); END IF;
  SELECT * INTO l FROM public.master_subscription_regularizations WHERE user_id=v_uid ORDER BY created_at DESC LIMIT 1;
  IF l.id IS NOT NULL THEN
    v_last := jsonb_build_object('regularization_id',l.id,'status',l.status,'plan_id',l.plan_id,'applied_at',l.applied_at);
  END IF;
  t := public._subscription_regularization_terms(v_uid);
  IF NOT coalesce((t->>'eligible')::boolean,false) THEN RETURN jsonb_build_object('state','none','last',v_last); END IF;
  SELECT * INTO g FROM public.master_subscription_regularizations WHERE subscription_id=(t->>'subscription_id')::uuid AND status='pending';
  IF g.id IS NOT NULL AND g.payment_id IS NOT NULL AND g.pix_expires_at > now() THEN
    SELECT * INTO p FROM public.master_subscription_payments WHERE id=g.payment_id;
    IF p.status IN ('pending','in_process','processing') THEN
      v_open := jsonb_build_object('regularization_id',g.id,'pix_qr_code',p.pix_qr_code,'pix_qr_code_base64',p.pix_qr_code_base64,'pix_expires_at',g.pix_expires_at);
    END IF;
  END IF;
  RETURN jsonb_build_object('state','payable','plan_id',t->>'plan_id','plan_name',t->>'plan_name','billing_cycle',t->>'billing_cycle',
    'amount',(t->>'amount')::numeric,'currency','BRL','payment_method','pix','temporarily_limited',(t->>'temporarily_limited')::boolean,
    'open',v_open,'last',v_last);
END $$;
REVOKE ALL ON FUNCTION public.get_my_subscription_regularization() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_subscription_regularization() TO authenticated, service_role;

-- Locks the subscription, reuses the open charge or creates exactly one invoice + ledger row for a provider call.
CREATE OR REPLACE FUNCTION public.begin_subscription_regularization(p_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $$
DECLARE t jsonb; s public.master_subscriptions; g public.master_subscription_regularizations; p public.master_subscription_payments; i public.invoices;
  v_cycle interval;
BEGIN
  IF coalesce(auth.role(),'')<>'service_role' THEN RAISE EXCEPTION 'service_role_required' USING ERRCODE='42501'; END IF;
  t := public._subscription_regularization_terms(p_user_id);
  IF NOT coalesce((t->>'eligible')::boolean,false) THEN RETURN jsonb_build_object('status','not_eligible','reason',t->>'reason'); END IF;
  SELECT * INTO s FROM public.master_subscriptions WHERE id=(t->>'subscription_id')::uuid FOR UPDATE;
  IF public._subscription_regularization_terms(p_user_id) IS DISTINCT FROM t THEN RETURN jsonb_build_object('status','busy'); END IF;
  SELECT * INTO g FROM public.master_subscription_regularizations WHERE subscription_id=s.id AND status='pending' FOR UPDATE;
  IF g.id IS NOT NULL THEN
    IF g.gateway_payment_id IS NOT NULL THEN
      IF g.pix_expires_at > now() + interval '1 minute' THEN
        SELECT * INTO p FROM public.master_subscription_payments WHERE id=g.payment_id;
        IF p.status IN ('pending','in_process','processing') THEN
          RETURN jsonb_build_object('status','open','regularization_id',g.id,'amount',g.amount,'plan_id',g.plan_id,'billing_cycle',g.billing_cycle,
            'pix_qr_code',p.pix_qr_code,'pix_qr_code_base64',p.pix_qr_code_base64,'pix_expires_at',g.pix_expires_at);
        END IF;
      END IF;
      -- The provider is the authority for an existing charge before anything new may be created.
      RETURN jsonb_build_object('status','reconcile','regularization_id',g.id,'gateway_payment_id',g.gateway_payment_id);
    END IF;
    IF g.charging_until IS NOT NULL AND g.charging_until > now() THEN RETURN jsonb_build_object('status','busy'); END IF;
    IF g.pix_expires_at > now() + interval '2 minutes' THEN
      UPDATE public.master_subscription_regularizations SET charging_until=now()+interval '45 seconds', charge_attempts=charge_attempts+1, updated_at=now()
       WHERE id=g.id RETURNING * INTO g;
      SELECT * INTO i FROM public.invoices WHERE id=g.invoice_id;
      RETURN jsonb_build_object('status','charge','regularization_id',g.id,'invoice_reference',i.invoice_id,'amount',g.amount,'plan_id',g.plan_id,
        'plan_name',t->>'plan_name','billing_cycle',g.billing_cycle,'idempotency_key',g.idempotency_key,'pix_expires_at',g.pix_expires_at);
    END IF;
    -- Never recorded at the provider and past its expiry: close it; a late provider approval still settles by invoice reference.
    UPDATE public.master_subscription_regularizations SET status='expired', closed_at=now(), charging_until=NULL, updated_at=now() WHERE id=g.id;
    UPDATE public.invoices SET status='expired', updated_at=now() WHERE id=g.invoice_id AND status='pending';
  END IF;
  v_cycle := CASE t->>'billing_cycle' WHEN 'annual' THEN interval '1 year' ELSE interval '1 month' END;
  PERFORM pg_advisory_xact_lock(hashtextextended('mp-master-invoice-numbering',0));
  INSERT INTO public.invoices(subscriber_id,subscription_id,amount,status,due_date,reference_period_start,reference_period_end,payment_method,plan,
    contract_acceptance_id,brand_account_id,notes)
  VALUES(p_user_id,s.id,(t->>'amount')::numeric,'pending',now()+interval '30 minutes',current_date,(current_date+v_cycle)::date,'pix',t->>'plan_id',
    nullif(t->>'contract_acceptance_id','')::uuid,nullif(t->>'brand_account_id','')::uuid,'Regularização de pagamento da assinatura')
  RETURNING * INTO i;
  INSERT INTO public.master_subscription_regularizations(subscription_id,user_id,plan_id,billing_cycle,monthly_price,amount,invoice_id,idempotency_key,
    pix_expires_at,charging_until,charge_attempts)
  VALUES(s.id,p_user_id,t->>'plan_id',t->>'billing_cycle',(t->>'monthly_price')::numeric,(t->>'amount')::numeric,i.id,'regularize:'||i.id::text,
    i.due_date,now()+interval '45 seconds',1)
  RETURNING * INTO g;
  INSERT INTO public.master_subscription_logs(subscription_id,user_id,event_type,event_description,metadata)
  VALUES(s.id,p_user_id,'regularization_started','Regularização de pagamento iniciada para a assinatura existente',
    jsonb_build_object('regularization_id',g.id,'invoice',i.invoice_id,'plan',g.plan_id,'billing_cycle',g.billing_cycle,'amount',g.amount));
  RETURN jsonb_build_object('status','charge','regularization_id',g.id,'invoice_reference',i.invoice_id,'amount',g.amount,'plan_id',g.plan_id,
    'plan_name',t->>'plan_name','billing_cycle',g.billing_cycle,'idempotency_key',g.idempotency_key,'pix_expires_at',g.pix_expires_at);
END $$;
REVOKE ALL ON FUNCTION public.begin_subscription_regularization(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.begin_subscription_regularization(uuid) TO service_role;

-- Binds the provider PIX to the open regularization; replays with the same provider id are idempotent.
CREATE OR REPLACE FUNCTION public.record_subscription_regularization_charge(p_regularization_id uuid, p_resource jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $$
DECLARE g public.master_subscription_regularizations; s public.master_subscriptions; i public.invoices; p public.master_subscription_payments;
  pid text := p_resource->>'id'; gst text := p_resource->>'status'; v_new boolean := false;
BEGIN
  IF coalesce(auth.role(),'')<>'service_role' THEN RAISE EXCEPTION 'service_role_required' USING ERRCODE='42501'; END IF;
  IF pid IS NULL OR pid !~ '^[A-Za-z0-9_-]{1,200}$' THEN RAISE EXCEPTION 'invalid_resource_id'; END IF;
  IF gst NOT IN ('pending','in_process','authorized','approved','rejected','cancelled') OR p_resource->>'currency_id' IS DISTINCT FROM 'BRL' THEN
    RAISE EXCEPTION 'invalid_payment'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('mp-master-payment:'||pid,0));
  SELECT * INTO g FROM public.master_subscription_regularizations WHERE id=p_regularization_id;
  IF g.id IS NULL THEN RAISE EXCEPTION 'regularization_not_found'; END IF;
  SELECT * INTO s FROM public.master_subscriptions WHERE id=g.subscription_id FOR UPDATE;
  SELECT * INTO i FROM public.invoices WHERE id=g.invoice_id FOR UPDATE;
  SELECT * INTO g FROM public.master_subscription_regularizations WHERE id=p_regularization_id FOR UPDATE;
  IF round((p_resource->>'transaction_amount')::numeric,2) IS DISTINCT FROM g.amount OR p_resource->>'external_reference' IS DISTINCT FROM i.invoice_id THEN
    RAISE EXCEPTION 'charge_mismatch'; END IF;
  IF (g.gateway_payment_id IS NOT NULL AND g.gateway_payment_id<>pid) OR (i.mp_payment_id IS NOT NULL AND i.mp_payment_id<>pid) THEN
    RAISE EXCEPTION 'regularization_payment_mismatch'; END IF;
  SELECT * INTO p FROM public.master_subscription_payments WHERE gateway='mercadopago' AND gateway_payment_id=pid FOR UPDATE;
  IF p.id IS NOT NULL AND (p.subscription_id IS DISTINCT FROM g.subscription_id OR round(p.amount,2)<>g.amount) THEN RAISE EXCEPTION 'payment_mismatch'; END IF;
  IF p.id IS NULL THEN
    IF g.status<>'pending' THEN RETURN jsonb_build_object('status',g.status,'regularization_id',g.id); END IF;
    UPDATE public.invoices SET mp_payment_id=pid, due_date=g.pix_expires_at, updated_at=now() WHERE id=i.id;
    INSERT INTO public.master_subscription_payments(subscription_id,user_id,amount,gateway,payment_method,status,gateway_payment_id,gateway_status,
      gateway_response,pix_qr_code,pix_qr_code_base64,pix_expires_at,idempotency_key)
    VALUES(g.subscription_id,g.user_id,g.amount,'mercadopago','pix','pending',pid,gst,
      jsonb_build_object('id',pid,'status',gst,'status_detail',p_resource->>'status_detail','transaction_amount',g.amount,'currency_id','BRL','external_reference',i.invoice_id),
      p_resource->>'pix_qr_code',p_resource->>'pix_qr_code_base64',g.pix_expires_at,g.idempotency_key)
    RETURNING * INTO p;
    v_new := true;
  ELSE
    UPDATE public.master_subscription_payments SET pix_qr_code=coalesce(pix_qr_code,p_resource->>'pix_qr_code'),
      pix_qr_code_base64=coalesce(pix_qr_code_base64,p_resource->>'pix_qr_code_base64'), pix_expires_at=coalesce(pix_expires_at,g.pix_expires_at)
     WHERE id=p.id RETURNING * INTO p;
  END IF;
  UPDATE public.master_subscription_regularizations SET payment_id=p.id, gateway_payment_id=pid, charging_until=NULL, updated_at=now()
   WHERE id=g.id RETURNING * INTO g;
  IF v_new THEN
    INSERT INTO public.master_subscription_logs(subscription_id,user_id,payment_id,event_type,event_description,metadata)
    VALUES(g.subscription_id,g.user_id,p.id,'regularization_pix_generated','PIX de regularização gerado, aguardando pagamento',
      jsonb_build_object('regularization_id',g.id,'invoice',i.invoice_id,'mpPaymentId',pid));
  END IF;
  RETURN jsonb_build_object('status',g.status,'regularization_id',g.id,'amount',g.amount,'payment_status',p.status,
    'pix_qr_code',p.pix_qr_code,'pix_qr_code_base64',p.pix_qr_code_base64,'pix_expires_at',g.pix_expires_at);
END $$;
REVOKE ALL ON FUNCTION public.record_subscription_regularization_charge(uuid,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_subscription_regularization_charge(uuid,jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.release_subscription_regularization_charge(p_regularization_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $$
BEGIN
  IF coalesce(auth.role(),'')<>'service_role' THEN RAISE EXCEPTION 'service_role_required' USING ERRCODE='42501'; END IF;
  UPDATE public.master_subscription_regularizations SET charging_until=NULL, updated_at=now()
   WHERE id=p_regularization_id AND status='pending' AND gateway_payment_id IS NULL;
END $$;
REVOKE ALL ON FUNCTION public.release_subscription_regularization_charge(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_subscription_regularization_charge(uuid) TO service_role;

-- Closes a provider charge still unpaid well after its PIX expiry; approved/rejected/cancelled go through reconciliation.
CREATE OR REPLACE FUNCTION public.expire_subscription_regularization(p_regularization_id uuid, p_gateway_status text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $$
DECLARE g public.master_subscription_regularizations; p public.master_subscription_payments;
BEGIN
  IF coalesce(auth.role(),'')<>'service_role' THEN RAISE EXCEPTION 'service_role_required' USING ERRCODE='42501'; END IF;
  IF p_gateway_status NOT IN ('pending','in_process') THEN RAISE EXCEPTION 'use_reconciliation'; END IF;
  SELECT * INTO g FROM public.master_subscription_regularizations WHERE id=p_regularization_id;
  IF g.id IS NULL THEN RAISE EXCEPTION 'regularization_not_found'; END IF;
  IF g.gateway_payment_id IS NOT NULL THEN PERFORM pg_advisory_xact_lock(hashtextextended('mp-master-payment:'||g.gateway_payment_id,0)); END IF;
  PERFORM 1 FROM public.master_subscriptions WHERE id=g.subscription_id FOR UPDATE;
  PERFORM 1 FROM public.invoices WHERE id=g.invoice_id FOR UPDATE;
  SELECT * INTO g FROM public.master_subscription_regularizations WHERE id=p_regularization_id FOR UPDATE;
  IF g.status<>'pending' THEN RETURN jsonb_build_object('status',g.status); END IF;
  IF g.pix_expires_at > now() - interval '5 minutes' THEN RETURN jsonb_build_object('status','pending'); END IF;
  IF g.payment_id IS NOT NULL THEN
    SELECT * INTO p FROM public.master_subscription_payments WHERE id=g.payment_id FOR UPDATE;
    IF p.status='paid' THEN RETURN jsonb_build_object('status','pending'); END IF;
    UPDATE public.master_subscription_payments SET status='expired', gateway_status=p_gateway_status WHERE id=p.id AND status IN ('pending','in_process','processing');
  END IF;
  UPDATE public.invoices SET status='expired', updated_at=now() WHERE id=g.invoice_id AND status='pending';
  UPDATE public.master_subscription_regularizations SET status='expired', closed_at=now(), charging_until=NULL, updated_at=now() WHERE id=g.id;
  RETURN jsonb_build_object('status','expired');
END $$;
REVOKE ALL ON FUNCTION public.expire_subscription_regularization(uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expire_subscription_regularization(uuid,text) TO service_role;

-- Completed scheduled upgrades keep blocking unconfirmed reactivations; only a regularization applied
-- in this same transaction with a confirmed paid charge may reactivate the contracted subscription.
CREATE OR REPLACE FUNCTION public._guard_marca_upgrade_target()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v record;
BEGIN
  IF NEW.status = 'active' AND OLD.status IS DISTINCT FROM 'active' THEN
    SELECT * INTO v FROM public.marca_scheduled_upgrades WHERE target_subscription_id = NEW.id FOR UPDATE;
    IF FOUND THEN
      IF v.status = 'activated' AND EXISTS (
           SELECT 1 FROM public.master_subscription_regularizations g JOIN public.master_subscription_payments p ON p.id = g.payment_id
            WHERE g.subscription_id = NEW.id AND g.status = 'paid' AND g.applied_at = now() AND g.plan_id = NEW.plan_id
              AND p.status = 'paid' AND p.paid_at IS NOT NULL AND round(p.amount,2) = round(g.amount,2)) THEN
        RETURN NEW;
      END IF;
      IF v.status <> 'awaiting_payment' OR now() > v.grace_until
         OR NOT EXISTS (SELECT 1 FROM public.master_subscription_payments p WHERE p.subscription_id = NEW.id
                        AND p.status = 'paid' AND p.paid_at IS NOT NULL AND round(p.amount,2) = round(v.frozen_amount,2)) THEN
        INSERT INTO public.master_subscription_logs(subscription_id,user_id,event_type,event_description,metadata)
        VALUES (NEW.id, NEW.user_id, 'MARCA_UPGRADE_ACTIVATION_BLOCKED', 'Ativação MARCA bloqueada: troca agendada fora do prazo ou sem pagamento confirmado',
                jsonb_build_object('upgrade_id', v.id, 'upgrade_status', v.status));
        NEW.status := OLD.status;
        -- A refused activation must not leave MARCA entitlement behind on the row either.
        IF NEW.plan_id = 'marca' AND OLD.plan_id IS DISTINCT FROM 'marca' THEN NEW.plan_id := OLD.plan_id; END IF;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END $function$;

-- MARCA offer: a contracted MARCA awaiting payment is regularized, never re-contracted.
CREATE OR REPLACE FUNCTION public.get_my_marca_offer()
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_uid uuid := auth.uid(); v_mp record; v_sub record; v_up record; v_path text; v_eff timestamptz; v_reg jsonb;
BEGIN
  IF v_uid IS NULL OR NOT public.is_plan_marca_enabled() THEN RETURN jsonb_build_object('status','unavailable'); END IF;
  SELECT monthly_price, annual_discount_percent, is_active INTO v_mp FROM public.master_plans WHERE plan_id='marca';
  IF v_mp.monthly_price IS NULL OR NOT v_mp.is_active THEN RETURN jsonb_build_object('status','unavailable'); END IF;
  v_reg := public._subscription_regularization_terms(v_uid);

  IF EXISTS (SELECT 1 FROM public.brand_account_owned_stores WHERE store_profile_id=v_uid AND store_role='secondary') THEN
    v_path := 'secondary';
  ELSIF coalesce((v_reg->>'eligible')::boolean,false) AND v_reg->>'plan_id'='marca' THEN
    v_path := 'regularize';
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
CREATE OR REPLACE FUNCTION public.apply_master_subscription_webhook(p_event_key text, p_claim_token uuid, p_kind text, p_resource jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  r public.master_subscription_webhook_receipts;
  s public.master_subscriptions;
  p public.master_subscription_payments;
  i public.invoices;
  g public.master_subscription_regularizations;
  pid text := p_resource->>'id';
  preid text := nullif(p_resource->>'preapproval_id','');
  ext text := nullif(p_resource->>'external_reference','');
  gst text := p_resource->>'status';
  detail text := nullif(p_resource->>'status_detail','');
  amount_paid numeric;
  approved_at timestamptz;
  n integer;
  provenance public.invoices;
  application_new boolean := false;
  superseded boolean := false;
  next_payment_date timestamptz := (p_resource->>'next_payment_date')::timestamptz;
  paystatus text;
  substatus text;
  oldstatus text;
  oldsubstatus text;
  hard boolean := coalesce((p_resource->>'hard_decline')::boolean,false);
  msg text := p_resource->>'user_message';
  plan text;
  changed boolean := false;
  grace_days integer;
BEGIN
  IF coalesce(auth.role(),'') <> 'service_role' THEN RAISE EXCEPTION 'service_role_required' USING ERRCODE='42501'; END IF;
  SELECT * INTO r FROM public.master_subscription_webhook_receipts WHERE event_key=p_event_key FOR UPDATE;
  IF NOT FOUND OR r.claim_token IS DISTINCT FROM p_claim_token OR r.state <> 'processing' OR r.lease_until < now() THEN
    RAISE EXCEPTION 'invalid_claim';
  END IF;
  IF p_kind NOT IN ('payment','preapproval','ignored') THEN RAISE EXCEPTION 'invalid_resource_kind'; END IF;
  IF p_kind <> 'ignored' AND (pid IS NULL OR pid !~ '^[A-Za-z0-9_-]{1,200}$') THEN RAISE EXCEPTION 'invalid_resource_id'; END IF;
  IF p_kind='preapproval' THEN
    IF pid <> r.resource_id OR r.topic NOT IN ('preapproval','subscription_preapproval') OR gst NOT IN ('authorized','pending','paused','cancelled') THEN RAISE EXCEPTION 'resource_mismatch'; END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended('mp-master-sub:'||pid,0));
    SELECT count(*) INTO n FROM public.master_subscriptions WHERE gateway_subscription_id=pid AND gateway='mercadopago';
    IF n <> 1 THEN RAISE EXCEPTION 'subscription_not_unique'; END IF;
    SELECT * INTO s FROM public.master_subscriptions WHERE gateway_subscription_id=pid AND gateway='mercadopago' FOR UPDATE;
    substatus := CASE gst WHEN 'cancelled' THEN 'cancelled' WHEN 'paused' THEN 'past_due' ELSE s.status END;
    IF s.status IS DISTINCT FROM substatus OR (nullif(p_resource->>'next_payment_date','') IS NOT NULL AND s.current_period_end IS DISTINCT FROM (p_resource->>'next_payment_date')::timestamptz) THEN
      UPDATE public.master_subscriptions SET status=substatus,
        current_period_end=coalesce((p_resource->>'next_payment_date')::timestamptz,current_period_end),
        cancelled_at=CASE WHEN substatus='cancelled' THEN coalesce(cancelled_at,now()) ELSE cancelled_at END,
        grace_period_ends_at=CASE WHEN substatus='past_due' THEN coalesce(grace_period_ends_at,coalesce((p_resource->>'next_payment_date')::timestamptz,current_period_end)+(CASE WHEN billing_cycle='annual' THEN 14 ELSE 7 END)*interval '1 day') ELSE grace_period_ends_at END
      WHERE id=s.id;
      INSERT INTO public.master_subscription_logs(subscription_id,user_id,event_type,event_description,metadata)
        VALUES(s.id,s.user_id,'preapproval_updated','Assinatura recorrente atualizada no gateway',jsonb_build_object('preapprovalStatus',gst));
      changed := true;
    END IF;
  ELSIF p_kind='payment' THEN
    IF (r.topic='payment' AND pid<>r.resource_id) OR r.topic NOT IN ('payment','authorized_payment','subscription_authorized_payment') THEN RAISE EXCEPTION 'resource_mismatch'; END IF;
    IF gst NOT IN ('approved','pending','in_process','authorized','rejected','cancelled','refunded','charged_back') OR p_resource->>'currency_id' IS DISTINCT FROM 'BRL' THEN RAISE EXCEPTION 'invalid_payment'; END IF;
    amount_paid := (p_resource->>'transaction_amount')::numeric;
    IF amount_paid IS NULL OR amount_paid <= 0 OR amount_paid <> round(amount_paid,2) THEN RAISE EXCEPTION 'invalid_amount'; END IF;
    IF gst='approved' THEN
      approved_at := (p_resource->>'date_approved')::timestamptz;
      IF approved_at IS NULL THEN RAISE EXCEPTION 'approval_date_required'; END IF;
    END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended('mp-master-payment:'||pid,0));
    SELECT count(*) INTO n FROM public.master_subscription_payments WHERE gateway='mercadopago' AND gateway_payment_id=pid;
    IF n>1 THEN RAISE EXCEPTION 'payment_not_unique'; END IF;
    SELECT * INTO p FROM public.master_subscription_payments WHERE gateway='mercadopago' AND gateway_payment_id=pid;
    IF p.id IS NOT NULL THEN
      SELECT * INTO s FROM public.master_subscriptions WHERE id=p.subscription_id FOR UPDATE;
    ELSE
      IF ext IS NOT NULL THEN
        SELECT * INTO i FROM public.invoices WHERE invoice_id=ext;
        IF i.id IS NULL THEN RAISE EXCEPTION 'external_reference_mismatch'; END IF;
        SELECT * INTO s FROM public.master_subscriptions WHERE id=i.subscription_id AND gateway='mercadopago' FOR UPDATE;
      ELSIF preid IS NOT NULL THEN
        SELECT count(*) INTO n FROM public.master_subscriptions WHERE gateway_subscription_id=preid AND gateway='mercadopago';
        IF n<>1 THEN RAISE EXCEPTION 'subscription_not_unique'; END IF;
        SELECT * INTO s FROM public.master_subscriptions WHERE gateway_subscription_id=preid AND gateway='mercadopago' FOR UPDATE;
      END IF;
    END IF;
    IF s.id IS NULL OR s.gateway<>'mercadopago' OR (preid IS NOT NULL AND s.gateway_subscription_id IS DISTINCT FROM preid) THEN RAISE EXCEPTION 'subscription_mismatch'; END IF;
    -- Serialize invoices generated by the existing MAX+1 numbering trigger.
    PERFORM pg_advisory_xact_lock(hashtextextended('mp-master-invoice-numbering',0));
    IF ext IS NOT NULL THEN
      SELECT * INTO i FROM public.invoices WHERE invoice_id=ext FOR UPDATE;
    ELSE
      SELECT count(*) INTO n FROM public.invoices WHERE subscription_id=s.id AND (mp_payment_id=pid OR (mp_payment_id IS NULL AND status IN ('pending','overdue') AND round(amount,2)=amount_paid));
      IF n<>1 THEN RAISE EXCEPTION 'invoice_not_unique'; END IF;
      SELECT * INTO i FROM public.invoices WHERE subscription_id=s.id AND (mp_payment_id=pid OR (mp_payment_id IS NULL AND status IN ('pending','overdue') AND round(amount,2)=amount_paid)) FOR UPDATE;
    END IF;
    -- A recurring preapproval retains its first invoice reference. It identifies
    -- the subscription but must never overwrite a previously settled invoice.
    IF i.id IS NOT NULL AND i.mp_payment_id IS NOT NULL AND i.mp_payment_id<>pid THEN
      provenance := i;
      IF preid IS NULL OR provenance.subscription_id IS DISTINCT FROM s.id OR provenance.subscriber_id IS DISTINCT FROM s.user_id
        OR provenance.status<>'paid' OR next_payment_date IS NULL THEN RAISE EXCEPTION 'invoice_mismatch'; END IF;
      SELECT count(*) INTO n FROM public.invoices WHERE subscription_id=s.id AND (mp_payment_id=pid OR (mp_payment_id IS NULL AND status IN ('pending','overdue') AND round(amount,2)=amount_paid));
      IF n>1 THEN RAISE EXCEPTION 'invoice_not_unique'; END IF;
      SELECT * INTO i FROM public.invoices WHERE subscription_id=s.id AND (mp_payment_id=pid OR (mp_payment_id IS NULL AND status IN ('pending','overdue') AND round(amount,2)=amount_paid)) FOR UPDATE;
      IF i.id IS NULL THEN
        IF gst<>'approved' OR next_payment_date<=approved_at OR round(provenance.amount,2)<>amount_paid THEN RAISE EXCEPTION 'renewal_terms_mismatch'; END IF;
        INSERT INTO public.invoices(subscriber_id,subscription_id,amount,status,due_date,reference_period_start,reference_period_end,plan,contract_acceptance_id,brand_account_id)
        VALUES(s.user_id,s.id,amount_paid,'pending',approved_at,approved_at::date,next_payment_date::date,provenance.plan,provenance.contract_acceptance_id,provenance.brand_account_id) RETURNING * INTO i;
      END IF;
    END IF;
    IF i.id IS NULL OR i.subscription_id IS DISTINCT FROM s.id OR i.subscriber_id IS DISTINCT FROM s.user_id OR round(i.amount,2)<>amount_paid
      OR (i.mp_payment_id IS NOT NULL AND i.mp_payment_id<>pid) THEN RAISE EXCEPTION 'invoice_mismatch'; END IF;
    -- A regularization invoice binds the same contracted subscription, plan, cycle and server-frozen amount.
    SELECT * INTO g FROM public.master_subscription_regularizations WHERE invoice_id=i.id FOR UPDATE;
    IF g.id IS NOT NULL AND (g.subscription_id IS DISTINCT FROM s.id OR g.user_id IS DISTINCT FROM s.user_id OR round(g.amount,2)<>amount_paid
      OR (g.gateway_payment_id IS NOT NULL AND g.gateway_payment_id<>pid) OR i.plan IS DISTINCT FROM g.plan_id) THEN RAISE EXCEPTION 'regularization_mismatch'; END IF;
    IF s.plan_id='marca' OR s.pending_plan_id='marca' OR g.plan_id='marca' THEN
      IF s.contract_acceptance_id IS NULL OR s.brand_account_id IS NULL OR i.contract_acceptance_id IS DISTINCT FROM s.contract_acceptance_id OR i.brand_account_id IS DISTINCT FROM s.brand_account_id THEN RAISE EXCEPTION 'marca_terms_mismatch'; END IF;
    END IF;
    IF p.id IS NULL THEN
      SELECT count(*) INTO n FROM public.master_subscription_payments WHERE subscription_id=s.id AND gateway='mercadopago' AND gateway_payment_id IS NULL AND status IN ('pending','in_process','processing') AND round(amount,2)=amount_paid;
      IF n>1 THEN RAISE EXCEPTION 'open_payment_not_unique'; END IF;
      SELECT * INTO p FROM public.master_subscription_payments WHERE subscription_id=s.id AND gateway='mercadopago' AND gateway_payment_id IS NULL AND status IN ('pending','in_process','processing') AND round(amount,2)=amount_paid FOR UPDATE;
    ELSE
      SELECT * INTO p FROM public.master_subscription_payments WHERE id=p.id FOR UPDATE;
    END IF;
    IF p.id IS NOT NULL AND (p.user_id IS DISTINCT FROM s.user_id OR round(p.amount,2)<>amount_paid) THEN RAISE EXCEPTION 'payment_mismatch'; END IF;
    paystatus := CASE gst WHEN 'approved' THEN 'paid' WHEN 'rejected' THEN 'failed' WHEN 'cancelled' THEN 'cancelled' WHEN 'refunded' THEN 'refunded' WHEN 'charged_back' THEN 'refunded' ELSE 'pending' END;
    oldstatus := p.status;
    oldsubstatus := s.status;
    -- Old pending/decline notifications cannot downgrade a settled payment.
    IF p.status='paid' AND paystatus IN ('pending','failed','cancelled') THEN paystatus := 'paid'; END IF;
    IF p.status='refunded' AND paystatus<>'refunded' THEN paystatus := 'refunded'; END IF;
    IF p.status IS DISTINCT FROM paystatus OR p.gateway_payment_id IS DISTINCT FROM pid OR i.status IS DISTINCT FROM (CASE paystatus WHEN 'failed' THEN 'rejected' ELSE paystatus END) OR i.mp_payment_id IS DISTINCT FROM pid OR (paystatus='paid' AND (p.paid_at IS NULL OR i.paid_at IS NULL)) THEN
      SELECT count(*) INTO n FROM public.invoices WHERE mp_payment_id=pid;
      IF n>1 THEN RAISE EXCEPTION 'invoice_payment_not_unique'; END IF;
      PERFORM set_config('shopdrive.subscription_webhook_invoice',i.id::text,true);
      IF p.id IS NULL THEN
        INSERT INTO public.master_subscription_payments(subscription_id,user_id,amount,gateway,payment_method,status,gateway_payment_id,gateway_status,paid_at,gateway_response,idempotency_key)
        VALUES(s.id,s.user_id,amount_paid,'mercadopago',CASE WHEN p_resource->>'payment_method_id'='pix' THEN 'pix' ELSE 'credit_card' END,paystatus,pid,gst,approved_at,p_resource,'mp-master:'||pid) RETURNING * INTO p;
      ELSE
        UPDATE public.master_subscription_payments SET status=paystatus,gateway_payment_id=pid,gateway_status=gst,
          paid_at=CASE WHEN paystatus='paid' THEN coalesce(paid_at,approved_at) ELSE paid_at END,
          refunded_at=CASE WHEN paystatus='refunded' THEN coalesce(refunded_at,now()) ELSE refunded_at END,
          gateway_response=p_resource,decline_code=detail,decline_type=CASE WHEN paystatus='failed' THEN CASE WHEN hard THEN 'hard' ELSE 'soft' END ELSE NULL END,
          user_message=CASE WHEN paystatus='failed' THEN msg ELSE NULL END
        WHERE id=p.id RETURNING * INTO p;
      END IF;
      PERFORM set_config('shopdrive.subscription_webhook_invoice','',true);
      -- The old trigger swallows exceptions: verify its postcondition or rollback everything.
      IF NOT EXISTS(SELECT 1 FROM public.invoices WHERE id=i.id AND mp_payment_id=pid AND status=(CASE paystatus WHEN 'failed' THEN 'rejected' ELSE paystatus END) AND (paystatus<>'paid' OR paid_at IS NOT NULL)) THEN RAISE EXCEPTION 'invoice_sync_failed'; END IF;
      IF oldstatus IS DISTINCT FROM paystatus THEN
        INSERT INTO public.master_subscription_logs(subscription_id,user_id,payment_id,event_type,event_description,metadata)
        VALUES(s.id,s.user_id,p.id,'payment_'||paystatus,'Pagamento atualizado pelo gateway',jsonb_build_object('previousStatus',oldstatus,'newStatus',paystatus,'mpPaymentId',pid));
      END IF;
      changed := true;
    END IF;
    -- Invoice plan/cycle, not the subscription's potentially newer pending intent,
    -- is the entitlement authority. Old events can settle money but not current plans.
    plan := coalesce(i.plan,s.plan_id);
    superseded := EXISTS(SELECT 1 FROM public.invoices newer WHERE newer.subscription_id=s.id AND newer.status='paid'
      AND newer.id<>i.id AND (newer.reference_period_end>i.reference_period_end OR (newer.reference_period_end=i.reference_period_end AND coalesce(newer.paid_at,'-infinity'::timestamptz)>coalesce(approved_at,i.due_date))))
      OR (s.current_period_start IS NOT NULL AND i.reference_period_end<s.current_period_start::date);
    IF paystatus='paid' AND NOT superseded AND approved_at IS NOT NULL THEN
      IF EXISTS(SELECT 1 FROM public.master_subscription_webhook_applications WHERE gateway_payment_id=pid AND payment_id<>p.id) THEN RAISE EXCEPTION 'payment_application_mismatch'; END IF;
      INSERT INTO public.master_subscription_webhook_applications(payment_id,gateway_payment_id,invoice_id,intended_plan,period_end)
        VALUES(p.id,pid,i.id,plan,i.reference_period_end) ON CONFLICT DO NOTHING;
      application_new := FOUND;
    END IF;
    IF NOT superseded AND ((paystatus='paid' AND application_new) OR (paystatus<>'paid' AND changed AND oldstatus IS DISTINCT FROM paystatus)) THEN
      substatus := CASE paystatus WHEN 'paid' THEN 'active' WHEN 'failed' THEN 'past_due' WHEN 'cancelled' THEN 'cancelled' ELSE s.status END;
      grace_days := CASE WHEN s.billing_cycle='monthly' THEN 7 ELSE 14 END;
      IF paystatus='paid' THEN
        IF s.pending_plan_id IS NOT NULL AND s.pending_plan_id IS DISTINCT FROM plan THEN RAISE EXCEPTION 'payment_plan_mismatch'; END IF;
        IF g.id IS NOT NULL THEN
          UPDATE public.master_subscription_regularizations SET status='paid',payment_id=p.id,gateway_payment_id=pid,applied_at=now(),
            closed_at=coalesce(closed_at,now()),charging_until=NULL,updated_at=now() WHERE id=g.id;
          UPDATE public.master_subscription_regularizations SET status='cancelled',closed_at=now(),charging_until=NULL,updated_at=now()
            WHERE subscription_id=s.id AND status='pending' AND id<>g.id;
        END IF;
        UPDATE public.master_subscriptions SET status='active',plan_id=plan,pending_plan_id=CASE WHEN pending_plan_id=plan THEN NULL ELSE pending_plan_id END,
          current_period_start=CASE WHEN g.id IS NOT NULL OR next_payment_date IS NOT NULL THEN approved_at ELSE current_period_start END,
          current_period_end=CASE WHEN g.id IS NOT NULL THEN approved_at+(CASE g.billing_cycle WHEN 'annual' THEN interval '1 year' ELSE interval '1 month' END)
            ELSE coalesce(next_payment_date,current_period_end) END,
          monthly_price=CASE WHEN g.id IS NOT NULL THEN g.monthly_price ELSE monthly_price END,
          total_amount=CASE WHEN g.id IS NOT NULL THEN g.amount ELSE total_amount END,
          started_at=coalesce(started_at,approved_at),decline_type=NULL,last_decline_code=NULL,last_decline_message=NULL,next_retry_at=NULL,
          requires_card_update=false,retry_count=0,grace_period_ends_at=NULL,downgrade_reason=NULL,
          previous_plan_id=CASE WHEN s.plan_id='gratis' THEN NULL ELSE previous_plan_id END,
          downgraded_at=CASE WHEN s.plan_id='gratis' THEN NULL ELSE downgraded_at END
        WHERE id=s.id;
        IF NOT EXISTS(SELECT 1 FROM public.master_subscriptions WHERE id=s.id AND status='active' AND plan_id=plan) THEN RAISE EXCEPTION 'activation_blocked'; END IF;
        IF (oldsubstatus IS DISTINCT FROM 'active' OR s.plan_id IS DISTINCT FROM plan) AND plan NOT IN ('gratis','free') THEN PERFORM public.reactivate_products_after_upgrade(s.user_id,CASE plan WHEN 'pro' THEN 150 WHEN 'premium' THEN NULL WHEN 'marca' THEN NULL ELSE 20 END); END IF;
      ELSIF g.id IS NOT NULL THEN
        -- An unpaid regularization charge never cancels, extends or re-graces the contracted subscription.
        substatus := s.status;
        IF g.status='pending' AND paystatus IN ('failed','cancelled') THEN
          UPDATE public.master_subscription_regularizations SET status=paystatus,closed_at=now(),charging_until=NULL,updated_at=now() WHERE id=g.id;
        END IF;
      ELSIF substatus IS DISTINCT FROM s.status THEN
        UPDATE public.master_subscriptions SET status=substatus,
          cancelled_at=CASE WHEN substatus='cancelled' THEN coalesce(cancelled_at,now()) ELSE cancelled_at END,
          decline_type=CASE WHEN substatus='past_due' THEN CASE WHEN hard THEN 'hard' ELSE 'soft' END ELSE decline_type END,
          last_decline_code=CASE WHEN substatus='past_due' THEN detail ELSE last_decline_code END,
          last_decline_message=CASE WHEN substatus='past_due' THEN msg ELSE last_decline_message END,
          requires_card_update=CASE WHEN substatus='past_due' THEN hard ELSE requires_card_update END,
          grace_period_ends_at=CASE WHEN substatus='past_due' THEN coalesce(grace_period_ends_at,now()+grace_days*interval '1 day') ELSE grace_period_ends_at END,
          next_retry_at=CASE WHEN substatus='past_due' AND NOT hard THEN
            coalesce(grace_period_ends_at-grace_days*interval '1 day',now()) +
            (CASE WHEN s.billing_cycle='monthly' THEN (ARRAY[0,1,3,6])[coalesce(s.retry_count,0)+2] ELSE (ARRAY[0,2,5,9,12,14])[coalesce(s.retry_count,0)+2] END)*interval '1 day'
            ELSE next_retry_at END
        WHERE id=s.id;
      END IF;
      IF substatus IS DISTINCT FROM oldsubstatus THEN
        INSERT INTO public.master_subscription_logs(subscription_id,user_id,payment_id,event_type,event_description,metadata)
        VALUES(s.id,s.user_id,p.id,'subscription_'||substatus,'Status da assinatura atualizado pelo gateway',jsonb_build_object('previousStatus',oldsubstatus,'newStatus',substatus));
      END IF;
    END IF;
  END IF;
  UPDATE public.master_subscription_webhook_receipts SET state='completed',completed_at=now() WHERE event_key=p_event_key AND claim_token=p_claim_token;
  INSERT INTO public.webhook_events(gateway,gateway_event_id,event_type,payload)
    VALUES('mercadopago_master',p_event_key,r.topic,jsonb_build_object('resource_id',r.resource_id,'changed',changed)) ON CONFLICT DO NOTHING;
  RETURN jsonb_build_object('received',true,'changed',changed);
END $function$;