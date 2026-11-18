-- Read-only snapshot of live schema/functions used by scripts/test-subscription-regularization-db.py (no data).
CREATE TABLE public.profiles(id uuid PRIMARY KEY, store_name text);
CREATE TABLE public.master_plans(
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "plan_id" text NOT NULL,
  "display_name" text NOT NULL,
  "monthly_price" numeric(10,2) NOT NULL,
  "annual_discount_percent" integer DEFAULT 30,
  "features" jsonb DEFAULT '[]'::jsonb,
  "is_active" boolean DEFAULT true,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  PRIMARY KEY (id),
  UNIQUE (plan_id));
CREATE TABLE public.brand_accounts(
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "display_name" text NOT NULL,
  "owner_profile_id" uuid,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CHECK ((length(btrim(display_name)) > 0)),
  PRIMARY KEY (id));
CREATE TABLE public.brand_account_owned_stores(
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "brand_account_id" uuid NOT NULL,
  "store_profile_id" uuid NOT NULL,
  "slot" smallint NOT NULL,
  "store_role" text NOT NULL,
  "link_origin" text,
  "created_by" uuid,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (brand_account_id, slot),
  CHECK ((((slot = 1) AND (store_role = 'primary'::text)) OR ((slot = 2) AND (store_role = 'secondary'::text)))),
  UNIQUE (store_profile_id),
  CHECK (((link_origin IS NULL) OR (link_origin = ANY (ARRAY['owner_auto'::text, 'admin_link'::text, 'admin_clone'::text, 'owner_created'::text])))),
  PRIMARY KEY (id),
  CHECK ((slot = ANY (ARRAY[1, 2]))),
  CHECK ((store_role = ANY (ARRAY['primary'::text, 'secondary'::text]))));
CREATE TABLE public.plan_contract_acceptances(
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "contract_version_id" uuid NOT NULL,
  "brand_account_id" uuid NOT NULL,
  "accepted_by_profile_id" uuid,
  "accepted_by_profile_id_snapshot" uuid NOT NULL,
  "plan_id_snapshot" text NOT NULL,
  "billing_cycle" text NOT NULL,
  "monthly_price_snapshot" numeric NOT NULL,
  "annual_discount_percent_snapshot" integer NOT NULL,
  "contract_hash_snapshot" text NOT NULL,
  "version_label_snapshot" text NOT NULL,
  "brand_display_name_snapshot" text NOT NULL,
  "acceptance_statement_snapshot" text NOT NULL,
  "commercial_terms_hash" text NOT NULL,
  "ip_address" text,
  "user_agent" text,
  "request_id" text,
  "evidence_snapshot" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "accepted_at" timestamp with time zone NOT NULL DEFAULT now(),
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CHECK ((billing_cycle = ANY (ARRAY['monthly'::text, 'annual'::text]))),
  UNIQUE (brand_account_id, contract_version_id, commercial_terms_hash),
  PRIMARY KEY (id));
CREATE TABLE public.master_subscriptions(
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL,
  "plan_id" text NOT NULL,
  "billing_cycle" text NOT NULL,
  "monthly_price" numeric(10,2) NOT NULL,
  "total_amount" numeric(10,2) NOT NULL,
  "discount_percent" numeric(5,2) DEFAULT 0,
  "status" text NOT NULL DEFAULT 'pending'::text,
  "started_at" timestamp with time zone,
  "current_period_start" timestamp with time zone,
  "current_period_end" timestamp with time zone,
  "cancelled_at" timestamp with time zone,
  "gateway" text NOT NULL,
  "gateway_subscription_id" text,
  "gateway_customer_id" text,
  "card_token" text,
  "card_last_four" text,
  "card_brand" text,
  "origin" text DEFAULT 'painel_lojista'::text,
  "recurring_consent_accepted" boolean DEFAULT false,
  "recurring_consent_accepted_at" timestamp with time zone,
  "recurring_consent_ip" text,
  "retry_count" integer DEFAULT 0,
  "last_retry_at" timestamp with time zone,
  "grace_period_ends_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  "no_charge" boolean DEFAULT false,
  "decline_type" text,
  "last_decline_code" text,
  "last_decline_message" text,
  "next_retry_at" timestamp with time zone,
  "requires_card_update" boolean DEFAULT false,
  "previous_plan_id" text,
  "downgraded_at" timestamp with time zone,
  "downgrade_reason" text,
  "payment_method" text DEFAULT 'credit_card'::text,
  "pending_plan_id" text,
  "source_profile_id" uuid,
  "source_plan_id" text,
  "contract_acceptance_id" uuid,
  "brand_account_id" uuid,
  PRIMARY KEY (id));
