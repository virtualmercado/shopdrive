ALTER TABLE public.email_queue
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'transactional',
  ADD COLUMN IF NOT EXISTS priority integer NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS idempotency_key text,
  ADD COLUMN IF NOT EXISTS locked_at timestamptz,
  ADD COLUMN IF NOT EXISTS locked_by text,
  ADD COLUMN IF NOT EXISTS send_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS provider_message_id text;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='email_queue_category_check') THEN
    ALTER TABLE public.email_queue ADD CONSTRAINT email_queue_category_check CHECK (category IN ('transactional','marketing'));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_email_queue_idempotency_key ON public.email_queue (idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_email_queue_claim ON public.email_queue (priority DESC, created_at) WHERE status IN ('pending','retry');
CREATE INDEX IF NOT EXISTS idx_email_queue_processing_lock ON public.email_queue (locked_at) WHERE status = 'processing';

COMMENT ON COLUMN public.email_queue.send_started_at IS 'Set by worker right before SMTP; distinguishes never-sent from delivery-unknown on expired locks.';

ALTER TABLE public.email_logs
  ADD COLUMN IF NOT EXISTS queue_id uuid,
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS attempt integer,
  ADD COLUMN IF NOT EXISTS provider_message_id text;

CREATE OR REPLACE FUNCTION public.claim_email_queue_batch(p_limit integer DEFAULT 50, p_worker text DEFAULT NULL, p_lock_timeout_minutes integer DEFAULT 15)
RETURNS SETOF public.email_queue
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_limit int := LEAST(GREATEST(COALESCE(p_limit,50),1),50);
BEGIN
  -- Expired locks, never started SMTP: safe to retry (counts as an attempt; caps at 3)
  UPDATE email_queue SET
    status = CASE WHEN attempts + 1 >= 3 THEN 'failed' ELSE 'retry' END,
    attempts = attempts + 1, last_error = 'lock_expired_before_send',
    locked_at = NULL, locked_by = NULL, scheduled_at = now()
  WHERE status = 'processing' AND locked_at IS NOT NULL
    AND locked_at < now() - make_interval(mins => p_lock_timeout_minutes)
    AND send_started_at IS NULL;
  -- Expired locks after SMTP started: delivery unknown, never auto-resend
  UPDATE email_queue SET status = 'failed', last_error = 'delivery_unknown: worker interrupted after SMTP start',
    locked_at = NULL
  WHERE status = 'processing' AND locked_at IS NOT NULL
    AND locked_at < now() - make_interval(mins => p_lock_timeout_minutes)
    AND send_started_at IS NOT NULL;

  RETURN QUERY
  WITH picked AS (
    SELECT q.id FROM email_queue q
    WHERE q.status IN ('pending','retry')
      AND (q.scheduled_at IS NULL OR q.scheduled_at <= now())
      AND q.attempts < 3
      AND NOT (COALESCE(q.payload,'{}'::jsonb) ? 'brand_network_report_run_id')
    ORDER BY q.priority DESC, q.created_at ASC
    LIMIT v_limit
    FOR UPDATE SKIP LOCKED
  )
  UPDATE email_queue q SET status = 'processing', locked_at = now(), locked_by = p_worker, send_started_at = NULL
  FROM picked WHERE q.id = picked.id
  RETURNING q.*;

  -- MARCA report rows keep their own atomic claim (claim_brand_network_report_send); returned unclaimed.
  RETURN QUERY
  SELECT q.* FROM email_queue q
  WHERE q.status IN ('pending','retry')
    AND (q.scheduled_at IS NULL OR q.scheduled_at <= now())
    AND (COALESCE(q.payload,'{}'::jsonb) ? 'brand_network_report_run_id')
  ORDER BY q.priority DESC, q.created_at ASC
  LIMIT v_limit;
END $$;

REVOKE ALL ON FUNCTION public.claim_email_queue_batch(integer, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_email_queue_batch(integer, text, integer) TO service_role;