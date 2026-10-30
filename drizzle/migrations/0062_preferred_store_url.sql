-- Preferred public store URL: single server-side authority for the active V2 hostname of a store.
-- Fail-closed: any ambiguity, inactive state or error returns NULL; callers fall back to the ShopDrive URL.
-- No configuration, access or domain rows are changed by this migration.

CREATE OR REPLACE FUNCTION public._active_v2_store_hostname(p_merchant_id uuid)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v record;
BEGIN
  -- Exactly one fully-active V2 binding may define the store's public hostname.
  -- Conditions mirror resolve_public_store_by_domain, keyed by the store's own binding.
  SELECT COUNT(*) AS n,
         (ARRAY_AGG(CASE WHEN a.pilot_hostname IS NOT NULL THEN a.pilot_hostname
                         ELSE 'www.' || md.normalized_domain END))[1] AS host
    INTO v
    FROM public.merchant_domains md
    JOIN public.profiles p ON p.id = md.merchant_id
    JOIN public.custom_domain_v2_access a ON a.store_id = md.merchant_id AND a.enabled
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
        (a.pilot_hostname IS NOT NULL
          AND public.normalize_custom_domain(a.pilot_hostname) = md.normalized_domain
          AND COALESCE(md.last_verification_result->>'pilotHostname', a.pilot_hostname) = a.pilot_hostname)
        OR (a.pilot_hostname IS NULL AND md.last_verification_result->>'pilotHostname' IS NULL
            AND c.feature_enabled AND c.ingress_ready AND c.infrastructure_provider IS NOT NULL)
      );
  IF v.n IS DISTINCT FROM 1 THEN RETURN NULL; END IF;
  RETURN v.host;
EXCEPTION WHEN others THEN RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public._active_v2_store_hostname(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._active_v2_store_hostname(uuid) TO service_role;

-- Public read: given a store slug, returns the active custom V2 hostname or NULL.
-- The hostname always comes from the store's own authorized V2 binding, never from visitor input.
CREATE OR REPLACE FUNCTION public.resolve_store_preferred_hostname(p_store_slug text)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_slug text; v_store uuid;
BEGIN
  IF p_store_slug IS NULL THEN RETURN NULL; END IF;
  v_slug := lower(btrim(p_store_slug));
  IF v_slug = '' OR v_slug !~ '^[a-z0-9][a-z0-9_-]*$' THEN RETURN NULL; END IF;
  SELECT p.id INTO v_store FROM public.profiles p
    WHERE p.store_slug = v_slug AND p.deleted_at IS NULL
      AND COALESCE(p.account_status, 'active') = 'active';
  IF v_store IS NULL THEN RETURN NULL; END IF;
  RETURN public._active_v2_store_hostname(v_store);
EXCEPTION WHEN others THEN RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public.resolve_store_preferred_hostname(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_store_preferred_hostname(text) TO anon, authenticated, service_role;