CREATE UNIQUE INDEX uq_master_subscriptions_marca_pending_per_user ON public.master_subscriptions USING btree (user_id) WHERE ((plan_id = 'marca'::text) AND (status = 'pending'::text));
CREATE TABLE public.master_subscription_payments(
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "subscription_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "amount" numeric(10,2) NOT NULL,
  "gateway" text NOT NULL,
  "payment_method" text NOT NULL,
  "status" text NOT NULL DEFAULT 'pending'::text,
  "gateway_payment_id" text,
  "gateway_status" text,
  "gateway_response" jsonb,
  "pix_qr_code" text,
  "pix_qr_code_base64" text,
  "pix_expires_at" timestamp with time zone,
  "boleto_url" text,
  "boleto_barcode" text,
  "boleto_digitable_line" text,
  "boleto_expires_at" timestamp with time zone,
  "paid_at" timestamp with time zone,
  "refunded_at" timestamp with time zone,
  "idempotency_key" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  "decline_code" text,
  "decline_type" text,
  "user_message" text,
  "attempt_number" integer DEFAULT 1,
  UNIQUE (idempotency_key),
  PRIMARY KEY (id));
CREATE TABLE public.invoices(
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "subscriber_id" uuid NOT NULL,
  "subscription_id" uuid,
  "amount" numeric NOT NULL,
  "due_date" timestamp with time zone NOT NULL,
  "paid_at" timestamp with time zone,
  "status" text NOT NULL DEFAULT 'pending'::text,
  "reference_period_start" date NOT NULL,
  "reference_period_end" date NOT NULL,
  "notes" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  "payment_link" text,
  "payment_method" text,
  "mp_payment_id" text,
  "plan" text,
  "invoice_id" text,
  "contract_acceptance_id" uuid,
  "brand_account_id" uuid,
  CHECK ((amount >= (0)::numeric)),
  UNIQUE (invoice_id),
  PRIMARY KEY (id),
  CHECK ((status = ANY (ARRAY['pending'::text, 'paid'::text, 'overdue'::text, 'cancelled'::text, 'rejected'::text, 'expired'::text, 'refunded'::text, 'failed'::text]))));
CREATE TABLE public.master_subscription_logs(
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "subscription_id" uuid,
  "payment_id" uuid,
  "user_id" uuid,
  "event_type" text NOT NULL,
  "event_description" text,
  "metadata" jsonb,
  "ip_address" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (id));
