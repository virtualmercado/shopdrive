-- Prompt 10: relatório mensal canônico da rede MARCA (brand_account based).
CREATE TABLE IF NOT EXISTS public.brand_network_report_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_account_id uuid NOT NULL REFERENCES public.brand_accounts(id) ON DELETE RESTRICT,
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  timezone text NOT NULL DEFAULT 'UTC',
  generated_at timestamptz,
  recipient_profile_id uuid,
  recipient_email_snapshot text,
  brand_display_name_snapshot text,
  metrics_snapshot jsonb,
  templates_snapshot jsonb,
  subject_snapshot text,
  status text NOT NULL,
  skip_reason text,
  email_queue_id uuid,
  send_attempts int NOT NULL DEFAULT 0,
  provider_message_id text,
  sent_at timestamptz,
  failure_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bnrr_status_chk CHECK (status IN ('generated','queued','sent','failed','skipped')),
  CONSTRAINT bnrr_period_chk CHECK (period_end > period_start),
  CONSTRAINT bnrr_unique_period UNIQUE (brand_account_id, period_start, period_end)
);
CREATE INDEX IF NOT EXISTS idx_bnrr_status ON public.brand_network_report_runs(status) WHERE status IN ('queued','failed');

GRANT ALL ON public.brand_network_report_runs TO service_role;
GRANT SELECT ON public.brand_network_report_runs TO authenticated;
ALTER TABLE public.brand_network_report_runs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins read brand network report runs" ON public.brand_network_report_runs;
CREATE POLICY "Admins read brand network report runs" ON public.brand_network_report_runs
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Imutabilidade lógica do snapshot.
CREATE OR REPLACE FUNCTION public._bnr_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status <> 'skipped' THEN RAISE EXCEPTION 'Relatório gerado não pode ser apagado' USING ERRCODE='42501'; END IF;
    RETURN OLD;
  END IF;
  NEW.updated_at := now();
  IF OLD.status = 'skipped' THEN RETURN NEW; END IF;
  IF OLD.status = 'sent' AND NEW.status <> 'sent' THEN
    RAISE EXCEPTION 'Relatório enviado é definitivo' USING ERRCODE='42501'; END IF;
  IF NEW.status = 'skipped' THEN RAISE EXCEPTION 'Relatório gerado não pode virar skipped' USING ERRCODE='42501'; END IF;
  IF NEW.brand_account_id IS DISTINCT FROM OLD.brand_account_id OR NEW.period_start IS DISTINCT FROM OLD.period_start
     OR NEW.period_end IS DISTINCT FROM OLD.period_end OR NEW.timezone IS DISTINCT FROM OLD.timezone
     OR NEW.generated_at IS DISTINCT FROM OLD.generated_at OR NEW.recipient_profile_id IS DISTINCT FROM OLD.recipient_profile_id
     OR NEW.recipient_email_snapshot IS DISTINCT FROM OLD.recipient_email_snapshot
     OR NEW.brand_display_name_snapshot IS DISTINCT FROM OLD.brand_display_name_snapshot
     OR NEW.metrics_snapshot IS DISTINCT FROM OLD.metrics_snapshot OR NEW.templates_snapshot IS DISTINCT FROM OLD.templates_snapshot
     OR NEW.subject_snapshot IS DISTINCT FROM OLD.subject_snapshot THEN
    RAISE EXCEPTION 'Snapshot do relatório é imutável' USING ERRCODE='42501';
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_bnr_guard ON public.brand_network_report_runs;
CREATE TRIGGER trg_bnr_guard BEFORE UPDATE OR DELETE ON public.brand_network_report_runs
  FOR EACH ROW EXECUTE FUNCTION public._bnr_guard();

-- Elegibilidade (interna).
CREATE OR REPLACE FUNCTION public._bnr_eligibility(p_brand_account_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_owner uuid; v_name text; v_plan jsonb; v_email text; v_tpl uuid[];
BEGIN
  SELECT owner_profile_id, display_name INTO v_owner, v_name FROM brand_accounts WHERE id = p_brand_account_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('eligible', false, 'reason', 'account_not_found'); END IF;
  IF v_owner IS NULL THEN RETURN jsonb_build_object('eligible', false, 'reason', 'no_owner'); END IF;
  IF NOT EXISTS (SELECT 1 FROM brand_account_owned_stores WHERE brand_account_id = p_brand_account_id
                 AND store_profile_id = v_owner AND store_role = 'primary') THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'no_primary_store'); END IF;
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = v_owner AND COALESCE(account_status,'active') = 'active') THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'owner_inactive'); END IF;
  v_plan := get_effective_store_plan(v_owner);
  IF v_plan->>'basePlan' IS DISTINCT FROM 'marca' OR v_plan->>'planSource' IS DISTINCT FROM 'direct' THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'owner_not_marca_direct'); END IF;
  v_tpl := ARRAY(SELECT id FROM brand_templates WHERE brand_account_id = p_brand_account_id ORDER BY id);
  IF cardinality(v_tpl) = 0 THEN RETURN jsonb_build_object('eligible', false, 'reason', 'no_templates'); END IF;
  SELECT lower(trim(email)) INTO v_email FROM auth.users WHERE id = v_owner;
  IF v_email IS NULL OR v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'no_valid_email'); END IF;
  RETURN jsonb_build_object('eligible', true, 'owner', v_owner, 'email', v_email, 'name', v_name, 'templates', to_jsonb(v_tpl));
