CREATE OR REPLACE FUNCTION public.sync_invoice_for_payment(p_payment_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_payment RECORD;
  v_subscription RECORD;
  v_invoice_id uuid;
  v_invoice_status text;
  v_period_start date;
  v_period_end date;
  v_due_date timestamptz;
  v_target uuid := nullif(current_setting('shopdrive.subscription_webhook_invoice',true),'')::uuid;
BEGIN
  SELECT * INTO v_payment FROM public.master_subscription_payments WHERE id = p_payment_id;
  IF NOT FOUND THEN RETURN NULL; END IF;

  SELECT * INTO v_subscription FROM public.master_subscriptions WHERE id = v_payment.subscription_id;

  v_invoice_status := CASE v_payment.status
    WHEN 'paid'      THEN 'paid'
    WHEN 'failed'    THEN 'rejected'
    WHEN 'cancelled' THEN 'cancelled'
    WHEN 'refunded'  THEN 'refunded'
    WHEN 'expired'   THEN 'expired'
    ELSE 'pending'
  END;

  -- Only the service-only webhook RPC sets this transaction-local target.
  IF v_target IS NOT NULL AND coalesce(auth.role(),'')='service_role' THEN
    IF NOT EXISTS(SELECT 1 FROM public.invoices WHERE id=v_target AND subscription_id=v_payment.subscription_id
      AND subscriber_id=v_payment.user_id AND round(amount,2)=round(v_payment.amount,2)
      AND (mp_payment_id IS NULL OR mp_payment_id=v_payment.gateway_payment_id)) THEN
      RAISE EXCEPTION 'webhook_invoice_target_mismatch';
    END IF;
    UPDATE public.invoices SET status=v_invoice_status,
      paid_at=CASE WHEN v_invoice_status='paid' THEN coalesce(paid_at,v_payment.paid_at) ELSE paid_at END,
      mp_payment_id=v_payment.gateway_payment_id,
      payment_method=coalesce(v_payment.payment_method,payment_method),updated_at=now()
    WHERE id=v_target AND (status IS DISTINCT FROM v_invoice_status OR mp_payment_id IS DISTINCT FROM v_payment.gateway_payment_id
      OR (v_invoice_status='paid' AND paid_at IS NULL));
    RETURN v_target;
  END IF;

  v_period_start := COALESCE(
    v_subscription.current_period_start::date,
    date_trunc('month', COALESCE(v_payment.paid_at, v_payment.created_at, now()))::date
  );
  v_period_end := COALESCE(
    v_subscription.current_period_end::date,
    (date_trunc('month', COALESCE(v_payment.paid_at, v_payment.created_at, now())) + INTERVAL '1 month - 1 day')::date
  );
  v_due_date := COALESCE(v_payment.pix_expires_at, v_payment.boleto_expires_at, v_payment.created_at, now());

  IF v_payment.gateway_payment_id IS NOT NULL THEN
    SELECT id INTO v_invoice_id FROM public.invoices
    WHERE mp_payment_id = v_payment.gateway_payment_id LIMIT 1;
  END IF;

  IF v_invoice_id IS NULL THEN
    SELECT id INTO v_invoice_id FROM public.invoices
    WHERE subscription_id = v_payment.subscription_id
      AND status = 'pending'
      AND (mp_payment_id IS NULL OR mp_payment_id = v_payment.gateway_payment_id)
    ORDER BY created_at DESC LIMIT 1;
  END IF;

  IF v_invoice_id IS NOT NULL THEN
    UPDATE public.invoices
    SET status         = v_invoice_status,
        paid_at        = CASE WHEN v_invoice_status = 'paid'
                              THEN COALESCE(v_payment.paid_at, paid_at, now())
                              ELSE paid_at END,
        payment_method = COALESCE(v_payment.payment_method, payment_method),
        mp_payment_id  = COALESCE(v_payment.gateway_payment_id, mp_payment_id),
        amount         = COALESCE(amount, v_payment.amount),
        plan           = COALESCE(plan, v_subscription.plan_id),
        updated_at     = now()
    WHERE id = v_invoice_id;
  ELSE
    INSERT INTO public.invoices (
      subscriber_id, subscription_id, amount, status,
      due_date, paid_at, payment_method, mp_payment_id,
      reference_period_start, reference_period_end, plan
    ) VALUES (
      v_payment.user_id, v_payment.subscription_id, v_payment.amount, v_invoice_status,
      v_due_date,
      CASE WHEN v_invoice_status = 'paid' THEN COALESCE(v_payment.paid_at, now()) ELSE NULL END,
      v_payment.payment_method, v_payment.gateway_payment_id,
      v_period_start, v_period_end, v_subscription.plan_id
    )
    RETURNING id INTO v_invoice_id;
  END IF;

  RETURN v_invoice_id;
END;
$$;

-- No backfill or financial DML: new claims and RPC definitions only.
CREATE TABLE public.master_subscription_webhook_receipts (
  event_key text PRIMARY KEY,
  resource_id text NOT NULL,
  topic text NOT NULL,
  state text NOT NULL DEFAULT 'processing',
  claim_token uuid NOT NULL DEFAULT gen_random_uuid(),
  lease_until timestamptz NOT NULL DEFAULT now() + interval '2 minutes',
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON public.master_subscription_webhook_receipts FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.master_subscription_webhook_receipts TO service_role;
ALTER TABLE public.master_subscription_webhook_receipts ENABLE ROW LEVEL SECURITY;
CREATE POLICY service_only ON public.master_subscription_webhook_receipts FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TABLE public.master_subscription_webhook_applications (
  payment_id uuid PRIMARY KEY REFERENCES public.master_subscription_payments(id),
  gateway_payment_id text NOT NULL UNIQUE,
  invoice_id uuid NOT NULL REFERENCES public.invoices(id),
  intended_plan text NOT NULL,
  period_end date NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON public.master_subscription_webhook_applications FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.master_subscription_webhook_applications TO service_role;
ALTER TABLE public.master_subscription_webhook_applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY service_only ON public.master_subscription_webhook_applications FOR ALL TO service_role USING(true) WITH CHECK(true);

CREATE OR REPLACE FUNCTION public.claim_master_subscription_webhook(p_event_key text, p_resource_id text, p_topic text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE r public.master_subscription_webhook_receipts;
BEGIN
  IF coalesce(auth.role(),'') <> 'service_role' THEN RAISE EXCEPTION 'service_role_required' USING ERRCODE='42501'; END IF;
  IF length(p_event_key) NOT BETWEEN 1 AND 600 OR p_resource_id !~ '^[A-Za-z0-9_-]{1,200}$'
     OR p_topic NOT IN ('payment','subscription_authorized_payment','authorized_payment','subscription_preapproval','preapproval','subscription_preapproval_plan','test') THEN
    RAISE EXCEPTION 'invalid_event';
  END IF;
  INSERT INTO public.master_subscription_webhook_receipts(event_key,resource_id,topic)
  VALUES(p_event_key,p_resource_id,p_topic) ON CONFLICT DO NOTHING RETURNING * INTO r;
  IF FOUND THEN RETURN jsonb_build_object('claimed',true,'token',r.claim_token); END IF;
  SELECT * INTO r FROM public.master_subscription_webhook_receipts WHERE event_key=p_event_key FOR UPDATE;
  IF r.resource_id <> p_resource_id OR r.topic <> p_topic THEN RAISE EXCEPTION 'event_identity_mismatch'; END IF;
  IF r.state='completed' THEN RETURN jsonb_build_object('claimed',false,'duplicate',true); END IF;
  IF r.lease_until > now() AND r.state='processing' THEN RETURN jsonb_build_object('claimed',false,'busy',true); END IF;
  UPDATE public.master_subscription_webhook_receipts SET state='processing',claim_token=gen_random_uuid(),lease_until=now()+interval '2 minutes'
    WHERE event_key=p_event_key RETURNING * INTO r;
  RETURN jsonb_build_object('claimed',true,'token',r.claim_token);
END $$;

CREATE OR REPLACE FUNCTION public.release_master_subscription_webhook(p_event_key text,p_claim_token uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF coalesce(auth.role(),'') <> 'service_role' THEN RAISE EXCEPTION 'service_role_required' USING ERRCODE='42501'; END IF;
  UPDATE public.master_subscription_webhook_receipts SET state='retryable',lease_until=now()
    WHERE event_key=p_event_key AND claim_token=p_claim_token AND state='processing';
END $$;

CREATE OR REPLACE FUNCTION public.apply_master_subscription_webhook(p_event_key text,p_claim_token uuid,p_kind text,p_resource jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  r public.master_subscription_webhook_receipts;
  s public.master_subscriptions;
  p public.master_subscription_payments;
  i public.invoices;
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
    IF s.plan_id='marca' OR s.pending_plan_id='marca' THEN
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
        UPDATE public.master_subscriptions SET status='active',plan_id=plan,pending_plan_id=CASE WHEN pending_plan_id=plan THEN NULL ELSE pending_plan_id END,
          current_period_start=CASE WHEN next_payment_date IS NOT NULL THEN approved_at ELSE current_period_start END,
          current_period_end=coalesce(next_payment_date,current_period_end),
          started_at=coalesce(started_at,approved_at),decline_type=NULL,last_decline_code=NULL,last_decline_message=NULL,next_retry_at=NULL,
          requires_card_update=false,retry_count=0,grace_period_ends_at=NULL,downgrade_reason=NULL,
          previous_plan_id=CASE WHEN s.plan_id='gratis' THEN NULL ELSE previous_plan_id END,
          downgraded_at=CASE WHEN s.plan_id='gratis' THEN NULL ELSE downgraded_at END
        WHERE id=s.id;
        IF NOT EXISTS(SELECT 1 FROM public.master_subscriptions WHERE id=s.id AND status='active' AND plan_id=plan) THEN RAISE EXCEPTION 'activation_blocked'; END IF;
        IF (oldsubstatus IS DISTINCT FROM 'active' OR s.plan_id IS DISTINCT FROM plan) AND plan NOT IN ('gratis','free') THEN PERFORM public.reactivate_products_after_upgrade(s.user_id,CASE plan WHEN 'pro' THEN 150 WHEN 'premium' THEN NULL WHEN 'marca' THEN NULL ELSE 20 END); END IF;
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
END $$;

REVOKE ALL ON FUNCTION public.claim_master_subscription_webhook(text,text,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.release_master_subscription_webhook(text,uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.apply_master_subscription_webhook(text,uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_master_subscription_webhook(text,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_master_subscription_webhook(text,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.apply_master_subscription_webhook(text,uuid,text,jsonb) TO service_role;
