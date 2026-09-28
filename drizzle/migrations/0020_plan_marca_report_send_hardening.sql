-- Hotfix Prompt 10: disparo interno, claim atômico, estados sending/delivery_unknown.
ALTER TABLE public.brand_network_report_runs DROP CONSTRAINT IF EXISTS bnrr_status_chk;
ALTER TABLE public.brand_network_report_runs ADD CONSTRAINT bnrr_status_chk
  CHECK (status IN ('generated','queued','sending','sent','failed','skipped','delivery_unknown'));
ALTER TABLE public.brand_network_report_runs ADD COLUMN IF NOT EXISTS idempotency_key text
  GENERATED ALWAYS AS ('bnr-' || id::text) STORED;

-- No máximo UMA linha viva de fila por relatório (garantia no banco).
CREATE UNIQUE INDEX IF NOT EXISTS uq_email_queue_bnr_live
  ON public.email_queue ((payload->>'brand_network_report_run_id'))
  WHERE payload ? 'brand_network_report_run_id' AND status NOT IN ('failed','blocked');

-- Token interno do scheduler: nunca exposto; só o banco (cron) lê.
CREATE TABLE IF NOT EXISTS public.internal_job_tokens (
  job_name text PRIMARY KEY,
  token text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON public.internal_job_tokens FROM PUBLIC, anon, authenticated, service_role;
ALTER TABLE public.internal_job_tokens ENABLE ROW LEVEL SECURITY;
INSERT INTO public.internal_job_tokens(job_name, token)
  VALUES ('send-brand-network-reports', encode(extensions.gen_random_bytes(32), 'hex'))
  ON CONFLICT (job_name) DO NOTHING;

CREATE OR REPLACE FUNCTION public.verify_internal_job_token(p_job text, p_token text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(length(p_token) = 64 AND EXISTS (
    SELECT 1 FROM internal_job_tokens WHERE job_name = p_job AND token = p_token), false)
$$;
REVOKE ALL ON FUNCTION public.verify_internal_job_token(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_internal_job_token(text, text) TO service_role;

-- Guard: transições permitidas + imutabilidade (substitui versão 0018).
CREATE OR REPLACE FUNCTION public._bnr_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status <> 'skipped' THEN RAISE EXCEPTION 'Relatório gerado não pode ser apagado' USING ERRCODE='42501'; END IF;
    RETURN OLD;
  END IF;
  NEW.updated_at := now();
  IF NEW.brand_account_id IS DISTINCT FROM OLD.brand_account_id OR NEW.period_start IS DISTINCT FROM OLD.period_start
     OR NEW.period_end IS DISTINCT FROM OLD.period_end THEN
    RAISE EXCEPTION 'Identidade do relatório é imutável' USING ERRCODE='42501'; END IF;
  IF OLD.status = 'skipped' THEN
    IF NEW.status NOT IN ('skipped','generated') THEN RAISE EXCEPTION 'Transição inválida' USING ERRCODE='42501'; END IF;
    RETURN NEW;
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status AND NOT (
       (OLD.status = 'generated' AND NEW.status = 'queued')
    OR (OLD.status = 'failed'    AND NEW.status = 'queued')
    OR (OLD.status = 'queued'    AND NEW.status IN ('sending','sent','failed'))
    OR (OLD.status = 'sending'   AND NEW.status IN ('queued','sent','failed','delivery_unknown'))
  ) THEN
    RAISE EXCEPTION 'Transição de status não permitida: % -> %', OLD.status, NEW.status USING ERRCODE='42501';
  END IF;
  IF NEW.timezone IS DISTINCT FROM OLD.timezone
     OR NEW.generated_at IS DISTINCT FROM OLD.generated_at OR NEW.recipient_profile_id IS DISTINCT FROM OLD.recipient_profile_id
     OR NEW.recipient_email_snapshot IS DISTINCT FROM OLD.recipient_email_snapshot
     OR NEW.brand_display_name_snapshot IS DISTINCT FROM OLD.brand_display_name_snapshot
     OR NEW.metrics_snapshot IS DISTINCT FROM OLD.metrics_snapshot OR NEW.templates_snapshot IS DISTINCT FROM OLD.templates_snapshot
     OR NEW.subject_snapshot IS DISTINCT FROM OLD.subject_snapshot THEN
    RAISE EXCEPTION 'Snapshot do relatório é imutável' USING ERRCODE='42501';
  END IF;
  RETURN NEW;
END; $$;

-- Enfileiramento atômico (fila + status na MESMA transação).
CREATE OR REPLACE FUNCTION public.enqueue_brand_network_report(p_run_id uuid, p_html text, p_max_attempts int DEFAULT 3)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_run brand_network_report_runs; v_q uuid;
BEGIN
  SELECT * INTO v_run FROM brand_network_report_runs WHERE id = p_run_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('outcome','not_found'); END IF;
  IF v_run.status = 'sent' THEN RETURN jsonb_build_object('outcome','already_sent'); END IF;
  IF v_run.status IN ('queued','sending') THEN RETURN jsonb_build_object('outcome','already_processing'); END IF;
  IF v_run.status = 'delivery_unknown' THEN RETURN jsonb_build_object('outcome','delivery_unknown'); END IF;
  IF v_run.status NOT IN ('generated','failed') THEN RETURN jsonb_build_object('outcome','not_sendable'); END IF;
  IF v_run.send_attempts >= p_max_attempts THEN RETURN jsonb_build_object('outcome','max_attempts'); END IF;
  IF p_html IS NULL OR length(p_html) = 0 THEN RAISE EXCEPTION 'HTML vazio' USING ERRCODE='22023'; END IF;
  INSERT INTO email_queue(tenant_id, template, template_name, to_email, subject, html, payload, status, scheduled_at)
  VALUES (NULL, 'brand_network_monthly_report', 'brand_network_monthly_report', v_run.recipient_email_snapshot,
          v_run.subject_snapshot, p_html,
          jsonb_build_object('brand_network_report_run_id', v_run.id, 'idempotency_key', v_run.idempotency_key),
          'pending', now())
  RETURNING id INTO v_q;
  UPDATE brand_network_report_runs SET status='queued', email_queue_id=v_q, send_attempts=send_attempts+1, failure_reason=NULL
   WHERE id = v_run.id;
  INSERT INTO audit_logs(action, entity_type, entity_id, metadata)
    VALUES ('BRAND_NETWORK_REPORT_QUEUED','brand_network_report_run', v_run.id, jsonb_build_object('attempt', v_run.send_attempts+1));
  RETURN jsonb_build_object('outcome','queued','emailQueueId', v_q);
END; $$;

-- Claim atômico pelo worker ANTES do SMTP. Só um worker obtém.
CREATE OR REPLACE FUNCTION public.claim_brand_network_report_send(p_queue_id uuid)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_run_id uuid; v_status text; v_q uuid;
BEGIN
  SELECT (payload->>'brand_network_report_run_id')::uuid INTO v_run_id FROM email_queue WHERE id = p_queue_id;
  IF v_run_id IS NULL THEN RETURN jsonb_build_object('claimed', false, 'state', 'not_report'); END IF;
  SELECT status INTO v_status FROM brand_network_report_runs WHERE id = v_run_id FOR UPDATE;
  UPDATE email_queue SET status='processing' WHERE id = p_queue_id AND status IN ('pending','retry') RETURNING id INTO v_q;
  IF v_q IS NULL THEN
    RETURN jsonb_build_object('claimed', false, 'state', CASE WHEN v_status='sent' THEN 'already_sent' ELSE 'already_processing' END);
  END IF;
  IF v_status <> 'queued' THEN
    UPDATE email_queue SET status='failed', last_error='report_not_queued' WHERE id = p_queue_id;
    RETURN jsonb_build_object('claimed', false, 'state', CASE WHEN v_status='sent' THEN 'already_sent' ELSE COALESCE(v_status,'missing') END);
  END IF;
  UPDATE brand_network_report_runs SET status='sending' WHERE id = v_run_id;
  INSERT INTO audit_logs(action, entity_type, entity_id, metadata)
    VALUES ('BRAND_NETWORK_REPORT_SENDING','brand_network_report_run', v_run_id, '{}');
  RETURN jsonb_build_object('claimed', true, 'runId', v_run_id, 'idempotencyKey', 'bnr-' || v_run_id::text);
END; $$;

-- Provedor pode ter aceitado mas a resposta se perdeu: nunca reenviar automaticamente.
CREATE OR REPLACE FUNCTION public.mark_brand_network_report_delivery_unknown(p_queue_id uuid, p_reason text)
RETURNS void LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_run uuid;
BEGIN
  UPDATE brand_network_report_runs SET status='delivery_unknown', failure_reason=left(p_reason, 200)
   WHERE email_queue_id = p_queue_id AND status='sending' RETURNING id INTO v_run;
  UPDATE email_queue SET status='failed', last_error='delivery_unknown' WHERE id = p_queue_id;
  IF v_run IS NOT NULL THEN INSERT INTO audit_logs(action, entity_type, entity_id, metadata)
    VALUES ('BRAND_NETWORK_REPORT_DELIVERY_UNKNOWN','brand_network_report_run', v_run, '{}'); END IF;
END; $$;

CREATE OR REPLACE FUNCTION public.record_brand_network_report_provider_id(p_queue_id uuid, p_provider_id text)
RETURNS void LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = public AS $$
  UPDATE brand_network_report_runs SET provider_message_id = left(p_provider_id, 200)
   WHERE email_queue_id = p_queue_id AND provider_message_id IS NULL;
$$;

-- Sincronização fila -> relatório (inclui sending e retry).
CREATE OR REPLACE FUNCTION public._bnr_on_email_queue_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_run uuid;
BEGIN
  BEGIN
    IF NEW.status = 'sent' THEN
      UPDATE brand_network_report_runs SET status='sent', sent_at=COALESCE(NEW.sent_at, now())
       WHERE email_queue_id = NEW.id AND status IN ('queued','sending') RETURNING id INTO v_run;
      IF v_run IS NOT NULL THEN INSERT INTO audit_logs(action, entity_type, entity_id, metadata)
        VALUES ('BRAND_NETWORK_REPORT_SENT','brand_network_report_run', v_run, '{}'); END IF;
    ELSIF NEW.status = 'retry' THEN
      UPDATE brand_network_report_runs SET status='queued' WHERE email_queue_id = NEW.id AND status='sending';
    ELSE
      UPDATE brand_network_report_runs SET status='failed', failure_reason='provider_' || NEW.status
       WHERE email_queue_id = NEW.id AND status IN ('queued','sending') RETURNING id INTO v_run;
      IF v_run IS NOT NULL THEN INSERT INTO audit_logs(action, entity_type, entity_id, metadata)
        VALUES ('BRAND_NETWORK_REPORT_FAILED','brand_network_report_run', v_run, jsonb_build_object('reason','provider_' || NEW.status)); END IF;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'brand network report sync skipped';
  END;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_bnr_email_queue_status ON public.email_queue;
CREATE TRIGGER trg_bnr_email_queue_status AFTER UPDATE OF status ON public.email_queue
  FOR EACH ROW WHEN (NEW.status IN ('sent','failed','blocked','retry') AND NEW.status IS DISTINCT FROM OLD.status
                     AND NEW.payload ? 'brand_network_report_run_id')
  EXECUTE FUNCTION public._bnr_on_email_queue_status();

-- Caminho antigo não atômico desativado.
REVOKE ALL ON FUNCTION public.mark_brand_network_report_queued(uuid, uuid) FROM service_role;

REVOKE ALL ON FUNCTION public.enqueue_brand_network_report(uuid, text, int) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_brand_network_report_send(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mark_brand_network_report_delivery_unknown(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_brand_network_report_provider_id(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_brand_network_report(uuid, text, int) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_brand_network_report_send(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_brand_network_report_delivery_unknown(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_brand_network_report_provider_id(uuid, text) TO service_role;
COMMENT ON FUNCTION public.mark_brand_network_report_queued(uuid, uuid) IS 'DEPRECATED: substituída por enqueue_brand_network_report (atômica).';