-- ETAPA 3 — Campanhas de E-mail (Master, admin-only). Aditiva; não altera tickets, MARCA nem Assinantes.

CREATE TABLE public.email_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  subject text NOT NULL,
  content text NOT NULL,
  cta_label text NULL,
  cta_url text NULL,
  audience_filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'draft',
  created_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  confirmed_at timestamptz NULL,
  started_at timestamptz NULL,
  completed_at timestamptz NULL,
  cancelled_at timestamptz NULL,
  total_recipients int NOT NULL DEFAULT 0,
  total_queued int NOT NULL DEFAULT 0,
  total_sent int NOT NULL DEFAULT 0,
  total_failed int NOT NULL DEFAULT 0,
  total_suppressed int NOT NULL DEFAULT 0,
  CONSTRAINT email_campaigns_status_check CHECK (status IN ('draft','ready','processing','completed','completed_with_errors','cancelled')),
  CONSTRAINT email_campaigns_name_len CHECK (char_length(btrim(name)) BETWEEN 1 AND 120),
  CONSTRAINT email_campaigns_subject_len CHECK (char_length(btrim(subject)) BETWEEN 1 AND 200),
  CONSTRAINT email_campaigns_content_len CHECK (char_length(btrim(content)) BETWEEN 1 AND 20000),
  CONSTRAINT email_campaigns_cta_pair CHECK ((cta_label IS NULL) = (cta_url IS NULL)),
  CONSTRAINT email_campaigns_cta_url_https CHECK (cta_url IS NULL OR (cta_url ~ '^https://[^[:space:]"''<>]+$' AND char_length(cta_url) <= 2000)),
  CONSTRAINT email_campaigns_cta_label_len CHECK (cta_label IS NULL OR char_length(btrim(cta_label)) BETWEEN 1 AND 60)
);
GRANT SELECT ON public.email_campaigns TO authenticated;
GRANT ALL ON public.email_campaigns TO service_role;
ALTER TABLE public.email_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Only admins read campaigns" ON public.email_campaigns
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
COMMENT ON TABLE public.email_campaigns IS 'Campanhas de marketing do Master. Escrita somente via RPCs admin (security definer).';

