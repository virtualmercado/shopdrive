-- Custom Domains V2 foundation (additive). Legacy V1 columns kept; V2 truth lives in new columns.
CREATE TABLE public.custom_domain_platform_config (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  feature_enabled boolean NOT NULL DEFAULT false,
  infrastructure_provider text,
  ingress_ready boolean NOT NULL DEFAULT false,
  dns_strategy text NOT NULL DEFAULT 'a_root_cname_www',
  root_record_type text NOT NULL DEFAULT 'A',
  root_record_value text,
  www_record_type text NOT NULL DEFAULT 'CNAME',
  www_record_value text,
  ingress_hostname text,
  ingress_ips text[] NOT NULL DEFAULT '{}',
  txt_host_prefix text NOT NULL DEFAULT '_shopdrive-verification',
  txt_value_prefix text NOT NULL DEFAULT 'shopdrive=',
  challenge_ttl_hours integer NOT NULL DEFAULT 72 CHECK (challenge_ttl_hours BETWEEN 1 AND 720),
  revalidation_failure_threshold integer NOT NULL DEFAULT 3 CHECK (revalidation_failure_threshold BETWEEN 1 AND 50),
  domain_purchase_url text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.custom_domain_platform_config TO authenticated;
GRANT ALL ON public.custom_domain_platform_config TO service_role;
ALTER TABLE public.custom_domain_platform_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read custom domain config" ON public.custom_domain_platform_config
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.custom_domain_v2_access (
  store_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.custom_domain_v2_access TO authenticated;
GRANT ALL ON public.custom_domain_v2_access TO service_role;
ALTER TABLE public.custom_domain_v2_access ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read custom domain access" ON public.custom_domain_v2_access
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

ALTER TABLE public.merchant_domains
  ADD COLUMN flow_version smallint NOT NULL DEFAULT 1,
  ADD COLUMN v2_state text,
  ADD COLUMN normalized_domain text,
  ADD COLUMN verification_token text,
  ADD COLUMN verification_expires_at timestamptz,
  ADD COLUMN ownership_verified_at timestamptz,
  ADD COLUMN dns_verified_at timestamptz,
  ADD COLUMN dns_provider text,
  ADD COLUMN detected_nameservers text[] NOT NULL DEFAULT '{}',
  ADD COLUMN routing_status text NOT NULL DEFAULT 'not_started',
  ADD COLUMN infrastructure_provider text,
  ADD COLUMN external_hostname_id text,
  ADD COLUMN activated_at timestamptz,
  ADD COLUMN consecutive_dns_failures integer NOT NULL DEFAULT 0,
  ADD COLUMN needs_reverification boolean NOT NULL DEFAULT false,
  ADD COLUMN released_at timestamptz,
  ADD COLUMN disconnected_at timestamptz,
  ADD COLUMN last_verification_result jsonb;

ALTER TABLE public.merchant_domains ADD CONSTRAINT merchant_domains_v2_state_check CHECK (v2_state IS NULL OR v2_state IN
  ('pending_ownership','ownership_verified','dns_pending','dns_verified','routing_provisioning','ssl_provisioning','active',
   'ownership_error','dns_error','routing_error','ssl_error','needs_reverification','inactive','released'));
ALTER TABLE public.merchant_domains ADD CONSTRAINT merchant_domains_routing_status_check CHECK (routing_status IN
  ('not_started','provisioning','active','error','removed'));

COMMENT ON COLUMN public.merchant_domains.status IS 'LEGACY V1 (simulated flow). V2 state lives in v2_state.';
COMMENT ON COLUMN public.merchant_domains.expected_cname IS 'DEPRECATED: obsolete V1 target; ingress comes from custom_domain_platform_config.';
COMMENT ON COLUMN public.merchant_domains.expected_ip IS 'DEPRECATED: ingress comes from custom_domain_platform_config.';
ALTER TABLE public.merchant_domains ALTER COLUMN expected_cname DROP DEFAULT;

-- Legacy rows marked active by the simulated flow are not trusted.
UPDATE public.merchant_domains SET needs_reverification = true WHERE is_active OR status = 'active' OR ssl_status = 'active';

CREATE UNIQUE INDEX merchant_domains_normalized_domain_unique
  ON public.merchant_domains (normalized_domain)
  WHERE normalized_domain IS NOT NULL AND released_at IS NULL;

ALTER TABLE public.domain_verification_logs ADD COLUMN source text, ADD COLUMN details jsonb;

-- Clients no longer write domain rows or logs directly.
DROP POLICY IF EXISTS "Merchants can insert their own domains" ON public.merchant_domains;
DROP POLICY IF EXISTS "Merchants can update their own domains" ON public.merchant_domains;
DROP POLICY IF EXISTS "Merchants can delete their own domains" ON public.merchant_domains;
DROP POLICY IF EXISTS "Admins can update all domains" ON public.merchant_domains;
DROP POLICY IF EXISTS "Admins can delete all domains" ON public.merchant_domains;
DROP POLICY IF EXISTS "Admins can manage domain logs" ON public.domain_verification_logs;
REVOKE INSERT, UPDATE, DELETE ON public.merchant_domains FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.domain_verification_logs FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.normalize_custom_domain(p_input text)
RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE v text;
BEGIN
  IF p_input IS NULL THEN RAISE EXCEPTION 'invalid_domain'; END IF;
  v := lower(btrim(p_input));
  v := regexp_replace(v, '^https?://', '');
  IF v ~ '[?#@]' THEN RAISE EXCEPTION 'invalid_domain'; END IF;
  v := regexp_replace(v, '/+$', '');
  IF position('/' in v) > 0 OR position(':' in v) > 0 THEN RAISE EXCEPTION 'invalid_domain'; END IF;
  v := regexp_replace(v, '\.$', '');
  v := regexp_replace(v, '^www\.', '');
  IF length(v) > 253 OR v ~ '^[0-9.]+$' OR v = 'localhost' OR v LIKE '%.localhost'
     OR v !~ '^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+(xn--[a-z0-9-]{2,59}|[a-z]{2,63})$' THEN
    RAISE EXCEPTION 'invalid_domain';
  END IF;
  RETURN v;
END $$;

CREATE OR REPLACE FUNCTION public.is_reserved_custom_domain(p_domain text)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM unnest(ARRAY['shopdrive.com.br','virtualmercado.com.br','lovable.app','lovable.dev',
    'lovableproject.com','supabase.co','supabase.in','supabase.com']) r
    WHERE p_domain = r OR p_domain LIKE '%.' || r);
$$;

CREATE OR REPLACE FUNCTION public._custom_domain_access_state(p_store uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'feature_enabled', COALESCE(c.feature_enabled, false),
    'store_enabled', COALESCE((SELECT a.enabled FROM custom_domain_v2_access a WHERE a.store_id = p_store), false),
    'ingress_ready', COALESCE(c.ingress_ready, false) AND c.infrastructure_provider IS NOT NULL)
  FROM (SELECT 1) x LEFT JOIN custom_domain_platform_config c ON c.id;
$$;

CREATE OR REPLACE FUNCTION public.get_my_custom_domain_v2()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_access jsonb; c record; d record; v_records jsonb := '[]'::jsonb;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  v_access := public._custom_domain_access_state(v_uid);
  SELECT * INTO c FROM custom_domain_platform_config WHERE id;
  SELECT * INTO d FROM merchant_domains WHERE merchant_id = v_uid ORDER BY (released_at IS NULL) DESC, updated_at DESC LIMIT 1;
  IF (v_access->>'ingress_ready')::boolean AND d.normalized_domain IS NOT NULL THEN
    v_records := jsonb_build_array(
      jsonb_build_object('purpose','root','type',c.root_record_type,'host','@','value',c.root_record_value),
      jsonb_build_object('purpose','www','type',c.www_record_type,'host','www','value',c.www_record_value));
  END IF;
  RETURN jsonb_build_object(
    'available', (v_access->>'feature_enabled')::boolean AND (v_access->>'store_enabled')::boolean,
    'ingress_ready', (v_access->>'ingress_ready')::boolean,
    'purchase_url', c.domain_purchase_url,
    'records', v_records,
    'domain', CASE WHEN d.id IS NULL THEN NULL ELSE jsonb_build_object(
      'id', d.id, 'domain', COALESCE(d.normalized_domain, d.domain), 'flow_version', d.flow_version,
      'state', CASE WHEN d.flow_version = 2 THEN d.v2_state ELSE 'needs_reverification' END,
      'txt_host', CASE WHEN d.flow_version = 2 THEN COALESCE(c.txt_host_prefix,'_shopdrive-verification') || '.' || d.normalized_domain END,
      'txt_value', CASE WHEN d.flow_version = 2 AND d.ownership_verified_at IS NULL THEN COALESCE(c.txt_value_prefix,'shopdrive=') || d.verification_token END,
      'verification_expires_at', d.verification_expires_at, 'ownership_verified_at', d.ownership_verified_at,
      'dns_verified_at', d.dns_verified_at, 'dns_provider', d.dns_provider, 'detected_nameservers', d.detected_nameservers,
      'routing_status', d.routing_status, 'ssl_status', CASE WHEN d.flow_version = 2 THEN d.ssl_status ELSE 'pending' END,
      'last_dns_check', d.last_dns_check, 'last_result', d.last_verification_result,
      'needs_reverification', d.needs_reverification OR d.flow_version = 1, 'released', d.released_at IS NOT NULL,
      'active', d.flow_version = 2 AND d.v2_state = 'active') END);
END $$;

CREATE OR REPLACE FUNCTION public.claim_custom_domain(p_domain text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE v_uid uuid := auth.uid(); v_norm text; v_access jsonb; v_ttl int; v_other record; v_mine record; v_token text; v_id uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = v_uid AND store_slug IS NOT NULL) THEN RAISE EXCEPTION 'store_not_found'; END IF;
  v_access := public._custom_domain_access_state(v_uid);
  IF NOT ((v_access->>'feature_enabled')::boolean AND (v_access->>'store_enabled')::boolean) THEN RAISE EXCEPTION 'feature_unavailable'; END IF;
  v_norm := public.normalize_custom_domain(p_domain);
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
END $$;

CREATE OR REPLACE FUNCTION public.regenerate_custom_domain_challenge()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE v_uid uuid := auth.uid(); d record; v_ttl int;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT * INTO d FROM merchant_domains WHERE merchant_id = v_uid AND flow_version = 2 AND released_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'domain_not_found'; END IF;
  IF d.ownership_verified_at IS NOT NULL THEN RAISE EXCEPTION 'ownership_already_verified'; END IF;
  SELECT COALESCE(challenge_ttl_hours, 72) INTO v_ttl FROM custom_domain_platform_config WHERE id;
  UPDATE merchant_domains SET verification_token = encode(extensions.gen_random_bytes(24), 'hex'),
    verification_expires_at = now() + make_interval(hours => COALESCE(v_ttl, 72)), v2_state = 'pending_ownership', updated_at = now()
  WHERE id = d.id;
  INSERT INTO domain_verification_logs(domain_id, verification_type, status, source) VALUES (d.id, 'claim', 'challenge_regenerated', 'merchant');
  RETURN jsonb_build_object('ok', true);
END $$;

CREATE OR REPLACE FUNCTION public._disconnect_custom_domain(p_domain_id uuid, p_source text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE merchant_domains SET v2_state = 'inactive', is_active = false, routing_status = CASE WHEN routing_status = 'not_started' THEN routing_status ELSE 'removed' END,
    disconnected_at = now(), released_at = now(), status = 'inactive', updated_at = now() WHERE id = p_domain_id;
  INSERT INTO domain_verification_logs(domain_id, verification_type, status, source) VALUES (p_domain_id, 'disconnect', 'inactive', p_source);
END $$;

CREATE OR REPLACE FUNCTION public.disconnect_custom_domain()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); d record;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT * INTO d FROM merchant_domains WHERE merchant_id = v_uid AND released_at IS NULL ORDER BY updated_at DESC LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'domain_not_found'; END IF;
  IF d.external_hostname_id IS NOT NULL THEN RAISE EXCEPTION 'infrastructure_removal_required'; END IF;
  PERFORM public._disconnect_custom_domain(d.id, 'merchant');
  RETURN jsonb_build_object('ok', true);
END $$;

CREATE OR REPLACE FUNCTION public.admin_disconnect_custom_domain(p_store_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d record;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO d FROM merchant_domains WHERE merchant_id = p_store_id AND released_at IS NULL ORDER BY updated_at DESC LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'domain_not_found'; END IF;
  IF d.external_hostname_id IS NOT NULL THEN RAISE EXCEPTION 'infrastructure_removal_required'; END IF;
  PERFORM public._disconnect_custom_domain(d.id, 'admin:' || auth.uid());
  RETURN jsonb_build_object('ok', true);
END $$;

CREATE OR REPLACE FUNCTION public.admin_set_store_custom_domains_v2(p_store_id uuid, p_enabled boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  INSERT INTO custom_domain_v2_access(store_id, enabled, updated_by, updated_at) VALUES (p_store_id, p_enabled, auth.uid(), now())
    ON CONFLICT (store_id) DO UPDATE SET enabled = EXCLUDED.enabled, updated_by = EXCLUDED.updated_by, updated_at = now();
  RETURN jsonb_build_object('ok', true, 'enabled', p_enabled);
END $$;

CREATE OR REPLACE FUNCTION public.resolve_public_store_by_domain(p_hostname text)
RETURNS TABLE(store_id uuid, store_slug text) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_norm text;
BEGIN
  BEGIN v_norm := public.normalize_custom_domain(p_hostname); EXCEPTION WHEN others THEN RETURN; END;
  RETURN QUERY SELECT p.id, p.store_slug FROM merchant_domains md JOIN profiles p ON p.id = md.merchant_id
   WHERE md.normalized_domain = v_norm AND md.flow_version = 2 AND md.released_at IS NULL AND md.v2_state = 'active'
     AND md.is_active AND NOT md.needs_reverification AND md.ownership_verified_at IS NOT NULL AND md.dns_verified_at IS NOT NULL
     AND md.routing_status = 'active' AND md.ssl_status = 'active' AND md.activated_at IS NOT NULL AND p.store_slug IS NOT NULL
     AND COALESCE((SELECT feature_enabled FROM custom_domain_platform_config WHERE id), false)
   LIMIT 1;
END $$;

REVOKE ALL ON FUNCTION public._custom_domain_access_state(uuid), public._disconnect_custom_domain(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._custom_domain_access_state(uuid), public._disconnect_custom_domain(uuid, text) TO service_role;
REVOKE ALL ON FUNCTION public.get_my_custom_domain_v2(), public.claim_custom_domain(text), public.regenerate_custom_domain_challenge(),
  public.disconnect_custom_domain(), public.admin_disconnect_custom_domain(uuid), public.admin_set_store_custom_domains_v2(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_custom_domain_v2(), public.claim_custom_domain(text), public.regenerate_custom_domain_challenge(),
  public.disconnect_custom_domain(), public.admin_disconnect_custom_domain(uuid), public.admin_set_store_custom_domains_v2(uuid, boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.resolve_public_store_by_domain(text), public.normalize_custom_domain(text), public.is_reserved_custom_domain(text) TO anon, authenticated, service_role;