CREATE TABLE public.master_subscription_webhook_receipts(
  "event_key" text NOT NULL,
  "resource_id" text NOT NULL,
  "topic" text NOT NULL,
  "state" text NOT NULL DEFAULT 'processing'::text,
  "claim_token" uuid NOT NULL DEFAULT gen_random_uuid(),
  "lease_until" timestamp with time zone NOT NULL DEFAULT (now() + '00:02:00'::interval),
  "completed_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (event_key));
CREATE TABLE public.master_subscription_webhook_applications(
  "payment_id" uuid NOT NULL,
  "gateway_payment_id" text NOT NULL,
  "invoice_id" uuid NOT NULL,
  "intended_plan" text NOT NULL,
  "period_end" date NOT NULL,
  "applied_at" timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (gateway_payment_id),
  PRIMARY KEY (payment_id));
CREATE TABLE public.webhook_events(
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "gateway" text NOT NULL,
  "gateway_event_id" text NOT NULL,
  "event_type" text,
  "invoice_id" text,
  "processed_at" timestamp with time zone NOT NULL DEFAULT now(),
  "payload" jsonb,
  UNIQUE (gateway, gateway_event_id),
  PRIMARY KEY (id));
CREATE TABLE public.marca_scheduled_upgrades(
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "store_profile_id" uuid NOT NULL,
  "brand_account_id" uuid NOT NULL,
  "source_subscription_id" uuid NOT NULL,
  "source_plan_id" text NOT NULL,
  "source_billing_cycle" text NOT NULL,
  "source_payment_method" text NOT NULL,
  "transition_mode" text NOT NULL DEFAULT 'manual_payment'::text,
  "target_billing_cycle" text NOT NULL,
  "contract_acceptance_id" uuid NOT NULL,
  "frozen_amount" numeric(12,2) NOT NULL,
  "currency" text NOT NULL DEFAULT 'BRL'::text,
  "effective_at" timestamp with time zone NOT NULL,
  "grace_until" timestamp with time zone NOT NULL,
  "status" text NOT NULL DEFAULT 'scheduled'::text,
  "target_subscription_id" uuid,
  "activated_at" timestamp with time zone,
  "expired_at" timestamp with time zone,
  "cancelled_at" timestamp with time zone,
  "status_reason" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (id),
  CHECK ((frozen_amount > (0)::numeric)),
  CHECK ((currency = 'BRL'::text)),
  CHECK ((target_billing_cycle = ANY (ARRAY['monthly'::text, 'annual'::text]))),
  CHECK ((transition_mode = 'manual_payment'::text)),
  CHECK ((status = ANY (ARRAY['scheduled'::text, 'awaiting_payment'::text, 'activated'::text, 'expired'::text, 'cancelled'::text]))));
CREATE UNIQUE INDEX msu_one_open_per_source ON public.marca_scheduled_upgrades USING btree (source_subscription_id) WHERE (status = ANY (ARRAY['scheduled'::text, 'awaiting_payment'::text]));
CREATE UNIQUE INDEX msu_one_open_per_store ON public.marca_scheduled_upgrades USING btree (store_profile_id) WHERE (status = ANY (ARRAY['scheduled'::text, 'awaiting_payment'::text]));
CREATE TABLE public.products(
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "price" numeric NOT NULL,
  "stock" integer NOT NULL DEFAULT 0,
  "image_url" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  "promotional_price" numeric,
  "category_id" uuid,
  "images" jsonb DEFAULT '[]'::jsonb,
  "is_featured" boolean DEFAULT false,
  "is_new" boolean DEFAULT false,
  "weight" numeric,
  "length" numeric,
  "height" numeric,
  "width" numeric,
  "variations" jsonb DEFAULT '[]'::jsonb,
  "brand_id" uuid,
  "image_adjustments" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "is_active" boolean NOT NULL DEFAULT true,
  "shipping_weight" numeric,
  "inactive_reason" text,
  "popularity_score" numeric NOT NULL DEFAULT 0,
  "sales_count" integer NOT NULL DEFAULT 0,
  "views_count" integer NOT NULL DEFAULT 0,
  "promotion_countdown_enabled" boolean NOT NULL DEFAULT false,
  "promotion_countdown_text" text DEFAULT 'Oferta termina em'::text,
  "promotion_countdown_ends_at" timestamp with time zone,
  "cloned_from_product_id" uuid,
  "was_active_before_plan_restriction" boolean NOT NULL DEFAULT false,
  "clone_job_id" uuid,
  "inventory_mode" text NOT NULL DEFAULT 'simple'::text,
  "variant_seq" integer NOT NULL DEFAULT 0,
  CHECK (((inactive_reason IS NULL) OR (inactive_reason = ANY (ARRAY['manual'::text, 'plan_limit'::text, 'pending_plan_limit'::text, 'clone_pending_plan_limit'::text])))),
  CHECK ((inventory_mode = ANY (ARRAY['simple'::text, 'variant'::text]))),
  PRIMARY KEY (id),
  CHECK ((price >= (0)::numeric)),
  CHECK ((stock >= 0)));
CREATE UNIQUE INDEX products_user_cloned_from_product_unique ON public.products USING btree (user_id, cloned_from_product_id) WHERE (cloned_from_product_id IS NOT NULL);
CREATE TABLE public.audit_logs(
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "user_id" uuid,
  "action" text NOT NULL,
  "entity_type" text NOT NULL,
  "entity_id" uuid,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "ip_address" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (id));
CREATE OR REPLACE FUNCTION public.set_invoice_id()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  next_num INTEGER;
BEGIN
  IF NEW.invoice_id IS NULL THEN
    SELECT COALESCE(
      MAX(CAST(SUBSTRING(invoice_id FROM 5) AS INTEGER)), 0
    ) + 1 INTO next_num
    FROM public.invoices
    WHERE invoice_id ~ '^inv_\d+$';
    
    NEW.invoice_id := 'inv_' || LPAD(next_num::TEXT, 5, '0');
  END IF;
  RETURN NEW;
END;
$function$;
CREATE OR REPLACE FUNCTION public.guard_marca_invoice()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
END; $function$;
CREATE OR REPLACE FUNCTION public.guard_marca_subscription()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
END; $function$;
CREATE OR REPLACE FUNCTION public.marca_activation_block_reason(p_subscription_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
END; $function$;
CREATE OR REPLACE FUNCTION public._after_marca_upgrade_target_active()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
END $function$;
CREATE OR REPLACE FUNCTION public._guard_marca_upgrade_target()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
END $function$;
CREATE OR REPLACE FUNCTION public.trg_sync_invoice_from_payment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public.sync_invoice_for_payment(NEW.id);
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'sync_invoice_for_payment failed for payment %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$function$;
CREATE OR REPLACE FUNCTION public.sync_invoice_for_payment(p_payment_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;
CREATE OR REPLACE FUNCTION public.claim_master_subscription_webhook(p_event_key text, p_resource_id text, p_topic text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
END $function$;
CREATE OR REPLACE FUNCTION public.release_master_subscription_webhook(p_event_key text, p_claim_token uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  IF coalesce(auth.role(),'') <> 'service_role' THEN RAISE EXCEPTION 'service_role_required' USING ERRCODE='42501'; END IF;
  UPDATE public.master_subscription_webhook_receipts SET state='retryable',lease_until=now()
    WHERE event_key=p_event_key AND claim_token=p_claim_token AND state='processing';
END $function$;
CREATE OR REPLACE FUNCTION public.reactivate_products_after_upgrade(p_user_id uuid, p_max_products integer)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_active_count integer;
  v_ids uuid[];
BEGIN
  IF p_user_id IS NULL THEN RETURN 0; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('plan-limit-store:' || p_user_id::text, 0));

  SELECT COUNT(*) INTO v_active_count
  FROM public.products
  WHERE user_id = p_user_id AND is_active = true;

  -- Only products the system itself deactivated for plan limit; manual/previous inactive rows stay.
  SELECT array_agg(id) INTO v_ids FROM (
    SELECT id FROM public.products
    WHERE user_id = p_user_id
      AND is_active = false
      AND was_active_before_plan_restriction = true
      AND inactive_reason IN ('plan_limit', 'pending_plan_limit', 'clone_pending_plan_limit')
    ORDER BY created_at ASC, id ASC
    LIMIT CASE WHEN p_max_products IS NULL THEN NULL ELSE GREATEST(0, p_max_products - v_active_count) END
  ) sub;

  IF v_ids IS NULL THEN RETURN 0; END IF;

  UPDATE public.products
  SET is_active = true,
      inactive_reason = NULL,
      was_active_before_plan_restriction = false,
      updated_at = now()
  WHERE id = ANY(v_ids);

  INSERT INTO public.audit_logs(user_id, action, entity_type, entity_id, metadata)
  VALUES (NULL, 'PLAN_LIMIT_PRODUCTS_REACTIVATED', 'profile', p_user_id,
    jsonb_build_object('store_id', p_user_id, 'max_products', p_max_products,
      'count', cardinality(v_ids), 'product_ids', to_jsonb(v_ids)));

  RETURN cardinality(v_ids);
END;
$function$;
CREATE OR REPLACE FUNCTION public.trg_propagate_brand_plan()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status AND NEW.plan_id IS NOT DISTINCT FROM OLD.plan_id THEN
    RETURN NEW;
  END IF;
  IF EXISTS (SELECT 1 FROM public.brand_accounts WHERE owner_profile_id = NEW.user_id) THEN
    PERFORM public.propagate_brand_plan_to_secondaries(NEW.user_id);
  END IF;
  RETURN NEW;
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
END $function$;
CREATE OR REPLACE FUNCTION public.get_my_marca_offer()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
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
CREATE OR REPLACE FUNCTION public.update_master_subscription_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;
CREATE OR REPLACE FUNCTION public.handle_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;
CREATE OR REPLACE FUNCTION public.guard_secondary_store_subscription()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF lower(coalesce(NEW.plan_id,'')) NOT IN ('gratis','free')
     AND NEW.status IN ('active','past_due','pending')
     AND EXISTS (SELECT 1 FROM public.brand_account_owned_stores WHERE store_profile_id = NEW.user_id AND store_role = 'secondary') THEN
    IF TG_OP = 'UPDATE'
       AND OLD.status IN ('active','past_due')
       AND NEW.status = OLD.status
       AND lower(coalesce(NEW.plan_id,'')) = lower(coalesce(OLD.plan_id,''))
       AND NEW.current_period_end IS NOT DISTINCT FROM OLD.current_period_end THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Esta loja está vinculada a uma empresa do Plano MARCA e utiliza a assinatura principal da empresa.' USING ERRCODE='P0001';
  END IF;
  RETURN NEW;
END $function$;
CREATE TRIGGER trg_after_marca_upgrade_target_active AFTER UPDATE OF status ON public.master_subscriptions FOR EACH ROW EXECUTE FUNCTION _after_marca_upgrade_target_active();
CREATE TRIGGER trg_guard_marca_subscription BEFORE INSERT OR UPDATE ON public.master_subscriptions FOR EACH ROW EXECUTE FUNCTION guard_marca_subscription();
CREATE TRIGGER trg_guard_marca_upgrade_target BEFORE UPDATE OF status ON public.master_subscriptions FOR EACH ROW EXECUTE FUNCTION _guard_marca_upgrade_target();
CREATE TRIGGER trg_guard_secondary_store_subscription BEFORE INSERT ON public.master_subscriptions FOR EACH ROW EXECUTE FUNCTION guard_secondary_store_subscription();
CREATE TRIGGER trg_propagate_brand_plan AFTER INSERT OR UPDATE OF status, plan_id ON public.master_subscriptions FOR EACH ROW EXECUTE FUNCTION trg_propagate_brand_plan();
CREATE TRIGGER update_master_subscriptions_updated_at BEFORE UPDATE ON public.master_subscriptions FOR EACH ROW EXECUTE FUNCTION update_master_subscription_updated_at();
CREATE TRIGGER sync_invoice_after_payment_change AFTER INSERT OR UPDATE OF status, paid_at, gateway_payment_id, amount ON public.master_subscription_payments FOR EACH ROW EXECUTE FUNCTION trg_sync_invoice_from_payment();
CREATE TRIGGER update_master_subscription_payments_updated_at BEFORE UPDATE ON public.master_subscription_payments FOR EACH ROW EXECUTE FUNCTION update_master_subscription_updated_at();
CREATE TRIGGER set_invoice_id_trigger BEFORE INSERT ON public.invoices FOR EACH ROW EXECUTE FUNCTION set_invoice_id();
CREATE TRIGGER trg_guard_marca_invoice BEFORE INSERT OR UPDATE OF contract_acceptance_id, brand_account_id, plan, subscription_id ON public.invoices FOR EACH ROW EXECUTE FUNCTION guard_marca_invoice();
CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
