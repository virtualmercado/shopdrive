-- Run only after the fixture, captured production helper definitions and candidate migration in a disposable local cluster.
BEGIN;
CREATE FUNCTION pg_temp.assert_rule(p_ok boolean,p_rule text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF p_ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL: %',p_rule; END IF; RAISE NOTICE 'PASS: %',p_rule; END $$;
INSERT INTO public.profiles(id,store_slug) VALUES
 ('11111111-1111-4111-8111-111111111111','pilot-fixture'),('22222222-2222-4222-8222-222222222222','other-fixture');
INSERT INTO public.custom_domain_platform_config(id,feature_enabled,ingress_ready) VALUES(true,false,false);
INSERT INTO public.merchant_domains(merchant_id,normalized_domain) VALUES('11111111-1111-4111-8111-111111111111','redearoma.com.br');
SELECT pg_temp.assert_rule((SELECT count(*)=0 FROM public.resolve_public_store_by_domain('www.redearoma.com.br')),'feature false + no access');
INSERT INTO public.custom_domain_v2_access(store_id,enabled) VALUES('11111111-1111-4111-8111-111111111111',true);
SELECT pg_temp.assert_rule((SELECT count(*)=0 FROM public.resolve_public_store_by_domain('www.redearoma.com.br')),'enabled alone never bypasses global gate');
UPDATE public.custom_domain_v2_access SET pilot_hostname='www.redearoma.com.br';
SELECT pg_temp.assert_rule((SELECT count(*)=1 AND bool_and(store_id='11111111-1111-4111-8111-111111111111') FROM public.resolve_public_store_by_domain('www.redearoma.com.br')),'exact host + same merchant + false global flags');
SELECT pg_temp.assert_rule((SELECT count(*)=1 FROM public.resolve_public_store_by_domain('WWW.REDEAROMA.COM.BR.')),'case and final dot equivalence');
SELECT pg_temp.assert_rule((SELECT count(*)=0 FROM public.resolve_public_store_by_domain('redearoma.com.br')),'apex never inherits www pilot');
SELECT pg_temp.assert_rule((SELECT count(*)=0 FROM public.resolve_public_store_by_domain('loja.redearoma.com.br')),'other subdomain denied');
SELECT pg_temp.assert_rule((SELECT count(*)=0 FROM public.resolve_public_store_by_domain('www2.redearoma.com.br')),'www2 denied');
UPDATE public.merchant_domains SET merchant_id='22222222-2222-4222-8222-222222222222';
SELECT pg_temp.assert_rule((SELECT count(*)=0 FROM public.resolve_public_store_by_domain('www.redearoma.com.br')),'correct host wrong domain merchant denied');
UPDATE public.merchant_domains SET merchant_id='11111111-1111-4111-8111-111111111111';
UPDATE public.custom_domain_v2_access SET pilot_hostname=NULL;
SELECT pg_temp.assert_rule((SELECT count(*)=0 FROM public.resolve_public_store_by_domain('www.redearoma.com.br')),'revocation immediate in next query');
UPDATE public.custom_domain_v2_access SET pilot_hostname='www.redearoma.com.br',enabled=false;
SELECT pg_temp.assert_rule((SELECT count(*)=0 FROM public.resolve_public_store_by_domain('www.redearoma.com.br')),'disabled access blocks active domain');
UPDATE public.custom_domain_v2_access SET enabled=true;
DO $$
DECLARE rule text; patch text;
BEGIN
  FOR rule,patch IN SELECT * FROM (VALUES
   ('ownership missing','ownership_verified_at=NULL'),('DNS missing','dns_verified_at=NULL'),
   ('routing pending','routing_status=''provisioning'''),('SSL pending','ssl_status=''pending'''),
   ('inactive flag','is_active=false'),('inactive state','v2_state=''inactive'''),('released','released_at=now()'),
   ('reverification','needs_reverification=true'),('activation missing','activated_at=NULL'),('legacy V1','flow_version=1'),
   ('ownership future','ownership_verified_at=now()+interval ''1 day'''),('DNS future','dns_verified_at=now()+interval ''1 day'''),
   ('activation future','activated_at=now()+interval ''1 day''')) x(rule,patch)
  LOOP
   EXECUTE 'UPDATE public.merchant_domains SET '||patch;
   PERFORM pg_temp.assert_rule((SELECT count(*)=0 FROM public.resolve_public_store_by_domain('www.redearoma.com.br')),rule);
   UPDATE public.merchant_domains SET flow_version=2,released_at=NULL,v2_state='active',is_active=true,needs_reverification=false,
    ownership_verified_at=now(),dns_verified_at=now(),routing_status='active',ssl_status='active',activated_at=now();
  END LOOP;
END $$;
UPDATE public.profiles SET deleted_at=now() WHERE store_slug='pilot-fixture';
SELECT pg_temp.assert_rule((SELECT count(*)=0 FROM public.resolve_public_store_by_domain('www.redearoma.com.br')),'deleted profile denied');
UPDATE public.profiles SET deleted_at=NULL,account_status='suspended' WHERE store_slug='pilot-fixture';
SELECT pg_temp.assert_rule((SELECT count(*)=0 FROM public.resolve_public_store_by_domain('www.redearoma.com.br')),'suspended profile denied');
UPDATE public.profiles SET account_status='active',store_slug='' WHERE id='11111111-1111-4111-8111-111111111111';
SELECT pg_temp.assert_rule((SELECT count(*)=0 FROM public.resolve_public_store_by_domain('www.redearoma.com.br')),'empty slug denied');
UPDATE public.profiles SET store_slug='pilot-fixture' WHERE id='11111111-1111-4111-8111-111111111111';
-- Feature=true scenarios change LOCAL fixtures only; production feature remains false throughout.
UPDATE public.custom_domain_platform_config SET feature_enabled=true;
UPDATE public.custom_domain_v2_access SET enabled=false,pilot_hostname=NULL;
SELECT pg_temp.assert_rule((SELECT count(*)=0 FROM public.resolve_public_store_by_domain('www.redearoma.com.br')),'future global release still requires access');
UPDATE public.custom_domain_v2_access SET enabled=true;
SELECT pg_temp.assert_rule((SELECT count(*)=0 FROM public.resolve_public_store_by_domain('www.redearoma.com.br')),'generic release requires generic ingress');
UPDATE public.custom_domain_platform_config SET ingress_ready=true,infrastructure_provider='local-fixture';
SELECT pg_temp.assert_rule((SELECT count(*)=1 FROM public.resolve_public_store_by_domain('www.redearoma.com.br')),'future full generic release works');
SELECT pg_temp.assert_rule((SELECT count(*)=1 FROM public.resolve_public_store_by_domain('redearoma.com.br')),'generic canonical root+www preserved');
UPDATE public.custom_domain_v2_access SET pilot_hostname='www.redearoma.com.br';
UPDATE public.merchant_domains SET last_verification_result='{"pilotHostname":"www.redearoma.com.br"}';
SELECT pg_temp.assert_rule((SELECT count(*)=0 FROM public.resolve_public_store_by_domain('redearoma.com.br')),'pilot-only DNS does not widen on later global release');
UPDATE public.custom_domain_v2_access SET pilot_hostname=NULL;
SELECT pg_temp.assert_rule((SELECT count(*)=0 FROM public.resolve_public_store_by_domain('redearoma.com.br')),'removing pilot does not convert pilot DNS to root DNS');
SELECT pg_temp.assert_rule((SELECT count(*)=0 FROM public.resolve_public_store_by_domain('www.redearoma.com.br')),'removing pilot blocks verified pilot even after future global release');
UPDATE public.custom_domain_v2_access SET pilot_hostname='www.redearoma.com.br';
UPDATE public.custom_domain_platform_config SET feature_enabled=false,ingress_ready=false,infrastructure_provider=NULL;
SELECT pg_temp.assert_rule((SELECT count(*)=0 FROM public.resolve_public_store_by_domain('https://www.redearoma.com.br')),'URL is not browser hostname');
SELECT pg_temp.assert_rule((SELECT count(*)=0 FROM public.resolve_public_store_by_domain('www.redearoma.com.br?store=pilot-fixture')),'query cannot choose store');
SELECT pg_temp.assert_rule((SELECT count(*)=0 FROM public.resolve_public_store_by_domain('www.redearoma.com.br/pilot-fixture')),'path cannot choose store');
SELECT pg_temp.assert_rule((SELECT count(*)=0 FROM public.resolve_public_store_by_domain('www.redearoma.com.br:443')),'port input denied');
SELECT pg_temp.assert_rule((SELECT count(*)=0 FROM public.resolve_public_store_by_domain(NULL)),'missing hostname denied');
INSERT INTO public.custom_domain_v2_access(store_id,enabled,pilot_hostname) VALUES('22222222-2222-4222-8222-222222222222',true,'www.outraloja.com.br');
INSERT INTO public.merchant_domains(merchant_id,normalized_domain) VALUES('22222222-2222-4222-8222-222222222222','outraloja.com.br');
SELECT pg_temp.assert_rule((SELECT count(*)=1 AND bool_and(store_id='22222222-2222-4222-8222-222222222222') FROM public.resolve_public_store_by_domain('www.outraloja.com.br')),'other domain returns only other store');
DO $$ BEGIN
 BEGIN INSERT INTO public.merchant_domains(merchant_id,normalized_domain) VALUES('22222222-2222-4222-8222-222222222222','redearoma.com.br');
 RAISE EXCEPTION 'unique canonical claim was not enforced'; EXCEPTION WHEN unique_violation THEN RAISE NOTICE 'PASS: canonical unique index preserved'; END;
END $$;
DROP INDEX public.merchant_domains_normalized_domain_unique; -- local corruption scenario only
INSERT INTO public.merchant_domains(merchant_id,normalized_domain) VALUES('22222222-2222-4222-8222-222222222222','redearoma.com.br');
SELECT pg_temp.assert_rule((SELECT count(*)=0 FROM public.resolve_public_store_by_domain('www.redearoma.com.br')),'unexpected duplicate fails closed');
DELETE FROM public.merchant_domains WHERE merchant_id='22222222-2222-4222-8222-222222222222' AND normalized_domain='redearoma.com.br';
CREATE UNIQUE INDEX merchant_domains_normalized_domain_unique ON public.merchant_domains(normalized_domain) WHERE normalized_domain IS NOT NULL AND released_at IS NULL;
SET LOCAL ROLE anon;
SELECT pg_temp.assert_rule((SELECT count(*)=1 FROM public.resolve_public_store_by_domain('www.redearoma.com.br')),'anon can resolve only eligible identity');
DO $$ BEGIN
 BEGIN PERFORM public.admin_set_store_custom_domain_pilot('11111111-1111-4111-8111-111111111111',NULL);
 RAISE EXCEPTION 'anon authorized pilot'; EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'PASS: anon pilot RPC blocked'; END;
 BEGIN PERFORM * FROM public.custom_domain_v2_access; RAISE EXCEPTION 'anon read internal access';
 EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'PASS: anon internal reads blocked'; END;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
SET LOCAL ROLE authenticated;
SELECT pg_temp.assert_rule((SELECT count(*)=0 FROM public.custom_domain_v2_access),'ordinary merchant cannot read pilot authorization');
DO $$ BEGIN
 BEGIN PERFORM public.admin_set_store_custom_domain_pilot('11111111-1111-4111-8111-111111111111',NULL);
 RAISE EXCEPTION 'merchant authorized pilot'; EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'PASS: ordinary merchant pilot RPC blocked'; END;
 BEGIN UPDATE public.custom_domain_v2_access SET pilot_hostname=NULL; RAISE EXCEPTION 'merchant wrote access directly';
 EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'PASS: merchant direct access write blocked'; END;
END $$;
RESET ROLE;
INSERT INTO public.user_roles(user_id,role) VALUES('22222222-2222-4222-8222-222222222222','admin');
SET LOCAL ROLE authenticated;
SELECT public.admin_set_store_custom_domain_pilot('11111111-1111-4111-8111-111111111111',NULL);
SELECT pg_temp.assert_rule((SELECT count(*)=0 FROM public.resolve_public_store_by_domain('www.redearoma.com.br')),'admin removal immediately revokes');
SELECT public.admin_set_store_custom_domain_pilot('11111111-1111-4111-8111-111111111111','WWW.REDEAROMA.COM.BR.');
SELECT pg_temp.assert_rule((SELECT enabled AND pilot_hostname='www.redearoma.com.br' FROM public.custom_domain_v2_access WHERE store_id='11111111-1111-4111-8111-111111111111'),'admin setter preserves existing enabled state');
SELECT public.admin_set_store_custom_domains_v2('11111111-1111-4111-8111-111111111111',false);
SELECT pg_temp.assert_rule((SELECT count(*)=0 FROM public.resolve_public_store_by_domain('www.redearoma.com.br')),'existing admin enabled RPC revokes pilot too');
RESET ROLE;
SELECT pg_temp.assert_rule((SELECT count(*)=2 FROM public.audit_logs WHERE action='custom_domain_pilot_set'),'pilot modifications audit actor and target');
UPDATE public.profiles SET account_status='suspended' WHERE id='11111111-1111-4111-8111-111111111111';
SET LOCAL ROLE authenticated;
SELECT public.admin_set_store_custom_domain_pilot('11111111-1111-4111-8111-111111111111',NULL);
SELECT pg_temp.assert_rule((SELECT pilot_hostname IS NULL FROM public.custom_domain_v2_access WHERE store_id='11111111-1111-4111-8111-111111111111'),'admin can revoke suspended store');
RESET ROLE;
UPDATE public.profiles SET account_status='active' WHERE id='11111111-1111-4111-8111-111111111111';
UPDATE public.custom_domain_v2_access SET enabled=true,pilot_hostname='www.redearoma.com.br' WHERE store_id='11111111-1111-4111-8111-111111111111';
DO $$
DECLARE cfg jsonb; acc jsonb; domain_id uuid; stamp timestamptz; result jsonb; saved jsonb;
BEGIN
 SELECT to_jsonb(c) INTO cfg FROM public.custom_domain_platform_config c;
 SELECT to_jsonb(a) INTO acc FROM public.custom_domain_v2_access a WHERE store_id='11111111-1111-4111-8111-111111111111';
 SELECT id,updated_at INTO domain_id,stamp FROM public.merchant_domains WHERE merchant_id='11111111-1111-4111-8111-111111111111';
 result:=jsonb_build_object('checkedAt',now(),'ownership','verified','root','not_required','www','ok','pilotHostname','www.redearoma.com.br',
 'nameservers',jsonb_build_array('romina.ns.cloudflare.com'),'provider',jsonb_build_object('slug','cloudflare'),'observed',jsonb_build_object('txt',1),'notes',jsonb_build_array('exact_pilot_hostname'));
 UPDATE public.custom_domain_v2_access SET enabled=false WHERE store_id='11111111-1111-4111-8111-111111111111';
 BEGIN
  PERFORM public.apply_custom_domain_verification('22222222-2222-4222-8222-222222222222',domain_id,stamp,acc,cfg,result,'active','www.redearoma.com.br');
  RAISE EXCEPTION 'revoked observation accepted';
 EXCEPTION WHEN serialization_failure THEN RAISE NOTICE 'PASS: stale access snapshot cannot save verification'; END;
 PERFORM pg_temp.assert_rule((SELECT count(*)=0 FROM public.domain_verification_logs),'stale snapshot writes no logs');
 UPDATE public.custom_domain_v2_access SET enabled=true WHERE store_id='11111111-1111-4111-8111-111111111111';
 SELECT to_jsonb(a) INTO acc FROM public.custom_domain_v2_access a WHERE store_id='11111111-1111-4111-8111-111111111111';
 saved:=public.apply_custom_domain_verification('22222222-2222-4222-8222-222222222222',domain_id,stamp,acc,cfg,result,'active','www.redearoma.com.br');
 PERFORM pg_temp.assert_rule(saved->>'state'='active','transactional exact-pilot verification saves');
 PERFORM pg_temp.assert_rule((SELECT count(*)=3 FROM public.domain_verification_logs),'verification and three logs saved together');
 PERFORM pg_temp.assert_rule((SELECT NOT dns_a_verified AND dns_cname_verified AND last_verification_result->>'pilotHostname'='www.redearoma.com.br' FROM public.merchant_domains WHERE id=domain_id),'pilot DNS never claims apex A verified');
 BEGIN
  PERFORM public.apply_custom_domain_verification('22222222-2222-4222-8222-222222222222',domain_id,stamp-interval '1 second',acc,cfg,result,'active','www.redearoma.com.br');
  RAISE EXCEPTION 'stale domain accepted';
 EXCEPTION WHEN serialization_failure THEN RAISE NOTICE 'PASS: stale domain snapshot rejected'; END;
END $$;
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 BEGIN PERFORM public.apply_custom_domain_verification(NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL);
 RAISE EXCEPTION 'client applied DNS'; EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'PASS: verification apply restricted to service role'; END;
END $$;
RESET ROLE;
SELECT pg_temp.assert_rule((SELECT NOT feature_enabled AND NOT ingress_ready FROM public.custom_domain_platform_config),'local false flags restored');
ROLLBACK;