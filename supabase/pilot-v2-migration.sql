-- Structural preparation only: no configuration, access or domain rows are changed.
ALTER TABLE public.custom_domain_v2_access ADD COLUMN pilot_hostname text;
COMMENT ON COLUMN public.custom_domain_v2_access.pilot_hostname IS
  'Admin-authorized exact pilot hostname. Does not enable merchant UI or prove ownership/DNS/SSL. NULL revokes the pilot.';

-- Browser hostname normalization is deliberately separate from canonical claim normalization.
CREATE OR REPLACE FUNCTION public.normalize_custom_domain_hostname(p_hostname text)
RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE v text;
BEGIN
  IF p_hostname IS NULL THEN RAISE EXCEPTION 'invalid_hostname' USING ERRCODE = '22023'; END IF;
  v := regexp_replace(lower(p_hostname), '\.$', '');
  IF length(v) > 253 OR v !~ '^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+(xn--[a-z0-9-]{2,59}|[a-z]{2,63})$'
     OR public.is_reserved_custom_domain(v) THEN
    RAISE EXCEPTION 'invalid_hostname' USING ERRCODE = '22023';
  END IF;
  RETURN v;
END $$;
REVOKE ALL ON FUNCTION public.normalize_custom_domain_hostname(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.normalize_custom_domain_hostname(text) TO service_role;

ALTER TABLE public.custom_domain_v2_access ADD CONSTRAINT custom_domain_pilot_hostname_exact
  CHECK (pilot_hostname IS NULL OR pilot_hostname = public.normalize_custom_domain_hostname(pilot_hostname));

-- Existing admin_set_store_custom_domains_v2 signature and enabled semantics remain untouched.
CREATE OR REPLACE FUNCTION public.admin_set_store_custom_domain_pilot(p_store_id uuid, p_hostname text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_host text;
BEGIN
  PERFORM public.assert_caller_is_admin();
  IF NOT public.is_public_store_active(p_store_id) THEN
    RAISE EXCEPTION 'store_not_found' USING ERRCODE = '22023';
  END IF;
  IF p_hostname IS NOT NULL THEN v_host := public.normalize_custom_domain_hostname(p_hostname); END IF;
  -- Never sets enabled=true; ordinary release/revocation remains a separate protected operation.
  INSERT INTO public.custom_domain_v2_access(store_id, enabled, pilot_hostname, updated_by, updated_at)
    VALUES (p_store_id, false, v_host, auth.uid(), now())
    ON CONFLICT (store_id) DO UPDATE SET pilot_hostname = EXCLUDED.pilot_hostname,
      updated_by = EXCLUDED.updated_by, updated_at = now();
  INSERT INTO public.audit_logs(user_id, action, entity_type, entity_id, metadata)
    VALUES (auth.uid(), 'custom_domain_pilot_set', 'custom_domain_v2_access', p_store_id,
      jsonb_build_object('pilot_hostname', v_host, 'revoked', v_host IS NULL));
  RETURN jsonb_build_object('ok', true, 'pilot_hostname', v_host);
END $$;
REVOKE ALL ON FUNCTION public.admin_set_store_custom_domain_pilot(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_store_custom_domain_pilot(uuid, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.resolve_public_store_by_domain(p_hostname text)
RETURNS TABLE(store_id uuid, store_slug text) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_host text; v_norm text;
BEGIN
  v_host := public.normalize_custom_domain_hostname(p_hostname);
  v_norm := public.normalize_custom_domain(v_host);
  -- Count all unreleased claims before selecting: never pick an arbitrary eligible row.
  IF (SELECT count(*) FROM public.merchant_domains md
      WHERE md.normalized_domain = v_norm AND md.released_at IS NULL) <> 1 THEN RETURN; END IF;
  RETURN QUERY SELECT p.id, p.store_slug
    FROM public.merchant_domains md
    JOIN public.profiles p ON p.id = md.merchant_id
    JOIN public.custom_domain_v2_access a ON a.store_id = md.merchant_id AND a.enabled
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
        a.pilot_hostname = v_host
        OR (c.feature_enabled AND c.ingress_ready AND c.infrastructure_provider IS NOT NULL)
      );
EXCEPTION WHEN others THEN
  RETURN;
END $$;
REVOKE ALL ON FUNCTION public.resolve_public_store_by_domain(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_public_store_by_domain(text) TO anon, authenticated, service_role;