CREATE TABLE public.email_campaign_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.email_campaigns(id) ON DELETE CASCADE,
  store_id uuid NOT NULL,
  email text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  email_queue_id uuid NULL,
  last_error text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  queued_at timestamptz NULL,
  sent_at timestamptz NULL,
  suppressed_at timestamptz NULL,
  CONSTRAINT ecr_status_check CHECK (status IN ('pending','queued','sent','failed','suppressed','cancelled')),
  CONSTRAINT ecr_email_normalized CHECK (email = lower(btrim(email)) AND email <> '')
);
CREATE UNIQUE INDEX uq_ecr_campaign_store ON public.email_campaign_recipients (campaign_id, store_id);
CREATE UNIQUE INDEX uq_ecr_queue ON public.email_campaign_recipients (email_queue_id) WHERE email_queue_id IS NOT NULL;
CREATE INDEX idx_ecr_campaign_status ON public.email_campaign_recipients (campaign_id, status);
GRANT SELECT ON public.email_campaign_recipients TO authenticated;
GRANT ALL ON public.email_campaign_recipients TO service_role;
ALTER TABLE public.email_campaign_recipients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Only admins read campaign recipients" ON public.email_campaign_recipients
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Escapa HTML (conteúdo do admin é texto puro, nunca HTML arbitrário).
CREATE OR REPLACE FUNCTION public._ecr_escape(p text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public
AS $$ SELECT replace(replace(replace(replace(coalesce(p,''),'&','&amp;'),'<','&lt;'),'>','&gt;'),'"','&quot;') $$;

-- HTML da campanha (template base ShopDrive de marketing). Fonte única: prévia e envio.
CREATE OR REPLACE FUNCTION public.render_email_campaign_html(
  p_subject text, p_content text, p_cta_label text, p_cta_url text, p_unsubscribe_url text
) RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_body text := '';
  v_para text;
  v_cta text := '';
  v_footer text;
BEGIN
  IF p_unsubscribe_url IS NULL OR p_unsubscribe_url !~ '^https://[^?]+\?token=[A-Za-z0-9_-]{20,}$' OR position('@' in p_unsubscribe_url) > 0 THEN
    RAISE EXCEPTION 'invalid_unsubscribe_url';
  END IF;
  FOREACH v_para IN ARRAY string_to_array(regexp_replace(coalesce(p_content,''), '\r\n?', E'\n', 'g'), E'\n\n')
  LOOP
    IF btrim(v_para) <> '' THEN
      v_body := v_body || '<p style="margin:0 0 16px">' || replace(public._ecr_escape(btrim(v_para)), E'\n', '<br>') || '</p>';
    END IF;
  END LOOP;
  IF p_cta_url IS NOT NULL AND p_cta_label IS NOT NULL THEN
    IF p_cta_url !~ '^https://[^[:space:]"''<>]+$' THEN RAISE EXCEPTION 'invalid_cta_url'; END IF;
    v_cta := '<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 16px"><tr><td style="background:#111827;border-radius:6px">'
      || '<a href="' || public._ecr_escape(p_cta_url) || '" style="display:inline-block;padding:12px 24px;color:#ffffff;font-size:15px;font-weight:bold;text-decoration:none">'
      || public._ecr_escape(p_cta_label) || '</a></td></tr></table>';
  END IF;
  v_footer := '<p style="margin:0 0 8px">Você está recebendo esta mensagem porque possui uma conta/relacionamento com a ShopDrive.</p>'
    || '<p style="margin:0"><a href="' || public._ecr_escape(p_unsubscribe_url) || '" style="color:#6b7280;text-decoration:underline">Não quero receber comunicações comerciais</a></p>';
  RETURN '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' || public._ecr_escape(p_subject) || '</title></head>'
    || '<body style="margin:0;padding:0;background:#f4f5f7;font-family:Arial,Helvetica,sans-serif;color:#111827">'
    || '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7"><tr><td align="center" style="padding:24px 12px">'
    || '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:8px;overflow:hidden">'
    || '<tr><td style="padding:20px 24px;border-bottom:1px solid #e5e7eb;font-size:20px;font-weight:bold">ShopDrive</td></tr>'
    || '<tr><td style="padding:24px;font-size:15px;line-height:1.6">' || v_body || v_cta || '</td></tr>'
    || '<tr><td style="padding:16px 24px;border-top:1px solid #e5e7eb;font-size:12px;line-height:1.5;color:#6b7280">' || v_footer || '</td></tr>'
    || '</table></td></tr></table></body></html>';
END $$;
REVOKE ALL ON FUNCTION public.render_email_campaign_html(text,text,text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.render_email_campaign_html(text,text,text,text,text) TO service_role;

-- Público da campanha: mesma lógica de elegibilidade de admin_list_subscribers (plano/status/produtos/configuração/período/busca),
-- restrita a lojas com e-mail de contato válido. Descadastro é aplicado fora (contagem e confirmação).
CREATE OR REPLACE FUNCTION public._campaign_resolve_audience(p_filters jsonb)
RETURNS TABLE(store_id uuid, email text, store_name text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_search text := nullif(btrim(coalesce(p_filters->>'search','')),'') ;
  v_digits text := regexp_replace(coalesce(p_filters->>'search',''), '\D', '', 'g');
  v_plan text := coalesce(p_filters->>'plan','all');
  v_status text := coalesce(p_filters->>'status','all');
  v_products text := coalesce(p_filters->>'products','all');
  v_setup text := coalesce(p_filters->>'setup','all');
  v_from timestamptz := nullif(p_filters->>'date_from','')::timestamptz;
  v_to timestamptz := nullif(p_filters->>'date_to','')::timestamptz;
BEGIN
  PERFORM public.assert_caller_is_admin();
  RETURN QUERY
  WITH base AS (
    SELECT p.id, p.store_name, p.full_name, p.store_slug, p.account_status, p.created_at,
           nullif(btrim(u.email::text),'') AS account_email,
           nullif(btrim(p.email),'') AS profile_email,
           nullif(btrim(p.phone),'') AS phone,
           nullif(btrim(p.whatsapp_number),'') AS whatsapp,
           ms.plan_id AS ms_plan, ms.status AS ms_status, ms.downgrade_reason AS ms_reason,
           inv.status AS inv_status, inv.plan AS inv_plan,
           (SELECT count(*) FROM products pr WHERE pr.user_id = p.id) AS product_count,
           sos.classification
    FROM profiles p
    LEFT JOIN auth.users u ON u.id = p.id
    LEFT JOIN LATERAL (SELECT plan_id, status, downgrade_reason FROM master_subscriptions m
                       WHERE m.user_id = p.id ORDER BY created_at DESC LIMIT 1) ms ON true
    LEFT JOIN LATERAL (SELECT status, plan FROM invoices i
                       WHERE i.subscriber_id = p.id ORDER BY created_at DESC LIMIT 1) inv ON true
    LEFT JOIN store_onboarding_state sos ON sos.store_id = p.id
    WHERE p.store_slug IS NOT NULL
  ), derived AS (
    SELECT b.*,
      CASE
        WHEN b.ms_plan IS NULL OR b.ms_plan = 'gratis'
             OR (b.ms_status = 'cancelled' AND b.ms_reason = 'payment_failed') THEN 'free'
        WHEN b.ms_status = 'active' THEN 'active'
        WHEN b.ms_status = 'past_due' THEN 'past_due'
        WHEN b.ms_status = 'pending' THEN 'pending'
        ELSE 'inactive' END AS sub0,
      CASE
        WHEN b.ms_plan IS NULL OR b.ms_plan = 'gratis'
             OR (b.ms_status = 'cancelled' AND b.ms_reason = 'payment_failed') THEN 'gratis'
        ELSE b.ms_plan END AS plan0
    FROM base b
  ), derived2 AS (
    SELECT d.*,
      CASE WHEN d.inv_status = 'paid' AND d.sub0 <> 'active' THEN 'active'
           WHEN d.inv_status = 'pending' AND d.sub0 IN ('inactive','free') THEN 'pending'
           ELSE d.sub0 END AS subscription_status,
      CASE WHEN d.inv_status = 'paid' AND d.sub0 <> 'active' AND d.inv_plan IS NOT NULL THEN d.inv_plan
           ELSE d.plan0 END AS plan_code,
      coalesce(d.account_email, d.profile_email) AS contact_email,
      CASE WHEN d.classification IS NULL THEN NULL
           WHEN d.classification = 'STORE_READY' THEN 'ready' ELSE 'incomplete' END AS setup_status
    FROM derived d
  ), final AS (
    SELECT x.*,
      CASE WHEN x.account_status IN ('excluida','exclusao_solicitada','bloqueado','suspenso') THEN x.account_status
           WHEN x.subscription_status IN ('pending','active') THEN x.subscription_status
           ELSE 'inactive' END AS filter_status
    FROM derived2 x
  ), pre AS (
    SELECT * FROM final f
    WHERE (v_search IS NULL
           OR f.store_name ILIKE '%'||v_search||'%'
           OR f.full_name ILIKE '%'||v_search||'%'
           OR f.store_slug ILIKE '%'||v_search||'%'
           OR f.account_email ILIKE '%'||v_search||'%'
           OR f.profile_email ILIKE '%'||v_search||'%'
           OR (length(v_digits) >= 4 AND (
                regexp_replace(coalesce(f.phone,''),'\D','','g') LIKE '%'||v_digits||'%'
             OR regexp_replace(coalesce(f.whatsapp,''),'\D','','g') LIKE '%'||v_digits||'%')))
      AND (v_plan = 'all' OR f.plan_code = v_plan)
      AND (v_from IS NULL OR f.created_at >= v_from)
      AND (v_to IS NULL OR f.created_at <= v_to)
      AND (CASE v_products
             WHEN 'none' THEN f.product_count = 0
             WHEN '1_20' THEN f.product_count BETWEEN 1 AND 20
             WHEN '21_150' THEN f.product_count BETWEEN 21 AND 150
             WHEN 'over_150' THEN f.product_count > 150
             ELSE true END)
      AND (CASE v_setup
             WHEN 'ready' THEN f.setup_status = 'ready'
             WHEN 'incomplete' THEN f.setup_status = 'incomplete'
             ELSE true END)
  ), filtered AS (
    SELECT * FROM pre WHERE v_status = 'all' OR filter_status = v_status
  )
  SELECT f.id, public.normalize_email(f.contact_email), f.store_name
  FROM filtered f
  WHERE f.account_status NOT IN ('excluida','exclusao_solicitada')
    AND public.normalize_email(f.contact_email) ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$';
END $$;
REVOKE ALL ON FUNCTION public._campaign_resolve_audience(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._campaign_resolve_audience(jsonb) TO service_role;

-- Contagem do público (backend): elegíveis pelos filtros, descadastrados, total final.
CREATE OR REPLACE FUNCTION public.admin_count_campaign_audience(p_filters jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_total int; v_suppressed int;
BEGIN
  PERFORM public.assert_caller_is_admin();
  SELECT count(*), count(*) FILTER (WHERE s.email IS NOT NULL)
    INTO v_total, v_suppressed
  FROM public._campaign_resolve_audience(p_filters) a
  LEFT JOIN public.email_suppressions s ON s.email = a.email;
  RETURN jsonb_build_object('filtered', v_total, 'suppressed', v_suppressed, 'eligible', v_total - v_suppressed);
END $$;
REVOKE ALL ON FUNCTION public.admin_count_campaign_audience(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_count_campaign_audience(jsonb) TO authenticated;

-- Cria/atualiza rascunho (ou ready não confirmada).
CREATE OR REPLACE FUNCTION public.admin_save_email_campaign(
  p_id uuid, p_name text, p_subject text, p_content text,
  p_cta_label text, p_cta_url text, p_filters jsonb
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_id uuid;
BEGIN
  PERFORM public.assert_caller_is_admin();
  IF nullif(btrim(coalesce(p_cta_label,'')),'') IS NULL THEN p_cta_label := NULL; p_cta_url := NULL;
  ELSE p_cta_label := btrim(p_cta_label); p_cta_url := btrim(coalesce(p_cta_url,''));
    IF p_cta_url !~ '^https://[^[:space:]"''<>]+$' OR char_length(p_cta_url) > 2000 THEN RAISE EXCEPTION 'invalid_cta_url'; END IF;
  END IF;
  IF p_id IS NULL THEN
    INSERT INTO public.email_campaigns (name, subject, content, cta_label, cta_url, audience_filters, created_by)
    VALUES (btrim(p_name), btrim(p_subject), p_content, p_cta_label, p_cta_url, coalesce(p_filters,'{}'::jsonb), auth.uid())
    RETURNING id INTO v_id;
    INSERT INTO audit_logs(user_id, action, entity_type, entity_id, metadata)
    VALUES (auth.uid(), 'email_campaign_create', 'email_campaign', v_id, jsonb_build_object('name', btrim(p_name)));
  ELSE
    UPDATE public.email_campaigns
    SET name = btrim(p_name), subject = btrim(p_subject), content = p_content,
        cta_label = p_cta_label, cta_url = p_cta_url,
        audience_filters = coalesce(p_filters,'{}'::jsonb), updated_at = now()
    WHERE id = p_id AND status IN ('draft','ready')
    RETURNING id INTO v_id;
    IF v_id IS NULL THEN RAISE EXCEPTION 'campaign_not_editable'; END IF;
    INSERT INTO audit_logs(user_id, action, entity_type, entity_id, metadata)
    VALUES (auth.uid(), 'email_campaign_update', 'email_campaign', v_id, jsonb_build_object('name', btrim(p_name)));
  END IF;
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.admin_save_email_campaign(uuid,text,text,text,text,text,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_save_email_campaign(uuid,text,text,text,text,text,jsonb) TO authenticated;

-- Prévia do HTML (mesmo renderer do envio; token fictício só para validar o formato do link).
CREATE OR REPLACE FUNCTION public.admin_preview_email_campaign(
  p_subject text, p_content text, p_cta_label text, p_cta_url text
) RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  PERFORM public.assert_caller_is_admin();
  RETURN public.render_email_campaign_html(p_subject, p_content,
    nullif(btrim(coalesce(p_cta_label,'')),''), nullif(btrim(coalesce(p_cta_url,'')),''),
    'https://shopdrive.com.br/descadastro?token=PREVIEW_PREVIA_PREVIA_PREVIA123');
END $$;
REVOKE ALL ON FUNCTION public.admin_preview_email_campaign(text,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_preview_email_campaign(text,text,text,text) TO authenticated;

-- Recalcula contadores e conclui automaticamente quando não há mais pending/queued.
CREATE OR REPLACE FUNCTION public._ecr_refresh_campaign_counters(p_campaign_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_pending int; v_failed int; v_total int;
BEGIN
  UPDATE public.email_campaigns c SET
    total_recipients = s.total, total_queued = s.queued, total_sent = s.sent,
    total_failed = s.failed, total_suppressed = s.suppressed, updated_at = now()
  FROM (
    SELECT count(*) AS total,
           count(*) FILTER (WHERE status = 'queued') AS queued,
           count(*) FILTER (WHERE status = 'sent') AS sent,
           count(*) FILTER (WHERE status = 'failed') AS failed,
           count(*) FILTER (WHERE status = 'suppressed') AS suppressed
    FROM public.email_campaign_recipients WHERE campaign_id = p_campaign_id
  ) s
  WHERE c.id = p_campaign_id;
  SELECT count(*) FILTER (WHERE status IN ('pending','queued')),
         count(*) FILTER (WHERE status = 'failed'), count(*)
    INTO v_pending, v_failed, v_total
  FROM public.email_campaign_recipients WHERE campaign_id = p_campaign_id;
  IF v_total > 0 AND v_pending = 0 THEN
    UPDATE public.email_campaigns
    SET status = CASE WHEN v_failed > 0 THEN 'completed_with_errors' ELSE 'completed' END,
        completed_at = now(), updated_at = now()
    WHERE id = p_campaign_id AND status = 'processing';
  END IF;
END $$;
REVOKE ALL ON FUNCTION public._ecr_refresh_campaign_counters(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._ecr_refresh_campaign_counters(uuid) TO service_role;

-- Confirmação final: congela o snapshot e enfileira (idempotente por campanha+loja).
CREATE OR REPLACE FUNCTION public.admin_confirm_email_campaign(p_campaign_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_c public.email_campaigns%ROWTYPE;
  v_rec RECORD;
  v_token text;
  v_html text;
  v_enq jsonb;
  v_queued int := 0; v_suppressed int := 0;
BEGIN
  PERFORM public.assert_caller_is_admin();
  SELECT * INTO v_c FROM public.email_campaigns WHERE id = p_campaign_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'campaign_not_found'; END IF;
  -- Idempotente: segunda confirmação não duplica snapshot nem fila.
  IF v_c.status NOT IN ('draft','ready') THEN
    RETURN jsonb_build_object('status', v_c.status, 'already', true,
      'total_recipients', v_c.total_recipients, 'queued', v_c.total_queued, 'suppressed', v_c.total_suppressed);
  END IF;

  INSERT INTO public.email_campaign_recipients (campaign_id, store_id, email, status)
  SELECT p_campaign_id, a.store_id, a.email,
         CASE WHEN s.email IS NOT NULL THEN 'suppressed' ELSE 'pending' END
  FROM public._campaign_resolve_audience(v_c.audience_filters) a
  LEFT JOIN public.email_suppressions s ON s.email = a.email
  ON CONFLICT (campaign_id, store_id) DO NOTHING;

  UPDATE public.email_campaign_recipients SET suppressed_at = now()
  WHERE campaign_id = p_campaign_id AND status = 'suppressed' AND suppressed_at IS NULL;

  UPDATE public.email_campaigns
  SET status = 'processing', confirmed_at = now(), started_at = now(), updated_at = now()
  WHERE id = p_campaign_id;

  FOR v_rec IN SELECT * FROM public.email_campaign_recipients
               WHERE campaign_id = p_campaign_id AND status = 'pending' ORDER BY created_at, id
  LOOP
    v_token := public.create_email_unsubscribe_token(v_rec.email);
    v_html := public.render_email_campaign_html(v_c.subject, v_c.content, v_c.cta_label, v_c.cta_url,
      'https://shopdrive.com.br/descadastro?token=' || v_token);
    v_enq := public.enqueue_marketing_email(v_rec.email, v_c.subject, v_html,
      'campaign:' || p_campaign_id::text || ':store:' || v_rec.store_id::text,
      jsonb_build_object('campaign_id', p_campaign_id, 'store_id', v_rec.store_id), 10, NULL);
    IF v_enq->>'status' = 'queued' THEN
      UPDATE public.email_campaign_recipients
      SET status = 'queued', email_queue_id = (v_enq->>'queue_id')::uuid, queued_at = now()
      WHERE id = v_rec.id;
      v_queued := v_queued + 1;
    ELSIF v_enq->>'status' = 'suppressed' THEN
      UPDATE public.email_campaign_recipients SET status = 'suppressed', suppressed_at = now() WHERE id = v_rec.id;
      v_suppressed := v_suppressed + 1;
    ELSIF v_enq->>'status' = 'exists' THEN
      UPDATE public.email_campaign_recipients
      SET status = 'queued', email_queue_id = (v_enq->>'queue_id')::uuid, queued_at = coalesce(queued_at, now())
      WHERE id = v_rec.id;
      v_queued := v_queued + 1;
    ELSE
      UPDATE public.email_campaign_recipients SET status = 'failed', last_error = 'enqueue_' || (v_enq->>'status') WHERE id = v_rec.id;
    END IF;
  END LOOP;

  PERFORM public._ecr_refresh_campaign_counters(p_campaign_id);

  INSERT INTO audit_logs(user_id, action, entity_type, entity_id, metadata)
  VALUES (auth.uid(), 'email_campaign_confirm', 'email_campaign', p_campaign_id,
          jsonb_build_object('queued', v_queued, 'suppressed', v_suppressed));

  RETURN jsonb_build_object('status', 'processing', 'already', false, 'queued', v_queued, 'suppressed', v_suppressed);
END $$;
REVOKE ALL ON FUNCTION public.admin_confirm_email_campaign(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_confirm_email_campaign(uuid) TO authenticated;

-- Cancelamento: draft/ready/processing. Itens ainda não enviados deixam de ser enviados.
CREATE OR REPLACE FUNCTION public.admin_cancel_email_campaign(p_campaign_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_status text; v_cancelled_queue int; v_cancelled_rec int;
BEGIN
  PERFORM public.assert_caller_is_admin();
  SELECT status INTO v_status FROM public.email_campaigns WHERE id = p_campaign_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'campaign_not_found'; END IF;
  IF v_status NOT IN ('draft','ready','processing') THEN RAISE EXCEPTION 'campaign_not_cancellable'; END IF;

  UPDATE public.email_queue q SET status = 'cancelled', last_error = 'campaign_cancelled', locked_at = NULL, locked_by = NULL
  WHERE q.payload->>'campaign_id' = p_campaign_id::text AND q.status IN ('pending','retry');
  GET DIAGNOSTICS v_cancelled_queue = ROW_COUNT;

  UPDATE public.email_campaign_recipients SET status = 'cancelled'
  WHERE campaign_id = p_campaign_id AND status IN ('pending','queued');
  GET DIAGNOSTICS v_cancelled_rec = ROW_COUNT;

  UPDATE public.email_campaigns SET status = 'cancelled', cancelled_at = now(), updated_at = now()
  WHERE id = p_campaign_id;

  PERFORM public._ecr_refresh_campaign_counters(p_campaign_id);

  INSERT INTO audit_logs(user_id, action, entity_type, entity_id, metadata)
  VALUES (auth.uid(), 'email_campaign_cancel', 'email_campaign', p_campaign_id,
          jsonb_build_object('cancelled_recipients', v_cancelled_rec));

  RETURN jsonb_build_object('status', 'cancelled', 'cancelled_recipients', v_cancelled_rec, 'cancelled_queue', v_cancelled_queue);
END $$;
REVOKE ALL ON FUNCTION public.admin_cancel_email_campaign(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_cancel_email_campaign(uuid) TO authenticated;

-- Sincronização fila → destinatário (server-side, independe da tela).
CREATE OR REPLACE FUNCTION public._ecr_on_email_queue_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_campaign uuid;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;
  IF NEW.payload->>'campaign_id' IS NULL THEN RETURN NEW; END IF;
  UPDATE public.email_campaign_recipients r SET
    status = CASE NEW.status
               WHEN 'sent' THEN 'sent'
               WHEN 'failed' THEN 'failed'
               WHEN 'suppressed' THEN 'suppressed'
               WHEN 'cancelled' THEN 'cancelled'
               ELSE r.status END,
    sent_at = CASE WHEN NEW.status = 'sent' THEN coalesce(NEW.sent_at, now()) ELSE r.sent_at END,
    suppressed_at = CASE WHEN NEW.status = 'suppressed' THEN now() ELSE r.suppressed_at END,
    last_error = CASE WHEN NEW.status IN ('failed','suppressed','cancelled') THEN NEW.last_error ELSE r.last_error END
  WHERE r.email_queue_id = NEW.id
    AND NEW.status IN ('sent','failed','suppressed','cancelled');
  BEGIN
    v_campaign := (NEW.payload->>'campaign_id')::uuid;
  EXCEPTION WHEN others THEN
    RETURN NEW;
  END;
  PERFORM public._ecr_refresh_campaign_counters(v_campaign);
  RETURN NEW;
END $$;
CREATE TRIGGER trg_ecr_email_queue_status
  AFTER UPDATE OF status ON public.email_queue
  FOR EACH ROW EXECUTE FUNCTION public._ecr_on_email_queue_status();

-- Listagem de campanhas (paginação server-side, 50/página) + contagens para os cards.
CREATE OR REPLACE FUNCTION public.admin_list_email_campaigns(
  p_search text DEFAULT NULL, p_status text DEFAULT 'all',
  p_date_from timestamptz DEFAULT NULL, p_date_to timestamptz DEFAULT NULL,
  p_limit int DEFAULT 50, p_offset int DEFAULT 0
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_search text := nullif(btrim(coalesce(p_search,'')),'') ; v_result jsonb;
BEGIN
  PERFORM public.assert_caller_is_admin();
  p_limit := least(greatest(coalesce(p_limit,50),1), 200);
  p_offset := greatest(coalesce(p_offset,0),0);
  WITH filtered AS (
    SELECT c.*, u.email::text AS creator_email
    FROM public.email_campaigns c
    LEFT JOIN auth.users u ON u.id = c.created_by
    WHERE (v_search IS NULL OR c.name ILIKE '%'||v_search||'%' OR c.subject ILIKE '%'||v_search||'%')
      AND (coalesce(p_status,'all') = 'all' OR c.status = p_status)
      AND (p_date_from IS NULL OR c.created_at >= p_date_from)
      AND (p_date_to IS NULL OR c.created_at <= p_date_to)
  )
  SELECT jsonb_build_object(
    'total', (SELECT count(*) FROM filtered),
    'counts', (SELECT coalesce(jsonb_object_agg(status, c), '{}'::jsonb)
               FROM (SELECT status, count(*) c FROM public.email_campaigns GROUP BY 1) s),
    'rows', coalesce((SELECT jsonb_agg(to_jsonb(r)) FROM (
      SELECT id, name, subject, status, audience_filters, created_by, creator_email,
             created_at, updated_at, confirmed_at, started_at, completed_at, cancelled_at,
             total_recipients, total_queued, total_sent, total_failed, total_suppressed
      FROM filtered ORDER BY created_at DESC, id DESC
      LIMIT p_limit OFFSET p_offset) r), '[]'::jsonb)
  ) INTO v_result;
  RETURN v_result;
END $$;
REVOKE ALL ON FUNCTION public.admin_list_email_campaigns(text,text,timestamptz,timestamptz,int,int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_email_campaigns(text,text,timestamptz,timestamptz,int,int) TO authenticated;

-- Detalhe de uma campanha (inclui conteúdo e CTA para a prévia).
CREATE OR REPLACE FUNCTION public.admin_get_email_campaign(p_campaign_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_result jsonb;
BEGIN
  PERFORM public.assert_caller_is_admin();
  SELECT jsonb_build_object(
    'id', c.id, 'name', c.name, 'subject', c.subject, 'content', c.content,
    'cta_label', c.cta_label, 'cta_url', c.cta_url, 'audience_filters', c.audience_filters,
    'status', c.status, 'creator_email', u.email::text,
    'created_at', c.created_at, 'updated_at', c.updated_at, 'confirmed_at', c.confirmed_at,
    'started_at', c.started_at, 'completed_at', c.completed_at, 'cancelled_at', c.cancelled_at,
    'total_recipients', c.total_recipients, 'total_queued', c.total_queued,
    'total_sent', c.total_sent, 'total_failed', c.total_failed, 'total_suppressed', c.total_suppressed,
    'pending', (SELECT count(*) FROM public.email_campaign_recipients r
                WHERE r.campaign_id = c.id AND r.status IN ('pending','queued'))
  ) INTO v_result
  FROM public.email_campaigns c
  LEFT JOIN auth.users u ON u.id = c.created_by
  WHERE c.id = p_campaign_id;
  IF v_result IS NULL THEN RAISE EXCEPTION 'campaign_not_found'; END IF;
  RETURN v_result;
END $$;
REVOKE ALL ON FUNCTION public.admin_get_email_campaign(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_get_email_campaign(uuid) TO authenticated;

-- Destinatários paginados (nunca carrega todos de uma vez).
CREATE OR REPLACE FUNCTION public.admin_list_campaign_recipients(
  p_campaign_id uuid, p_status text DEFAULT 'all', p_limit int DEFAULT 50, p_offset int DEFAULT 0
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_result jsonb;
BEGIN
  PERFORM public.assert_caller_is_admin();
  p_limit := least(greatest(coalesce(p_limit,50),1), 200);
  p_offset := greatest(coalesce(p_offset,0),0);
  WITH filtered AS (
    SELECT r.*, p.store_name, p.store_slug
    FROM public.email_campaign_recipients r
    LEFT JOIN public.profiles p ON p.id = r.store_id
    WHERE r.campaign_id = p_campaign_id
      AND (coalesce(p_status,'all') = 'all' OR r.status = p_status)
  )
  SELECT jsonb_build_object(
    'total', (SELECT count(*) FROM filtered),
    'rows', coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM (
      SELECT id, store_id, store_name, store_slug, email, status, last_error,
             created_at, queued_at, sent_at, suppressed_at
      FROM filtered ORDER BY created_at, id
      LIMIT p_limit OFFSET p_offset) x), '[]'::jsonb)
  ) INTO v_result;
  RETURN v_result;
END $$;
REVOKE ALL ON FUNCTION public.admin_list_campaign_recipients(uuid,text,int,int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_campaign_recipients(uuid,text,int,int) TO authenticated;