CREATE OR REPLACE FUNCTION public.get_my_custom_domain_v2()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_uid uuid := auth.uid(); v_access jsonb; c record; d record; a record; v_records jsonb := '[]'::jsonb; v_pilot text;
  v_available boolean; v_reason text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  v_access := public._custom_domain_access_state(v_uid);
  SELECT * INTO c FROM custom_domain_platform_config WHERE id;
  SELECT * INTO d FROM merchant_domains WHERE merchant_id = v_uid ORDER BY (released_at IS NULL) DESC, updated_at DESC LIMIT 1;
  SELECT * INTO a FROM custom_domain_v2_access WHERE store_id = v_uid;
  v_pilot := CASE WHEN d.id IS NOT NULL AND a.pilot_hostname IS NOT NULL
    AND d.normalized_domain = public._custom_domain_norm_or_null(a.pilot_hostname) THEN a.pilot_hostname END;
  IF (v_access->>'ingress_ready')::boolean AND d.normalized_domain IS NOT NULL THEN
    v_records := jsonb_build_array(
      jsonb_build_object('purpose','root','type',c.root_record_type,'host','@','value',c.root_record_value),
      jsonb_build_object('purpose','www','type',c.www_record_type,'host','www','value',c.www_record_value));
  END IF;
  v_available := public._custom_domain_ui_available(v_uid);
  v_reason := CASE WHEN v_available THEN NULL
    WHEN (v_access->>'blocked')::boolean THEN 'blocked'
    WHEN NOT (v_access->>'feature_enabled')::boolean THEN 'feature'
    ELSE 'plan' END;
  RETURN jsonb_build_object(
    'available', v_available,
    'unavailable_reason', v_reason,
    'ingress_ready', (v_access->>'ingress_ready')::boolean,
    'purchase_url', c.domain_purchase_url,
    'records', v_records,
    'domain', CASE WHEN d.id IS NULL THEN NULL ELSE jsonb_build_object(
      'id', d.id, 'domain', COALESCE(d.normalized_domain, d.domain), 'flow_version', d.flow_version,
      'display_hostname', COALESCE(v_pilot, CASE WHEN d.flow_version = 2 AND d.normalized_domain IS NOT NULL AND c.root_record_value IS NULL
        THEN 'www.' || d.normalized_domain ELSE COALESCE(d.normalized_domain, d.domain) END),
      'state', CASE WHEN d.flow_version = 2 THEN d.v2_state ELSE 'needs_reverification' END,
      'txt_host', CASE WHEN d.flow_version = 2 THEN COALESCE(c.txt_host_prefix,'_shopdrive-verification') || '.' || d.normalized_domain END,
      'txt_value', CASE WHEN d.flow_version = 2 AND d.ownership_verified_at IS NULL THEN COALESCE(c.txt_value_prefix,'shopdrive=') || d.verification_token END,
      'verification_expires_at', d.verification_expires_at, 'ownership_verified_at', d.ownership_verified_at,
      'dns_verified_at', d.dns_verified_at, 'dns_provider', d.dns_provider, 'detected_nameservers', d.detected_nameservers,
      'routing_status', d.routing_status, 'ssl_status', CASE WHEN d.flow_version = 2 THEN d.ssl_status ELSE 'pending' END,
      'last_dns_check', d.last_dns_check, 'last_result', d.last_verification_result,
      'needs_reverification', d.needs_reverification OR d.flow_version = 1, 'released', d.released_at IS NOT NULL,
      'active', d.flow_version = 2 AND d.v2_state = 'active',
      -- Presentation-only boolean: never exposes the protected external ids themselves.
      'managed_by_platform', COALESCE(d.external_hostname_id IS NOT NULL
        AND d.external_hostname_id = ANY(COALESCE(c.protected_external_hostname_ids, '{}'::text[])), false)) END);
END $function$;