-- Drop obsolete FK pointing to legacy subscriptions table
ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_subscription_id_fkey;

ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_status_check;
ALTER TABLE public.invoices
  ADD CONSTRAINT invoices_status_check
  CHECK (status = ANY (ARRAY[
    'pending','paid','overdue','cancelled','rejected','expired','refunded','failed'
  ]));

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

CREATE OR REPLACE FUNCTION public.trg_sync_invoice_from_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM public.sync_invoice_for_payment(NEW.id);
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'sync_invoice_for_payment failed for payment %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_invoice_after_payment_change ON public.master_subscription_payments;
CREATE TRIGGER sync_invoice_after_payment_change
AFTER INSERT OR UPDATE OF status, paid_at, gateway_payment_id, amount
ON public.master_subscription_payments
FOR EACH ROW
EXECUTE FUNCTION public.trg_sync_invoice_from_payment();

-- Backfill
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.master_subscription_payments ORDER BY created_at LOOP
    PERFORM public.sync_invoice_for_payment(r.id);
  END LOOP;
END $$;