END; $$;

-- Geração idempotente do snapshot mensal (service_role).
CREATE OR REPLACE FUNCTION public.generate_brand_network_monthly_report(p_brand_account_id uuid, p_period_start timestamptz)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_end timestamptz; v_run brand_network_report_runs; v_el jsonb; v_m jsonb; v_now timestamptz := now();
        v_months text[] := ARRAY['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
        v_label text; v_subject text; v_tpls jsonb;
BEGIN
  IF p_brand_account_id IS NULL OR p_period_start IS NULL THEN RAISE EXCEPTION 'Parâmetros obrigatórios' USING ERRCODE='22023'; END IF;
  IF date_trunc('month', p_period_start, 'UTC') <> p_period_start THEN
    RAISE EXCEPTION 'period_start deve ser o início de um mês em UTC' USING ERRCODE='22023'; END IF;
  v_end := ((p_period_start AT TIME ZONE 'UTC') + interval '1 month') AT TIME ZONE 'UTC';
  IF v_end > v_now THEN RAISE EXCEPTION 'Mês ainda não fechado' USING ERRCODE='22023'; END IF;
  IF NOT is_plan_marca_enabled() THEN RETURN jsonb_build_object('outcome', 'flag_off'); END IF;

  PERFORM pg_advisory_xact_lock(hashtext('bnr:' || p_brand_account_id::text || ':' || p_period_start::text));
  SELECT * INTO v_run FROM brand_network_report_runs
   WHERE brand_account_id = p_brand_account_id AND period_start = p_period_start AND period_end = v_end;
  IF FOUND AND v_run.status <> 'skipped' THEN
    RETURN jsonb_build_object('outcome', 'existing', 'runId', v_run.id, 'status', v_run.status);
  END IF;

  v_el := _bnr_eligibility(p_brand_account_id);
  IF (v_el->>'eligible')::boolean IS NOT TRUE THEN
    IF v_el->>'reason' = 'account_not_found' THEN RETURN jsonb_build_object('outcome', 'skipped', 'reason', 'account_not_found'); END IF;
    INSERT INTO brand_network_report_runs(brand_account_id, period_start, period_end, status, skip_reason)
      VALUES (p_brand_account_id, p_period_start, v_end, 'skipped', v_el->>'reason')
    ON CONFLICT (brand_account_id, period_start, period_end) DO UPDATE SET skip_reason = EXCLUDED.skip_reason
    RETURNING * INTO v_run;
    INSERT INTO audit_logs(action, entity_type, entity_id, metadata)
      VALUES ('BRAND_NETWORK_REPORT_SKIPPED', 'brand_network_report_run', v_run.id, jsonb_build_object('reason', v_el->>'reason'));
    RETURN jsonb_build_object('outcome', 'skipped', 'runId', v_run.id, 'reason', v_el->>'reason');
  END IF;

  -- Motor canônico do Prompt 08 (fonte única).
  v_m := compute_brand_network_metrics(ARRAY(SELECT jsonb_array_elements_text(v_el->'templates')::uuid), p_period_start, v_end, 'month');

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'templateId', t->'templateId', 'name', t->'name', 'status', t->'status', 'productsCount', t->'productsCount',
      'linkAvailable', t->'linkAvailable', 'templateSlug', t->'templateSlug',
      'validClicks', t->'validClicks', 'validActivations', t->'validActivations', 'conversionPercent', t->'conversionPercent',
      'totalValidActivations', t->'totalValidActivations', 'operationalTotal', t->'operationalTotal')), '[]')
    INTO v_tpls FROM jsonb_array_elements(v_m->'templates') t;

  v_label := v_months[extract(month FROM p_period_start AT TIME ZONE 'UTC')::int] || ' de ' || extract(year FROM p_period_start AT TIME ZONE 'UTC')::int;
  v_subject := 'Relatório mensal da sua rede — ' || v_label || ' — ' || COALESCE(v_el->>'name', 'ShopDrive');

  INSERT INTO brand_network_report_runs(brand_account_id, period_start, period_end, timezone, generated_at,
      recipient_profile_id, recipient_email_snapshot, brand_display_name_snapshot, metrics_snapshot, templates_snapshot,
      subject_snapshot, status, skip_reason)
  VALUES (p_brand_account_id, p_period_start, v_end, 'UTC', v_now, (v_el->>'owner')::uuid, v_el->>'email', v_el->>'name',
      jsonb_build_object('periodStart', p_period_start, 'periodEnd', v_end, 'periodLabel', v_label, 'interval', '[from,to)', 'timezone', 'UTC',
        'validClicks', v_m->'summary'->'validClicks', 'validActivations', v_m->'summary'->'validActivations',
        'conversionPercent', v_m->'summary'->'conversionPercent', 'totalValidActivations', v_m->'summary'->'totalValidActivations',
        'operationalTotal', v_m->'summary'->'operationalTotal', 'generatedAt', v_now, 'engine', 'compute_brand_network_metrics'),
      v_tpls, v_subject, 'generated', NULL)
  ON CONFLICT (brand_account_id, period_start, period_end) DO UPDATE SET
      timezone = EXCLUDED.timezone, generated_at = EXCLUDED.generated_at, recipient_profile_id = EXCLUDED.recipient_profile_id,
      recipient_email_snapshot = EXCLUDED.recipient_email_snapshot, brand_display_name_snapshot = EXCLUDED.brand_display_name_snapshot,
      metrics_snapshot = EXCLUDED.metrics_snapshot, templates_snapshot = EXCLUDED.templates_snapshot,
      subject_snapshot = EXCLUDED.subject_snapshot, status = 'generated', skip_reason = NULL
  RETURNING * INTO v_run;

  INSERT INTO audit_logs(action, entity_type, entity_id, metadata)
    VALUES ('BRAND_NETWORK_REPORT_GENERATED', 'brand_network_report_run', v_run.id,
            jsonb_build_object('periodStart', p_period_start, 'templates', jsonb_array_length(v_tpls)));
  RETURN jsonb_build_object('outcome', 'generated', 'runId', v_run.id, 'status', v_run.status);
