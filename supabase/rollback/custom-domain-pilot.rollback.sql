-- MANUAL ROLLBACK ONLY. Not executed. Restore the pre-pilot edge files BEFORE schema contraction.
-- All historical merchant_domains rows remain untouched.
BEGIN;
CREATE OR REPLACE FUNCTION public.resolve_public_store_by_domain(p_hostname text)
 RETURNS TABLE(store_id uuid, store_slug text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_norm text;
BEGIN
  BEGIN v_norm := public.normalize_custom_domain(p_hostname); EXCEPTION WHEN others THEN RETURN; END;
  RETURN QUERY SELECT p.id, p.store_slug FROM merchant_domains md JOIN profiles p ON p.id = md.merchant_id
   WHERE md.normalized_domain = v_norm AND md.flow_version = 2 AND md.released_at IS NULL AND md.v2_state = 'active'
     AND md.is_active AND NOT md.needs_reverification AND md.ownership_verified_at IS NOT NULL AND md.dns_verified_at IS NOT NULL
     AND md.routing_status = 'active' AND md.ssl_status = 'active' AND md.activated_at IS NOT NULL AND p.store_slug IS NOT NULL
     AND COALESCE((SELECT feature_enabled FROM custom_domain_platform_config WHERE id), false)
   LIMIT 1;
END $function$;
GRANT EXECUTE ON FUNCTION public.resolve_public_store_by_domain(text) TO PUBLIC,anon,authenticated,service_role;
DROP FUNCTION public.apply_custom_domain_verification(uuid,uuid,timestamptz,jsonb,jsonb,jsonb,text,text);
DROP FUNCTION public.admin_set_store_custom_domain_pilot(uuid,text);
ALTER TABLE public.custom_domain_v2_access DROP CONSTRAINT custom_domain_pilot_hostname_exact;
ALTER TABLE public.custom_domain_v2_access DROP COLUMN pilot_hostname;
DROP FUNCTION public.normalize_custom_domain_hostname(text);
COMMIT;
