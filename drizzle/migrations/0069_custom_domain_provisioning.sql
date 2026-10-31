-- lovable-cron-fallback-reviewed: Cloudflare Custom Hostnames has no status webhook; the 5-min sync (288 runs/day) is the only way to advance provisioning/SSL states automatically, and each run is a cheap no-op select when no domain is pending. Cadence required by the approved spec.
ALTER TABLE public.merchant_domains
  ADD COLUMN IF NOT EXISTS external_created_at timestamptz,
  ADD COLUMN IF NOT EXISTS external_last_check_at timestamptz,
  ADD COLUMN IF NOT EXISTS external_error text,
  ADD COLUMN IF NOT EXISTS provision_attempts int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS provision_next_retry_at timestamptz;

CREATE OR REPLACE FUNCTION public._custom_domain_provisioning_authz(p_actor uuid, p_merchant_id uuid, p_normalized_domain text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_access jsonb;
BEGIN
  IF p_actor IS NULL THEN RETURN false; END IF;
  IF p_actor <> p_merchant_id AND NOT public.has_role(p_actor, 'admin') THEN RETURN false; END IF;
  v_access := public._custom_domain_access_state(p_merchant_id);
  IF NOT COALESCE((v_access->>'store_enabled')::boolean, false) THEN RETURN false; END IF;
  IF COALESCE((v_access->>'feature_enabled')::boolean, false) THEN RETURN true; END IF;
  RETURN EXISTS (
    SELECT 1 FROM custom_domain_v2_access a
    WHERE a.store_id = p_merchant_id AND a.enabled AND a.pilot_hostname IS NOT NULL
      AND public._custom_domain_norm_or_null(a.pilot_hostname) = p_normalized_domain
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.begin_custom_domain_provisioning(p_actor uuid, p_domain_id uuid, p_expected_updated_at timestamptz)
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
  IF v.flow_version <> 2 OR v.released_at IS NOT NULL THEN RAISE EXCEPTION 'domain_not_found'; END IF;
  IF v.ownership_verified_at IS NULL THEN RAISE EXCEPTION 'ownership_not_verified'; END IF;
  IF v.updated_at <> p_expected_updated_at THEN RAISE EXCEPTION 'concurrent_modification' USING ERRCODE = '40001'; END IF;

  UPDATE merchant_domains SET
    routing_status = 'provisioning',
    v2_state = 'routing_provisioning',
    external_error = NULL,
    updated_at = now()
  WHERE id = p_domain_id
  RETURNING * INTO v;

  INSERT INTO domain_verification_logs(domain_id, verification_type, status, source)
    VALUES (p_domain_id, 'provision', 'provisioning', CASE WHEN p_actor = v.merchant_id THEN 'merchant' ELSE 'admin' END);
  RETURN to_jsonb(v);
END;
$function$;

CREATE OR REPLACE FUNCTION public.complete_custom_domain_provisioning(
  p_actor uuid, p_domain_id uuid, p_expected_updated_at timestamptz,
  p_external_hostname_id text, p_routing_status text, p_ssl_status text, p_state text, p_error text
)
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

  UPDATE merchant_domains SET
    external_hostname_id = COALESCE(v.external_hostname_id, p_external_hostname_id),
    external_created_at = CASE WHEN v.external_hostname_id IS NULL AND p_external_hostname_id IS NOT NULL
                               THEN now() ELSE v.external_created_at END,
    external_last_check_at = now(),
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

  INSERT INTO domain_verification_logs(domain_id, verification_type, status, source, error_message)
    VALUES (p_domain_id, 'provision', p_state, CASE WHEN p_actor = v.merchant_id THEN 'merchant' ELSE 'admin' END, p_error);
  RETURN to_jsonb(v);
END;
$function$;

CREATE OR REPLACE FUNCTION public.fail_custom_domain_provisioning(
  p_actor uuid, p_domain_id uuid, p_expected_updated_at timestamptz, p_error text, p_next_retry_at timestamptz
)
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
  IF v.updated_at <> p_expected_updated_at THEN RAISE EXCEPTION 'concurrent_modification' USING ERRCODE = '40001'; END IF;

  UPDATE merchant_domains SET
    provision_attempts = provision_attempts + 1,
    provision_next_retry_at = p_next_retry_at,
    external_error = left(COALESCE(p_error, 'unknown'), 200),
    external_last_check_at = now(),
    updated_at = now()
  WHERE id = p_domain_id
  RETURNING * INTO v;

  INSERT INTO domain_verification_logs(domain_id, verification_type, status, source, error_message)
    VALUES (p_domain_id, 'provision', 'transient_error', CASE WHEN p_actor = v.merchant_id THEN 'merchant' ELSE 'admin' END,
            left(COALESCE(p_error, 'unknown'), 200));
  RETURN to_jsonb(v);
END;
$function$;

CREATE OR REPLACE FUNCTION public.revoke_custom_domain_internal(p_actor uuid, p_domain_id uuid, p_expected_updated_at timestamptz)
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

  UPDATE merchant_domains SET
    is_active = false,
    v2_state = 'inactive',
    status = 'inactive',
    routing_status = CASE WHEN external_hostname_id IS NULL THEN 'removed' ELSE 'removing' END,
    disconnected_at = now(),
    updated_at = now()
  WHERE id = p_domain_id
  RETURNING * INTO v;

  INSERT INTO domain_verification_logs(domain_id, verification_type, status, source)
    VALUES (p_domain_id, 'disconnect', 'revoking', CASE WHEN p_actor = v.merchant_id THEN 'merchant' ELSE 'admin' END);
  RETURN to_jsonb(v);
END;
$function$;

CREATE OR REPLACE FUNCTION public.finalize_custom_domain_revoke(p_actor uuid, p_domain_id uuid, p_expected_updated_at timestamptz)
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
  IF v.updated_at <> p_expected_updated_at THEN RAISE EXCEPTION 'concurrent_modification' USING ERRCODE = '40001'; END IF;

  UPDATE merchant_domains SET
    external_hostname_id = NULL,
    routing_status = 'removed',
    ssl_status = 'pending',
    v2_state = 'released',
    is_active = false,
    status = 'inactive',
    external_error = NULL,
    provision_attempts = 0,
    provision_next_retry_at = NULL,
    released_at = now(),
    disconnected_at = COALESCE(disconnected_at, now()),
    updated_at = now()
  WHERE id = p_domain_id
  RETURNING * INTO v;

  INSERT INTO domain_verification_logs(domain_id, verification_type, status, source)
    VALUES (p_domain_id, 'disconnect', 'released', CASE WHEN p_actor = v.merchant_id THEN 'merchant' ELSE 'admin' END);
  RETURN to_jsonb(v);
END;
$function$;

REVOKE ALL ON FUNCTION public._custom_domain_provisioning_authz(uuid, uuid, text) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.begin_custom_domain_provisioning(uuid, uuid, timestamptz) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_custom_domain_provisioning(uuid, uuid, timestamptz, text, text, text, text, text) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.fail_custom_domain_provisioning(uuid, uuid, timestamptz, text, timestamptz) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.revoke_custom_domain_internal(uuid, uuid, timestamptz) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.finalize_custom_domain_revoke(uuid, uuid, timestamptz) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._custom_domain_provisioning_authz(uuid, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.begin_custom_domain_provisioning(uuid, uuid, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_custom_domain_provisioning(uuid, uuid, timestamptz, text, text, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.fail_custom_domain_provisioning(uuid, uuid, timestamptz, text, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.revoke_custom_domain_internal(uuid, uuid, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.finalize_custom_domain_revoke(uuid, uuid, timestamptz) TO service_role;

INSERT INTO public.internal_job_tokens(job_name, token)
VALUES ('sync-custom-domain-provisioning', encode(extensions.gen_random_bytes(32), 'hex'))
ON CONFLICT (job_name) DO NOTHING;

SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'sync-custom-domain-provisioning';
SELECT cron.schedule(
  'sync-custom-domain-provisioning',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := 'https://nkoogfznnqlnragbauez.supabase.co/functions/v1/sync-custom-domain-provisioning',
    headers := jsonb_build_object('Content-Type','application/json',
      'x-internal-job-token', (select token from public.internal_job_tokens where job_name='sync-custom-domain-provisioning')),
    body := '{}'::jsonb) as request_id;
  $$
);