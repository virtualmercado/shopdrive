-- Custom domains: every eligible store (effective plan with the custom-domain entitlement: premium/marca) may configure
-- its own domain unless explicitly blocked (custom_domain_v2_access.enabled = false). The legacy exact pilot row keeps
-- its previous semantics unchanged. Adds the CNAME-only www ingress scope and sanitized Cloudflare observations.

ALTER TABLE public.merchant_domains ADD COLUMN IF NOT EXISTS external_observation jsonb;
COMMENT ON COLUMN public.merchant_domains.external_observation IS
  'Last sanitized Cloudflare Custom Hostname observation (statuses and redacted errors only; never tokens or raw payloads).';

-- Server-side eligibility: active store, not individually blocked, effective plan entitled to custom domains.
CREATE OR REPLACE FUNCTION public._custom_domain_store_eligible(p_store uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF p_store IS NULL OR NOT public.is_public_store_active(p_store) THEN RETURN false; END IF;
  IF EXISTS (SELECT 1 FROM public.custom_domain_v2_access a WHERE a.store_id = p_store AND NOT a.enabled) THEN RETURN false; END IF;
  RETURN COALESCE(public.get_effective_store_plan(p_store)->>'plan', '') IN ('premium', 'marca');
EXCEPTION WHEN others THEN RETURN false;
END $function$;
REVOKE ALL ON FUNCTION public._custom_domain_store_eligible(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._custom_domain_store_eligible(uuid) TO service_role;

-- Legacy exact pilot authorization (unchanged meaning): enabled row whose pilot hostname canonicalizes to the domain.
CREATE OR REPLACE FUNCTION public._custom_domain_pilot_matches(p_store uuid, p_normalized_domain text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT p_normalized_domain IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.custom_domain_v2_access a
    WHERE a.store_id = p_store AND a.enabled AND a.pilot_hostname IS NOT NULL
      AND public._custom_domain_norm_or_null(a.pilot_hostname) = p_normalized_domain);
$function$;
REVOKE ALL ON FUNCTION public._custom_domain_pilot_matches(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._custom_domain_pilot_matches(uuid, text) TO service_role;

CREATE OR REPLACE FUNCTION public._custom_domain_access_state(p_store uuid)
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT jsonb_build_object(
    'feature_enabled', COALESCE(c.feature_enabled, false),
    'store_enabled', public._custom_domain_store_eligible(p_store),
    'blocked', EXISTS (SELECT 1 FROM public.custom_domain_v2_access a WHERE a.store_id = p_store AND NOT a.enabled),
    'ingress_ready', COALESCE(c.ingress_ready, false) AND c.infrastructure_provider IS NOT NULL)
  FROM (SELECT 1) x LEFT JOIN public.custom_domain_platform_config c ON c.id;
$function$;

CREATE OR REPLACE FUNCTION public._custom_domain_ui_available(p_store uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_feature boolean;
BEGIN
  SELECT COALESCE(feature_enabled, false) INTO v_feature FROM public.custom_domain_platform_config WHERE id;
  IF COALESCE(v_feature, false) AND public._custom_domain_store_eligible(p_store) THEN RETURN true; END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.custom_domain_v2_access a JOIN public.merchant_domains d ON d.merchant_id = a.store_id
    WHERE a.store_id = p_store AND a.enabled AND a.pilot_hostname IS NOT NULL
      AND d.released_at IS NULL AND d.flow_version = 2
      AND d.normalized_domain = public._custom_domain_norm_or_null(a.pilot_hostname));
END $function$;

CREATE OR REPLACE FUNCTION public._custom_domain_provisioning_authz(p_actor uuid, p_merchant_id uuid, p_normalized_domain text)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_access jsonb;
BEGIN
  IF p_actor IS NULL THEN RETURN false; END IF;
  IF p_actor <> p_merchant_id AND NOT public.has_role(p_actor, 'admin') THEN RETURN false; END IF;
  IF public._custom_domain_pilot_matches(p_merchant_id, p_normalized_domain) THEN RETURN true; END IF;
  v_access := public._custom_domain_access_state(p_merchant_id);
  RETURN COALESCE((v_access->>'feature_enabled')::boolean AND (v_access->>'store_enabled')::boolean, false);
END;
$function$;

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
  IF NOT COALESCE((v_access->>'feature_enabled')::boolean AND (v_access->>'store_enabled')::boolean
                  AND (v_access->>'ingress_ready')::boolean, false)
     AND NOT public._custom_domain_pilot_matches(v_uid, v_norm) THEN
    RAISE EXCEPTION 'feature_unavailable';
  END IF;
  IF public.is_reserved_custom_domain(v_norm) THEN RAISE EXCEPTION 'reserved_domain'; END IF;
  SELECT COALESCE(challenge_ttl_hours, 72) INTO v_ttl FROM custom_domain_platform_config WHERE id;
  v_ttl := COALESCE(v_ttl, 72);

  PERFORM pg_advisory_xact_lock(hashtext('custom_domain:' || v_norm));
  SELECT * INTO v_other FROM merchant_domains WHERE normalized_domain = v_norm AND released_at IS NULL AND merchant_id <> v_uid FOR UPDATE;
  IF FOUND THEN
    IF v_other.ownership_verified_at IS NULL AND v_other.verification_expires_at < now() AND v_other.external_hostname_id IS NULL THEN
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
  -- A Custom Hostname awaiting administrative removal must keep its record (never orphan the external id).
  IF FOUND AND v_mine.released_at IS NULL AND v_mine.external_hostname_id IS NOT NULL THEN
    RAISE EXCEPTION 'infrastructure_removal_pending';
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
      dns_error_message = NULL, ssl_error_message = NULL, external_error = NULL, external_observation = NULL,
      provision_attempts = 0, provision_next_retry_at = NULL, updated_at = now()
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

CREATE OR REPLACE FUNCTION public.apply_custom_domain_verification(p_actor uuid, p_domain_id uuid, p_expected_updated_at timestamp with time zone, p_expected_access jsonb, p_expected_config jsonb, p_result jsonb, p_state text, p_pilot_hostname text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE c public.custom_domain_platform_config; a public.custom_domain_v2_access; d public.merchant_domains;
 v_admin boolean; v_pilot boolean; v_generic boolean; v_eligible boolean; v_dns boolean; v_owned boolean; v_at timestamptz; v_source text; v_preserve boolean;
BEGIN
 SELECT * INTO c FROM public.custom_domain_platform_config WHERE id=true FOR SHARE;
 IF NOT FOUND OR to_jsonb(c) IS DISTINCT FROM p_expected_config THEN RAISE EXCEPTION 'verification_context_changed' USING ERRCODE='40001'; END IF;
 SELECT * INTO d FROM public.merchant_domains WHERE id=p_domain_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'domain_not_found' USING ERRCODE='22023'; END IF;
 SELECT * INTO a FROM public.custom_domain_v2_access WHERE store_id=d.merchant_id FOR SHARE;
 IF (CASE WHEN FOUND THEN to_jsonb(a) ELSE NULL END) IS DISTINCT FROM p_expected_access THEN
   RAISE EXCEPTION 'verification_context_changed' USING ERRCODE='40001';
 END IF;
 SELECT * INTO d FROM public.merchant_domains WHERE id=p_domain_id FOR UPDATE;
 IF d.released_at IS NOT NULL OR d.updated_at IS DISTINCT FROM p_expected_updated_at THEN
   RAISE EXCEPTION 'verification_context_changed' USING ERRCODE='40001';
 END IF;
 v_admin := p_actor IS NOT NULL AND public.has_role(p_actor,'admin');
 IF p_actor IS NULL OR (p_actor<>d.merchant_id AND NOT v_admin) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 -- Legacy exact pilot stores are verified only by the Master.
 IF NOT v_admin AND a.pilot_hostname IS NOT NULL THEN RAISE EXCEPTION 'feature_unavailable' USING ERRCODE='42501'; END IF;
 v_eligible := public._custom_domain_store_eligible(d.merchant_id);
 v_pilot := CASE WHEN p_pilot_hostname IS NULL THEN false ELSE COALESCE(v_admin AND a.enabled AND a.store_id=d.merchant_id AND a.pilot_hostname=p_pilot_hostname
   AND p_pilot_hostname=public.normalize_custom_domain_hostname(p_pilot_hostname)
   AND public.normalize_custom_domain(p_pilot_hostname)=d.normalized_domain,false) END;
 v_generic := COALESCE(v_eligible AND c.feature_enabled AND c.ingress_ready AND c.infrastructure_provider IS NOT NULL,false);
 IF p_pilot_hostname IS NOT NULL AND NOT v_pilot THEN RAISE EXCEPTION 'pilot_revoked' USING ERRCODE='42501'; END IF;
 IF NOT v_admin AND NOT COALESCE(v_eligible AND c.feature_enabled,false) THEN RAISE EXCEPTION 'feature_unavailable' USING ERRCODE='42501'; END IF;
 IF (p_result->>'pilotHostname') IS DISTINCT FROM p_pilot_hostname THEN RAISE EXCEPTION 'invalid_verification_scope' USING ERRCODE='22023'; END IF;
 v_dns := CASE WHEN v_pilot THEN p_result->>'root'='not_required' AND p_result->>'www'='ok'
   ELSE COALESCE((p_result->>'root'='ok' AND p_result->>'www'='ok')
     OR (p_result->>'root'='not_required' AND p_result->>'www'='ok' AND c.root_record_value IS NULL
         AND p_result->>'wwwOnlyHostname' = 'www.' || d.normalized_domain), false) END;
 v_owned := p_result->>'ownership' IN ('verified','already_verified');
 v_preserve := COALESCE(d.v2_state='active' AND d.is_active AND NOT d.needs_reverification
   AND d.ownership_verified_at IS NOT NULL AND d.dns_verified_at IS NOT NULL AND d.activated_at IS NOT NULL
   AND (v_pilot OR v_generic) AND (d.last_verification_result->>'pilotHostname') IS NOT DISTINCT FROM p_pilot_hostname
   AND (p_result->>'root'='resolver_unavailable' OR p_result->>'www'='resolver_unavailable' OR p_result->>'ownership'='resolver_unavailable')
   AND p_result->>'root' NOT IN ('wrong','missing') AND p_result->>'www' NOT IN ('wrong','missing')
   AND p_result->>'ownership' IN ('verified','already_verified','resolver_unavailable'),false);
 IF p_state='active' AND NOT COALESCE((v_pilot OR v_generic) AND (v_dns AND v_owned OR v_preserve) AND
   d.routing_status='active' AND d.ssl_status='active' AND public.is_public_store_active(d.merchant_id),false) THEN
   RAISE EXCEPTION 'activation_not_authorized' USING ERRCODE='42501';
 END IF;
 v_at := (p_result->>'checkedAt')::timestamptz;
 IF v_at IS NULL OR v_at>now()+interval '1 minute' OR v_at<now()-interval '10 minutes' THEN RAISE EXCEPTION 'invalid_observation_time' USING ERRCODE='22023'; END IF;
 v_source := CASE WHEN v_admin THEN 'admin:'||p_actor::text ELSE 'merchant' END;
 INSERT INTO public.domain_verification_logs(domain_id,source,verification_type,status,details)
 VALUES (d.id,v_source,'ns',CASE WHEN jsonb_array_length(p_result->'nameservers')>0 THEN 'found' ELSE 'not_found' END,jsonb_build_object('provider',p_result->'provider')),
 (d.id,v_source,'ownership_txt',p_result->>'ownership',jsonb_build_object('txt_records',p_result->'observed'->'txt')),
 (d.id,v_source,'dns_target','root:'||(p_result->>'root')||' www:'||(p_result->>'www'),jsonb_build_object('notes',p_result->'notes','pilot_hostname',p_pilot_hostname));
 IF d.flow_version<>2 THEN
   UPDATE public.merchant_domains SET last_dns_check=v_at,last_verification_result=p_result,needs_reverification=true WHERE id=d.id;
   RETURN jsonb_build_object('legacy',true,'result',p_result);
 END IF;
 UPDATE public.merchant_domains SET last_dns_check=v_at,last_verification_result=CASE WHEN v_preserve THEN last_verification_result ELSE p_result END,v2_state=p_state,
  detected_nameservers=ARRAY(SELECT jsonb_array_elements_text(p_result->'nameservers')),dns_provider=p_result->'provider'->>'slug',updated_at=now(),
  ownership_verified_at=CASE WHEN p_result->>'ownership'='verified' THEN v_at ELSE ownership_verified_at END,
  dns_verified_at=CASE WHEN v_dns AND (v_pilot OR v_generic) THEN v_at ELSE dns_verified_at END,
  dns_a_verified=CASE WHEN v_dns AND (v_pilot OR v_generic) THEN p_result->>'root'='ok' ELSE dns_a_verified END,
  dns_cname_verified=CASE WHEN v_dns AND (v_pilot OR v_generic) THEN true ELSE dns_cname_verified END,
  activated_at=CASE WHEN p_state='active' AND activated_at IS NULL THEN v_at ELSE activated_at END,
  is_active=CASE WHEN p_state='active' THEN true ELSE is_active END
 WHERE id=d.id;
 RETURN jsonb_build_object('state',p_state,'result',p_result);
END $function$;

CREATE OR REPLACE FUNCTION public.resolve_public_store_by_domain(p_hostname text)
RETURNS TABLE(store_id uuid, store_slug text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_host text; v_norm text;
BEGIN
  v_host := public.normalize_custom_domain_hostname(p_hostname);
  v_norm := public.normalize_custom_domain(v_host);
  IF (SELECT count(*) FROM public.merchant_domains md
      WHERE md.normalized_domain = v_norm AND md.released_at IS NULL) <> 1 THEN RETURN; END IF;
  RETURN QUERY SELECT p.id, p.store_slug
    FROM public.merchant_domains md
    JOIN public.profiles p ON p.id = md.merchant_id
    LEFT JOIN public.custom_domain_v2_access a ON a.store_id = md.merchant_id
    JOIN public.custom_domain_platform_config c ON c.id = true
    WHERE md.normalized_domain = v_norm AND md.flow_version = 2 AND md.released_at IS NULL
      AND md.v2_state = 'active' AND md.is_active AND NOT md.needs_reverification
      AND md.ownership_verified_at IS NOT NULL AND md.ownership_verified_at <= now()
      AND md.dns_verified_at IS NOT NULL AND md.dns_verified_at <= now()
      AND md.routing_status = 'active' AND md.ssl_status = 'active'
      AND md.activated_at IS NOT NULL AND md.activated_at <= now()
      AND p.store_slug IS NOT NULL AND btrim(p.store_slug) <> ''
      AND p.deleted_at IS NULL AND COALESCE(p.account_status, 'active') = 'active'
      AND (
        (a.enabled AND a.pilot_hostname = v_host AND COALESCE(md.last_verification_result->>'pilotHostname',v_host)=v_host)
        OR (a.pilot_hostname IS NULL AND md.last_verification_result->>'pilotHostname' IS NULL
            AND c.feature_enabled AND c.ingress_ready AND c.infrastructure_provider IS NOT NULL
            AND public._custom_domain_store_eligible(md.merchant_id))
      ) IS TRUE;
EXCEPTION WHEN others THEN RETURN;
END $function$;

CREATE OR REPLACE FUNCTION public._active_v2_store_hostname(p_merchant_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v record;
BEGIN
  -- Exactly one fully-active V2 binding may define the store's public hostname (mirrors resolve_public_store_by_domain).
  SELECT COUNT(*) AS n,
         (ARRAY_AGG(CASE WHEN a.pilot_hostname IS NOT NULL THEN a.pilot_hostname
                         ELSE 'www.' || md.normalized_domain END))[1] AS host
    INTO v
    FROM public.merchant_domains md
    JOIN public.profiles p ON p.id = md.merchant_id
    LEFT JOIN public.custom_domain_v2_access a ON a.store_id = md.merchant_id
    JOIN public.custom_domain_platform_config c ON c.id = true
    WHERE md.merchant_id = p_merchant_id AND md.released_at IS NULL
      AND md.flow_version = 2 AND md.v2_state = 'active' AND md.is_active AND NOT md.needs_reverification
      AND md.ownership_verified_at IS NOT NULL AND md.ownership_verified_at <= now()
      AND md.dns_verified_at IS NOT NULL AND md.dns_verified_at <= now()
      AND md.routing_status = 'active' AND md.ssl_status = 'active'
      AND md.activated_at IS NOT NULL AND md.activated_at <= now()
      AND md.normalized_domain IS NOT NULL
      AND p.store_slug IS NOT NULL AND btrim(p.store_slug) <> ''
      AND p.deleted_at IS NULL AND COALESCE(p.account_status, 'active') = 'active'
      AND (
        (a.enabled AND a.pilot_hostname IS NOT NULL
          AND public.normalize_custom_domain(a.pilot_hostname) = md.normalized_domain
          AND COALESCE(md.last_verification_result->>'pilotHostname', a.pilot_hostname) = a.pilot_hostname)
        OR (a.pilot_hostname IS NULL AND md.last_verification_result->>'pilotHostname' IS NULL
            AND c.feature_enabled AND c.ingress_ready AND c.infrastructure_provider IS NOT NULL
            AND public._custom_domain_store_eligible(md.merchant_id))
      ) IS TRUE;
  IF v.n IS DISTINCT FROM 1 THEN RETURN NULL; END IF;
  RETURN v.host;
EXCEPTION WHEN others THEN RETURN NULL;
END $function$;

-- Records sanitized Cloudflare statuses together with the provisioning outcome.
DROP FUNCTION IF EXISTS public.complete_custom_domain_provisioning(uuid, uuid, timestamptz, text, text, text, text, text);
CREATE FUNCTION public.complete_custom_domain_provisioning(p_actor uuid, p_domain_id uuid, p_expected_updated_at timestamp with time zone,
  p_external_hostname_id text, p_routing_status text, p_ssl_status text, p_state text, p_error text, p_observation jsonb DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v merchant_domains%ROWTYPE;
BEGIN
  SELECT * INTO v FROM merchant_domains WHERE id = p_domain_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'domain_not_found'; END IF;
  IF NOT public._custom_domain_provisioning_authz(p_actor, v.merchant_id, v.normalized_domain) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF v.released_at IS NOT NULL THEN RAISE EXCEPTION 'domain_not_found'; END IF;
  IF v.updated_at <> p_expected_updated_at THEN RAISE EXCEPTION 'concurrent_modification' USING ERRCODE = '40001'; END IF;
  IF v.external_hostname_id IS NOT NULL AND p_external_hostname_id IS NOT NULL
     AND v.external_hostname_id <> p_external_hostname_id THEN
    RAISE EXCEPTION 'external_hostname_conflict';
  END IF;
  IF p_observation IS NOT NULL AND jsonb_typeof(p_observation) <> 'object' THEN RAISE EXCEPTION 'invalid_observation'; END IF;

  UPDATE merchant_domains SET
    external_hostname_id = COALESCE(v.external_hostname_id, p_external_hostname_id),
    external_created_at = CASE WHEN v.external_hostname_id IS NULL AND p_external_hostname_id IS NOT NULL
                               THEN now() ELSE v.external_created_at END,
    external_last_check_at = now(),
    external_observation = COALESCE(p_observation, v.external_observation),
    routing_status = p_routing_status,
    ssl_status = p_ssl_status,
    v2_state = p_state,
    external_error = p_error,
    provision_attempts = 0,
    provision_next_retry_at = NULL,
    activated_at = CASE WHEN p_state = 'active' AND v.activated_at IS NULL THEN now() ELSE v.activated_at END,
    is_active = (p_state = 'active'),
    status = CASE WHEN p_state = 'active' THEN 'active' ELSE v.status END,
    updated_at = now()
  WHERE id = p_domain_id
  RETURNING * INTO v;

  INSERT INTO domain_verification_logs(domain_id, verification_type, status, source, error_message, details)
    VALUES (p_domain_id, 'provision', p_state, CASE WHEN p_actor = v.merchant_id THEN 'merchant' ELSE 'admin' END, p_error,
            CASE WHEN p_observation IS NULL THEN NULL ELSE jsonb_build_object('observation', p_observation) END);
  RETURN to_jsonb(v);
END;
$function$;
REVOKE ALL ON FUNCTION public.complete_custom_domain_provisioning(uuid, uuid, timestamptz, text, text, text, text, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_custom_domain_provisioning(uuid, uuid, timestamptz, text, text, text, text, text, jsonb) TO service_role;

-- External removal waiting on the administrative DELETE switch: resolver already revoked; record the pending item.
CREATE OR REPLACE FUNCTION public.mark_custom_domain_removal_pending(p_actor uuid, p_domain_id uuid, p_expected_updated_at timestamp with time zone, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v merchant_domains%ROWTYPE;
BEGIN
  IF p_reason NOT IN ('writes_disabled', 'deletes_disabled', 'credential_not_configured') THEN RAISE EXCEPTION 'invalid_reason'; END IF;
  SELECT * INTO v FROM merchant_domains WHERE id = p_domain_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'domain_not_found'; END IF;
  IF NOT public._custom_domain_provisioning_authz(p_actor, v.merchant_id, v.normalized_domain) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF v.released_at IS NOT NULL OR v.routing_status <> 'removing' OR v.external_hostname_id IS NULL THEN RAISE EXCEPTION 'not_pending_removal'; END IF;
  IF v.updated_at <> p_expected_updated_at THEN RAISE EXCEPTION 'concurrent_modification' USING ERRCODE = '40001'; END IF;
  UPDATE merchant_domains SET external_error = 'external_removal_pending:' || p_reason, external_last_check_at = now(), updated_at = now()
    WHERE id = p_domain_id RETURNING * INTO v;
  INSERT INTO domain_verification_logs(domain_id, verification_type, status, source, error_message)
    VALUES (p_domain_id, 'disconnect', 'pending_admin_removal', CASE WHEN p_actor = v.merchant_id THEN 'merchant' ELSE 'admin' END,
            'external_removal_pending:' || p_reason);
  RETURN to_jsonb(v);
END;
$function$;
REVOKE ALL ON FUNCTION public.mark_custom_domain_removal_pending(uuid, uuid, timestamptz, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_custom_domain_removal_pending(uuid, uuid, timestamptz, text) TO service_role;

NOTIFY pgrst, 'reload schema';