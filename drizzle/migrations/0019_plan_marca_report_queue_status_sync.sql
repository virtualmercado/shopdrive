CREATE OR REPLACE FUNCTION public._bnr_on_email_queue_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  BEGIN
    IF NEW.status = 'sent' THEN
      UPDATE brand_network_report_runs SET status = 'sent', sent_at = COALESCE(NEW.sent_at, now())
       WHERE email_queue_id = NEW.id AND status = 'queued';
      IF FOUND THEN INSERT INTO audit_logs(action, entity_type, entity_id, metadata)
        SELECT 'BRAND_NETWORK_REPORT_SENT','brand_network_report_run', id, '{}' FROM brand_network_report_runs WHERE email_queue_id = NEW.id; END IF;
    ELSE
      UPDATE brand_network_report_runs SET status = 'failed', failure_reason = 'provider_' || NEW.status
       WHERE email_queue_id = NEW.id AND status = 'queued';
      IF FOUND THEN INSERT INTO audit_logs(action, entity_type, entity_id, metadata)
        SELECT 'BRAND_NETWORK_REPORT_FAILED','brand_network_report_run', id, jsonb_build_object('reason','provider_' || NEW.status)
          FROM brand_network_report_runs WHERE email_queue_id = NEW.id; END IF;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'brand network report sync skipped';
  END;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public._bnr_on_email_queue_status() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_bnr_email_queue_status ON public.email_queue;
CREATE TRIGGER trg_bnr_email_queue_status AFTER UPDATE OF status ON public.email_queue
  FOR EACH ROW WHEN (NEW.status IN ('sent','failed','blocked') AND NEW.status IS DISTINCT FROM OLD.status
                     AND NEW.payload ? 'brand_network_report_run_id')
  EXECUTE FUNCTION public._bnr_on_email_queue_status();