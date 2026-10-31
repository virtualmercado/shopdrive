CREATE OR REPLACE FUNCTION public._custom_domain_norm_or_null(p text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN public.normalize_custom_domain(p);
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END $function$;

CREATE OR REPLACE FUNCTION public._custom_domain_ui_available(p_store uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_feature boolean; v_access record;
BEGIN
  SELECT COALESCE(feature_enabled, false) INTO v_feature FROM custom_domain_platform_config WHERE id;
  SELECT enabled, pilot_hostname INTO v_access FROM custom_domain_v2_access WHERE store_id = p_store;
  IF NOT COALESCE(v_access.enabled, false) THEN RETURN false; END IF;
  IF v_feature THEN RETURN true; END IF;
  RETURN v_access.pilot_hostname IS NOT NULL AND EXISTS (
    SELECT 1 FROM merchant_domains d
    WHERE d.merchant_id = p_store AND d.released_at IS NULL AND d.flow_version = 2
      AND d.normalized_domain = public._custom_domain_norm_or_null(v_access.pilot_hostname));
END $function$;

CREATE OR REPLACE FUNCTION public.get_my_custom_domain_v2()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_uid uuid := auth.uid(); v_access jsonb; c record; d record; a record; v_records jsonb := '[]'::jsonb; v_pilot text;
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
  RETURN jsonb_build_object(
    'available', public._custom_domain_ui_available(v_uid),
    'ingress_ready', (v_access->>'ingress_ready')::boolean,
    'purchase_url', c.domain_purchase_url,
    'records', v_records,
    'domain', CASE WHEN d.id IS NULL THEN NULL ELSE jsonb_build_object(
      'id', d.id, 'domain', COALESCE(d.normalized_domain, d.domain), 'flow_version', d.flow_version,
      'display_hostname', COALESCE(v_pilot, COALESCE(d.normalized_domain, d.domain)),
      'state', CASE WHEN d.flow_version = 2 THEN d.v2_state ELSE 'needs_reverification' END,
      'txt_host', CASE WHEN d.flow_version = 2 THEN COALESCE(c.txt_host_prefix,'_shopdrive-verification') || '.' || d.normalized_domain END,
      'txt_value', CASE WHEN d.flow_version = 2 AND d.ownership_verified_at IS NULL THEN COALESCE(c.txt_value_prefix,'shopdrive=') || d.verification_token END,
      'verification_expires_at', d.verification_expires_at, 'ownership_verified_at', d.ownership_verified_at,
      'dns_verified_at', d.dns_verified_at, 'dns_provider', d.dns_provider, 'detected_nameservers', d.detected_nameservers,
      'routing_status', d.routing_status, 'ssl_status', CASE WHEN d.flow_version = 2 THEN d.ssl_status ELSE 'pending' END,
      'last_dns_check', d.last_dns_check, 'last_result', d.last_verification_result,
      'needs_reverification', d.needs_reverification OR d.flow_version = 1, 'released', d.released_at IS NOT NULL,
      'active', d.flow_version = 2 AND d.v2_state = 'active') END);
END $function$;

CREATE OR REPLACE FUNCTION public.claim_custom_domain(p_domain text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE v_uid uuid := auth.uid(); v_norm text; v_access jsonb; v_ttl int; v_other record; v_mine record; v_token text; v_id uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = v_uid AND store_slug IS NOT NULL) THEN RAISE EXCEPTION 'store_not_found'; END IF;
  v_access := public._custom_domain_access_state(v_uid);
  v_norm := public.normalize_custom_domain(p_domain);
  IF NOT ((v_access->>'feature_enabled')::boolean AND (v_access->>'store_enabled')::boolean) THEN
    IF NOT ((v_access->>'store_enabled')::boolean AND EXISTS (
      SELECT 1 FROM custom_domain_v2_access a
      WHERE a.store_id = v_uid AND a.enabled AND a.pilot_hostname IS NOT NULL
        AND public._custom_domain_norm_or_null(a.pilot_hostname) = v_norm)) THEN
      RAISE EXCEPTION 'feature_unavailable';
    END IF;
  END IF;
  IF public.is_reserved_custom_domain(v_norm) THEN RAISE EXCEPTION 'reserved_domain'; END IF;
  SELECT COALESCE(challenge_ttl_hours, 72) INTO v_ttl FROM custom_domain_platform_config WHERE id;
  v_ttl := COALESCE(v_ttl, 72);

  PERFORM pg_advisory_xact_lock(hashtext('custom_domain:' || v_norm));
  SELECT * INTO v_other FROM merchant_domains WHERE normalized_domain = v_norm AND released_at IS NULL AND merchant_id <> v_uid FOR UPDATE;
  IF FOUND THEN
    IF v_other.ownership_verified_at IS NULL AND v_other.verification_expires_at < now() THEN
      UPDATE merchant_domains SET released_at = now(), v2_state = 'released', updated_at = now() WHERE id = v_other.id;
      INSERT INTO domain_verification_logs(domain_id, verification_type, status, source, error_message)
        VALUES (v_other.id, 'claim', 'released', 'claim_expired', 'Claim pendente expirado liberado para novo pedido');
    ELSE
      RAISE EXCEPTION 'domain_taken';
    END IF;
  END IF;

  SELECT * INTO v_mine FROM merchant_domains WHERE merchant_id = v_uid ORDER BY updated_at DESC LIMIT 1 FOR UPDATE;
  IF FOUND AND v_mine.flow_version = 2 AND v_mine.released_at IS NULL AND v_mine.v2_state = 'active' THEN
    RAISE EXCEPTION 'disconnect_active_domain_first';
  END IF;
  IF FOUND AND v_mine.normalized_domain = v_norm AND v_mine.released_at IS NULL AND v_mine.flow_version = 2 THEN
    RETURN jsonb_build_object('id', v_mine.id, 'domain', v_norm, 'reused', true);
  END IF;

  v_token := encode(extensions.gen_random_bytes(24), 'hex');
  IF FOUND THEN
    INSERT INTO domain_verification_logs(domain_id, verification_type, status, source, found_value)
      VALUES (v_mine.id, 'claim', 'replaced', 'merchant', COALESCE(v_mine.normalized_domain, v_mine.domain));
    UPDATE merchant_domains SET domain = v_norm, normalized_domain = v_norm, flow_version = 2, v2_state = 'pending_ownership',
      verification_token = v_token, verification_expires_at = now() + make_interval(hours => v_ttl),
      ownership_verified_at = NULL, dns_verified_at = NULL, dns_provider = NULL, detected_nameservers = '{}',
      routing_status = 'not_started', external_hostname_id = NULL, activated_at = NULL, consecutive_dns_failures = 0,
      needs_reverification = false, released_at = NULL, disconnected_at = NULL, last_verification_result = NULL,
      is_active = false, status = 'pending', ssl_status = 'pending', dns_a_verified = false, dns_cname_verified = false,
      dns_error_message = NULL, ssl_error_message = NULL, updated_at = now()
    WHERE id = v_mine.id RETURNING id INTO v_id;
  ELSE
    INSERT INTO merchant_domains(merchant_id, domain, domain_type, normalized_domain, flow_version, v2_state, verification_token, verification_expires_at)
      VALUES (v_uid, v_norm, 'root', v_norm, 2, 'pending_ownership', v_token, now() + make_interval(hours => v_ttl)) RETURNING id INTO v_id;
  END IF;
  INSERT INTO domain_verification_logs(domain_id, verification_type, status, source, expected_value)
    VALUES (v_id, 'claim', 'created', 'merchant', v_norm);
  RETURN jsonb_build_object('id', v_id, 'domain', v_norm, 'reused', false);
EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'domain_taken';
END $function$;