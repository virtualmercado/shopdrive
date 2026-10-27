CREATE OR REPLACE FUNCTION public.apply_custom_domain_verification(
 p_actor uuid,p_domain_id uuid,p_expected_updated_at timestamptz,p_expected_access jsonb,
 p_expected_config jsonb,p_result jsonb,p_state text,p_pilot_hostname text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c public.custom_domain_platform_config; a public.custom_domain_v2_access; d public.merchant_domains;
 v_admin boolean; v_pilot boolean; v_generic boolean; v_dns boolean; v_owned boolean; v_at timestamptz; v_source text; v_preserve boolean;
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
 v_pilot := CASE WHEN p_pilot_hostname IS NULL THEN false ELSE COALESCE(v_admin AND a.enabled AND a.store_id=d.merchant_id AND a.pilot_hostname=p_pilot_hostname
   AND p_pilot_hostname=public.normalize_custom_domain_hostname(p_pilot_hostname)
   AND public.normalize_custom_domain(p_pilot_hostname)=d.normalized_domain,false) END;
 v_generic := COALESCE(a.enabled AND c.feature_enabled AND c.ingress_ready AND c.infrastructure_provider IS NOT NULL,false);
 IF p_pilot_hostname IS NOT NULL AND NOT v_pilot THEN RAISE EXCEPTION 'pilot_revoked' USING ERRCODE='42501'; END IF;
 IF NOT v_admin AND NOT COALESCE(a.enabled AND c.feature_enabled,false) THEN RAISE EXCEPTION 'feature_unavailable' USING ERRCODE='42501'; END IF;
 IF (p_result->>'pilotHostname') IS DISTINCT FROM p_pilot_hostname THEN RAISE EXCEPTION 'invalid_verification_scope' USING ERRCODE='22023'; END IF;
 v_dns := CASE WHEN v_pilot THEN p_result->>'root'='not_required' AND p_result->>'www'='ok'
   ELSE p_result->>'root'='ok' AND p_result->>'www'='ok' END;
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
END $$;
REVOKE ALL ON FUNCTION public.apply_custom_domain_verification(uuid,uuid,timestamptz,jsonb,jsonb,jsonb,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.apply_custom_domain_verification(uuid,uuid,timestamptz,jsonb,jsonb,jsonb,text,text) TO service_role;