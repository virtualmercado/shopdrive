-- Disposable local PostgreSQL only: global-ingress resolver and kill-switch rules (tests A/B/C/F).
BEGIN;
CREATE FUNCTION pg_temp.assert_rule(p_ok boolean,p_rule text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF p_ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL: %',p_rule; END IF; RAISE NOTICE 'PASS: %',p_rule; END $$;
ALTER TABLE public.custom_domain_v2_access ADD COLUMN pilot_hostname text;
INSERT INTO public.custom_domain_platform_config(id,feature_enabled,ingress_ready,infrastructure_provider) VALUES(true,false,false,'cloudflare');
SELECT pg_temp.assert_rule((SELECT NOT cloudflare_writes_enabled AND NOT cloudflare_deletes_enabled FROM public.custom_domain_platform_config),'F: kill switch defaults to no writes/deletes');
INSERT INTO public.profiles(id,store_slug) VALUES ('11111111-1111-4111-8111-111111111111','loja-ficticia-a'),('22222222-2222-4222-8222-222222222222','loja-ficticia-b');
INSERT INTO public.custom_domain_v2_access(store_id,enabled) VALUES('11111111-1111-4111-8111-111111111111',true),('22222222-2222-4222-8222-222222222222',true);
INSERT INTO public.merchant_domains(merchant_id,normalized_domain) VALUES
 ('11111111-1111-4111-8111-111111111111','loja-ficticia-a.example'),('22222222-2222-4222-8222-222222222222','loja-ficticia-b.example');
-- Even a forged row claiming an internal domain must never resolve.
INSERT INTO public.merchant_domains(merchant_id,normalized_domain) VALUES('22222222-2222-4222-8222-222222222222','shopdrive.com.br');
SELECT pg_temp.assert_rule((SELECT count(*)=0 FROM public.resolve_public_store_by_domain('www.loja-ficticia-a.example')),'global flags false: nothing resolves');
UPDATE public.custom_domain_platform_config SET feature_enabled=true;
SELECT pg_temp.assert_rule((SELECT count(*)=0 FROM public.resolve_public_store_by_domain('www.loja-ficticia-a.example')),'feature without ingress_ready: nothing resolves');
UPDATE public.custom_domain_platform_config SET ingress_ready=true;
SELECT pg_temp.assert_rule((SELECT count(*)=1 AND bool_and(store_id='11111111-1111-4111-8111-111111111111' AND store_slug='loja-ficticia-a') FROM public.resolve_public_store_by_domain('www.loja-ficticia-a.example')),'C: linked hostname resolves to its own store');
SELECT pg_temp.assert_rule((SELECT count(*)=1 AND bool_and(store_id='11111111-1111-4111-8111-111111111111') FROM public.resolve_public_store_by_domain('WWW.LOJA-FICTICIA-A.EXAMPLE.')),'C: deterministic after normalization');
SELECT pg_temp.assert_rule((SELECT count(*)=1 AND bool_and(store_id='22222222-2222-4222-8222-222222222222') FROM public.resolve_public_store_by_domain('www.loja-ficticia-b.example')),'C: second store isolated');
DO $$ DECLARE h text; BEGIN
  FOREACH h IN ARRAY ARRAY['shopdrive.com.br','www.shopdrive.com.br','domains.shopdrive.com.br','saas-origin.shopdrive.com.br',
    'virtualmercado.lovable.app','nkoogfznnqlnragbauez.supabase.co'] LOOP
    PERFORM pg_temp.assert_rule((SELECT count(*)=0 FROM public.resolve_public_store_by_domain(h)),'A: internal host not resolved '||h);
  END LOOP;
  FOREACH h IN ARRAY ARRAY['www.desconhecido-ficticio.example','desconhecido-ficticio.example','loja-ficticia-a.example.evil.example',
    'evil-loja-ficticia-a.example','','https://www.loja-ficticia-a.example/x'] LOOP
    PERFORM pg_temp.assert_rule((SELECT count(*)=0 FROM public.resolve_public_store_by_domain(h)),'B: unknown/invalid host resolves to no store '||h);
  END LOOP;
END $$;
SELECT pg_temp.assert_rule((SELECT count(*)=0 FROM public.resolve_public_store_by_domain(NULL)),'B: null host resolves to no store');
UPDATE public.custom_domain_v2_access SET enabled=false WHERE store_id='11111111-1111-4111-8111-111111111111';
SELECT pg_temp.assert_rule((SELECT count(*)=0 FROM public.resolve_public_store_by_domain('www.loja-ficticia-a.example')),'revoked store stops resolving immediately');
UPDATE public.custom_domain_platform_config SET feature_enabled=false, ingress_ready=false;
SELECT pg_temp.assert_rule((SELECT count(*)=0 FROM public.resolve_public_store_by_domain('www.loja-ficticia-b.example')),'rollback flags false: nothing resolves');
ROLLBACK;