END; $$;

-- Registro de enfileiramento (mesmo snapshot; nunca recalcula).
CREATE OR REPLACE FUNCTION public.mark_brand_network_report_queued(p_run_id uuid, p_email_queue_id uuid)
RETURNS void LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE brand_network_report_runs SET status = 'queued', email_queue_id = p_email_queue_id,
         send_attempts = send_attempts + 1, failure_reason = NULL
   WHERE id = p_run_id AND status IN ('generated','failed');
  IF NOT FOUND THEN RAISE EXCEPTION 'Relatório não pode ser enfileirado' USING ERRCODE='22023'; END IF;
END; $$;

-- Reconciliação com o provedor existente (email_queue → process-email-queue).
CREATE OR REPLACE FUNCTION public.sync_brand_network_report_status()
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; v_sent int := 0; v_failed int := 0;
BEGIN
  FOR r IN SELECT b.id, q.status qs, q.sent_at qsent FROM brand_network_report_runs b
             JOIN email_queue q ON q.id = b.email_queue_id WHERE b.status = 'queued' LOOP
    IF r.qs = 'sent' THEN
      UPDATE brand_network_report_runs SET status = 'sent', sent_at = COALESCE(r.qsent, now()) WHERE id = r.id;
      INSERT INTO audit_logs(action, entity_type, entity_id, metadata) VALUES ('BRAND_NETWORK_REPORT_SENT','brand_network_report_run', r.id, '{}');
      v_sent := v_sent + 1;
    ELSIF r.qs IN ('failed','blocked') THEN
      UPDATE brand_network_report_runs SET status = 'failed', failure_reason = 'provider_' || r.qs WHERE id = r.id;
      INSERT INTO audit_logs(action, entity_type, entity_id, metadata) VALUES ('BRAND_NETWORK_REPORT_FAILED','brand_network_report_run', r.id,
        jsonb_build_object('reason', 'provider_' || r.qs));
      v_failed := v_failed + 1;
    END IF;
  END LOOP;
  RETURN jsonb_build_object('sent', v_sent, 'failed', v_failed);
END; $$;

REVOKE ALL ON FUNCTION public._bnr_guard() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._bnr_eligibility(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.generate_brand_network_monthly_report(uuid, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mark_brand_network_report_queued(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_brand_network_report_status() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._bnr_eligibility(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.generate_brand_network_monthly_report(uuid, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_brand_network_report_queued(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.sync_brand_network_report_status() TO service_role;
COMMENT ON TABLE public.brand_network_report_runs IS 'Relatório mensal MARCA (Prompt 10): snapshot imutável por brand_account/período UTC [start,end). Separado do legado brand_report_logs.';