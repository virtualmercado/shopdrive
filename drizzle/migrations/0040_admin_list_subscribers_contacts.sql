CREATE OR REPLACE FUNCTION public.admin_list_subscribers(
  p_search text DEFAULT NULL,
  p_plan text DEFAULT 'all',
  p_status text DEFAULT 'all',
  p_contact text DEFAULT 'all',
  p_date_from timestamptz DEFAULT NULL,
  p_date_to timestamptz DEFAULT NULL,
  p_products text DEFAULT 'all',
  p_setup text DEFAULT 'all',
  p_limit int DEFAULT 50,
  p_offset int DEFAULT 0
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_search text := nullif(btrim(coalesce(p_search,'')),'');
  v_digits text := regexp_replace(coalesce(p_search,''), '\D', '', 'g');
  v_result jsonb;
BEGIN
  PERFORM public.assert_caller_is_admin();
  p_limit := least(greatest(coalesce(p_limit,50),1), 5000);
  p_offset := greatest(coalesce(p_offset,0),0);

  WITH base AS (
    SELECT p.id, p.store_name, p.full_name, p.store_slug, p.account_status, p.created_at,
           p.cpf_cnpj, p.address, p.address_number, p.address_complement, p.address_neighborhood,
           p.address_city, p.address_state, p.address_zip_code,
           nullif(btrim(u.email::text),'') AS account_email,
           nullif(btrim(p.email),'') AS profile_email,
           nullif(btrim(p.phone),'') AS phone,
           nullif(btrim(p.whatsapp_number),'') AS whatsapp,
           ms.plan_id AS ms_plan, ms.status AS ms_status, ms.downgrade_reason AS ms_reason,
           inv.status AS inv_status, inv.plan AS inv_plan,
           (SELECT count(*) FROM products pr WHERE pr.user_id = p.id) AS product_count,
           sos.classification, sos.progress_percent
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
      coalesce(d.account_email, d.profile_email) IS NOT NULL AS has_email,
      coalesce(d.whatsapp, d.phone) IS NOT NULL AS has_phone,
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
      AND (coalesce(p_plan,'all') = 'all' OR f.plan_code = p_plan)
      AND (p_date_from IS NULL OR f.created_at >= p_date_from)
      AND (p_date_to IS NULL OR f.created_at <= p_date_to)
      AND (CASE coalesce(p_contact,'all')
             WHEN 'with_email' THEN f.has_email
             WHEN 'without_email' THEN NOT f.has_email
             WHEN 'with_phone' THEN f.has_phone
             WHEN 'without_phone' THEN NOT f.has_phone
             WHEN 'with_both' THEN f.has_email AND f.has_phone
             ELSE true END)
      AND (CASE coalesce(p_products,'all')
             WHEN 'none' THEN f.product_count = 0
             WHEN '1_20' THEN f.product_count BETWEEN 1 AND 20
             WHEN '21_150' THEN f.product_count BETWEEN 21 AND 150
             WHEN 'over_150' THEN f.product_count > 150
             ELSE true END)
      AND (CASE coalesce(p_setup,'all')
             WHEN 'ready' THEN f.setup_status = 'ready'
             WHEN 'incomplete' THEN f.setup_status = 'incomplete'
             ELSE true END)
  ), filtered AS (
    SELECT * FROM pre WHERE coalesce(p_status,'all') = 'all' OR filter_status = p_status
  )
  SELECT jsonb_build_object(
    'total', (SELECT count(*) FROM filtered),
    'counts', (SELECT coalesce(jsonb_object_agg(filter_status, c), '{}'::jsonb)
               FROM (SELECT filter_status, count(*) c FROM pre GROUP BY 1) s),
    'counts_all', (SELECT count(*) FROM pre),
    'rows', coalesce((SELECT jsonb_agg(to_jsonb(r)) FROM (
       SELECT id, store_name, full_name, store_slug, account_status, created_at, cpf_cnpj,
              address, address_number, address_complement, address_neighborhood,
              address_city, address_state, address_zip_code,
              account_email, profile_email, phone, whatsapp,
              plan_code, subscription_status, filter_status, product_count,
              setup_status, progress_percent
       FROM filtered ORDER BY created_at DESC, id DESC
       LIMIT p_limit OFFSET p_offset) r), '[]'::jsonb)
  ) INTO v_result;
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_subscribers(text,text,text,text,timestamptz,timestamptz,text,text,int,int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_subscribers(text,text,text,text,timestamptz,timestamptz,text,text,int,int) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_log_subscribers_export(p_format text, p_count int, p_filters jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  PERFORM public.assert_caller_is_admin();
  IF p_format NOT IN ('pdf','csv') THEN RAISE EXCEPTION 'Formato inválido'; END IF;
  INSERT INTO audit_logs(user_id, action, entity_type, metadata)
  VALUES (auth.uid(), 'subscribers_list_export', 'subscribers',
          jsonb_build_object('format', p_format, 'count', p_count, 'filters', coalesce(p_filters,'{}'::jsonb)));
END;
$$;
REVOKE ALL ON FUNCTION public.admin_log_subscribers_export(text,int,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_log_subscribers_export(text,int,jsonb) TO authenticated;