-- Eligible-by-default custom domains with individual block; runs only in disposable local PostgreSQL.
\set ON_ERROR_STOP 1
CREATE FUNCTION pg_temp.ok(c boolean, label text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF c IS NOT TRUE THEN RAISE EXCEPTION 'FAIL: %', label; END IF; RAISE NOTICE 'ok  %', label; END $$;
CREATE FUNCTION pg_temp.err(q text, expected text, label text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN EXECUTE q; RAISE EXCEPTION 'FAIL (no error): %', label;
EXCEPTION WHEN others THEN
  IF SQLERRM LIKE 'FAIL%' THEN RAISE; END IF;
  IF position(expected in SQLERRM) = 0 THEN RAISE EXCEPTION 'FAIL: % (got %)', label, SQLERRM; END IF;
  RAISE NOTICE 'ok  % (%)', label, expected;
END $$;
CREATE FUNCTION pg_temp.as_user(u uuid) RETURNS void LANGUAGE sql AS $$ SELECT set_config('request.jwt.claim.sub', u::text, false) $$;

-- Stores: free, pro, premium, marca, blocked premium, AROMA pilot (marca), admin.
INSERT INTO profiles(id, store_slug) VALUES
 ('00000000-0000-4000-8000-000000000001','free'), ('00000000-0000-4000-8000-000000000002','pro'),
 ('00000000-0000-4000-8000-000000000003','premium'), ('00000000-0000-4000-8000-000000000004','marca'),
 ('00000000-0000-4000-8000-000000000005','blocked'), ('e599e99d-9156-4b8e-a5af-00b19ceec4c1','aroma'),
 ('00000000-0000-4000-8000-0000000000ad', NULL), ('00000000-0000-4000-8000-000000000006','premium2');
INSERT INTO user_roles(user_id, role) VALUES ('00000000-0000-4000-8000-0000000000ad','admin');
INSERT INTO _plan_stub VALUES ('00000000-0000-4000-8000-000000000002','pro'), ('00000000-0000-4000-8000-000000000003','premium'),
 ('00000000-0000-4000-8000-000000000004','marca'), ('00000000-0000-4000-8000-000000000005','premium'),
 ('e599e99d-9156-4b8e-a5af-00b19ceec4c1','marca'), ('00000000-0000-4000-8000-000000000006','premium');
INSERT INTO custom_domain_platform_config(id, feature_enabled, ingress_ready, infrastructure_provider, root_record_type, root_record_value,
  www_record_type, www_record_value, cloudflare_writes_enabled, cloudflare_deletes_enabled, protected_external_hostname_ids)
VALUES (true, true, true, 'cloudflare', 'A', NULL, 'CNAME', 'domains.shopdrive.com.br', true, false, ARRAY['fd3cd405-657e-4da7-a2ce-6424dc865670']);
INSERT INTO custom_domain_v2_access(store_id, enabled, pilot_hostname) VALUES
 ('e599e99d-9156-4b8e-a5af-00b19ceec4c1', true, 'www.redearoma.com.br'),
 ('00000000-0000-4000-8000-000000000005', false, NULL);
-- AROMA: fully active pilot binding (mirrors production shape).
INSERT INTO merchant_domains(merchant_id, domain, normalized_domain, flow_version, v2_state, is_active, ownership_verified_at, dns_verified_at,
  routing_status, ssl_status, activated_at, external_hostname_id, last_verification_result, status)
VALUES ('e599e99d-9156-4b8e-a5af-00b19ceec4c1','redearoma.com.br','redearoma.com.br',2,'active',true,now()-interval '1 day',now()-interval '1 day',
  'active','active',now()-interval '1 day','fd3cd405-657e-4da7-a2ce-6424dc865670','{"pilotHostname":"www.redearoma.com.br","root":"not_required","www":"ok"}','active');

-- A/B: entitlement and default allow
SELECT pg_temp.ok(NOT _custom_domain_store_eligible('00000000-0000-4000-8000-000000000001'), 'A free store is not eligible');
SELECT pg_temp.ok(NOT _custom_domain_store_eligible('00000000-0000-4000-8000-000000000002'), 'A pro store is not eligible');
SELECT pg_temp.ok(_custom_domain_store_eligible('00000000-0000-4000-8000-000000000003'), 'B premium without access row is eligible');
SELECT pg_temp.ok(_custom_domain_store_eligible('00000000-0000-4000-8000-000000000004'), 'B marca without access row is eligible');
SELECT pg_temp.ok(NOT _custom_domain_store_eligible('00000000-0000-4000-8000-000000000005'), 'C explicit block wins over premium');
SELECT pg_temp.ok(NOT _custom_domain_store_eligible('00000000-0000-4000-8000-0000000000ad'), 'store without slug is not eligible');
SELECT pg_temp.ok(NOT _custom_domain_store_eligible(NULL), 'null store is not eligible');
SELECT pg_temp.ok(_custom_domain_ui_available('00000000-0000-4000-8000-000000000003'), 'B premium sees the feature');
SELECT pg_temp.ok(NOT _custom_domain_ui_available('00000000-0000-4000-8000-000000000001'), 'A free does not see the feature');
SELECT pg_temp.ok(NOT _custom_domain_ui_available('00000000-0000-4000-8000-000000000005'), 'C blocked does not see the feature');
SELECT pg_temp.ok(_custom_domain_ui_available('e599e99d-9156-4b8e-a5af-00b19ceec4c1'), 'AROMA still sees its domain');

SELECT pg_temp.as_user('00000000-0000-4000-8000-000000000001');
SELECT pg_temp.ok(get_my_custom_domain_v2()->>'unavailable_reason' = 'plan', 'A free reason = plan');
SELECT pg_temp.err($$SELECT claim_custom_domain('lojafree.com.br')$$, 'feature_unavailable', 'A free cannot claim');
SELECT pg_temp.as_user('00000000-0000-4000-8000-000000000005');
SELECT pg_temp.ok(get_my_custom_domain_v2()->>'unavailable_reason' = 'blocked', 'C blocked reason = blocked');
SELECT pg_temp.err($$SELECT claim_custom_domain('lojablock.com.br')$$, 'feature_unavailable', 'C blocked cannot claim');
SELECT pg_temp.as_user('00000000-0000-4000-8000-000000000003');
SELECT pg_temp.ok(get_my_custom_domain_v2()->>'available' = 'true' AND get_my_custom_domain_v2()->'unavailable_reason' = 'null'::jsonb, 'B premium available');
SELECT pg_temp.ok((claim_custom_domain('LojaPremium.com.br')->>'domain') = 'lojapremium.com.br', 'B premium claims own domain');
SELECT pg_temp.ok(get_my_custom_domain_v2()->'domain'->>'display_hostname' = 'www.lojapremium.com.br', 'B CNAME-only shows the www hostname');
SELECT pg_temp.ok(jsonb_array_length(get_my_custom_domain_v2()->'records') = 2, 'B records listed (root without value is hidden by UI)');
SELECT pg_temp.err($$SELECT claim_custom_domain('www.redearoma.com.br')$$, 'domain_taken', 'B cannot take the AROMA domain');
SELECT pg_temp.as_user('00000000-0000-4000-8000-000000000006');
SELECT pg_temp.err($$SELECT claim_custom_domain('lojapremium.com.br')$$, 'domain_taken', 'another store cannot take a claimed domain');
SELECT pg_temp.as_user('e599e99d-9156-4b8e-a5af-00b19ceec4c1');
SELECT pg_temp.ok(get_my_custom_domain_v2()->'domain'->>'display_hostname' = 'www.redearoma.com.br', 'AROMA display hostname preserved');

-- Global flag off keeps everything closed for non-pilot stores
UPDATE custom_domain_platform_config SET feature_enabled = false;
SELECT pg_temp.ok(NOT _custom_domain_ui_available('00000000-0000-4000-8000-000000000003'), 'feature off hides the feature');
SELECT pg_temp.as_user('00000000-0000-4000-8000-000000000004');
SELECT pg_temp.err($$SELECT claim_custom_domain('lojamarca.com.br')$$, 'feature_unavailable', 'feature off blocks claim');
SELECT pg_temp.ok(get_my_custom_domain_v2()->>'unavailable_reason' = 'feature', 'feature off reason = feature');
UPDATE custom_domain_platform_config SET feature_enabled = true;

-- H: DNS application (CNAME-only scope is strict)
CREATE FUNCTION pg_temp.apply(actor uuid, r jsonb, st text) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE d merchant_domains; c custom_domain_platform_config; a custom_domain_v2_access;
BEGIN
  SELECT * INTO d FROM merchant_domains WHERE normalized_domain = 'lojapremium.com.br';
  SELECT * INTO c FROM custom_domain_platform_config; SELECT * INTO a FROM custom_domain_v2_access WHERE store_id = d.merchant_id;
  RETURN apply_custom_domain_verification(actor, d.id, d.updated_at, CASE WHEN a.store_id IS NULL THEN NULL ELSE to_jsonb(a) END, to_jsonb(c),
    r || jsonb_build_object('checkedAt', now(), 'nameservers', '[]'::jsonb, 'observed', '{"txt":1}'::jsonb), st, NULL);
END $$;
SELECT pg_temp.apply('00000000-0000-4000-8000-000000000003', '{"ownership":"verified","root":"not_required","www":"ok"}', 'dns_pending');
SELECT pg_temp.ok((SELECT dns_verified_at IS NULL FROM merchant_domains WHERE normalized_domain='lojapremium.com.br'), 'H root not_required without www-only scope never verifies DNS');
SELECT pg_temp.apply('00000000-0000-4000-8000-000000000003', '{"ownership":"already_verified","root":"not_required","www":"ok","wwwOnlyHostname":"www.outra.com.br"}', 'dns_pending');
SELECT pg_temp.ok((SELECT dns_verified_at IS NULL FROM merchant_domains WHERE normalized_domain='lojapremium.com.br'), 'H www-only scope for another domain never verifies DNS');
SELECT pg_temp.err($$SELECT pg_temp.apply('00000000-0000-4000-8000-000000000003', '{"ownership":"already_verified","root":"not_required","www":"ok","wwwOnlyHostname":"www.lojapremium.com.br"}', 'active')$$,
  'activation_not_authorized', 'H DNS alone cannot activate');
SELECT pg_temp.apply('00000000-0000-4000-8000-000000000003', '{"ownership":"already_verified","root":"not_required","www":"ok","wwwOnlyHostname":"www.lojapremium.com.br"}', 'dns_verified');
SELECT pg_temp.ok((SELECT dns_verified_at IS NOT NULL AND v2_state='dns_verified' AND NOT is_active FROM merchant_domains WHERE normalized_domain='lojapremium.com.br'), 'H exact www-only CNAME verifies DNS without activating');
SELECT pg_temp.err($$SELECT pg_temp.apply('00000000-0000-4000-8000-000000000006', '{"ownership":"already_verified","root":"not_required","www":"ok"}', 'dns_verified')$$, 'forbidden', 'H another merchant cannot apply');
UPDATE custom_domain_platform_config SET root_record_value = '203.0.113.10';
UPDATE merchant_domains SET dns_verified_at = NULL, v2_state = 'dns_pending' WHERE normalized_domain='lojapremium.com.br';
SELECT pg_temp.apply('00000000-0000-4000-8000-000000000003', '{"ownership":"already_verified","root":"not_required","www":"ok","wwwOnlyHostname":"www.lojapremium.com.br"}', 'dns_pending');
SELECT pg_temp.ok((SELECT dns_verified_at IS NULL FROM merchant_domains WHERE normalized_domain='lojapremium.com.br'), 'H www-only scope requires the platform to publish no apex target');
UPDATE custom_domain_platform_config SET root_record_value = NULL;
SELECT pg_temp.apply('00000000-0000-4000-8000-000000000003', '{"ownership":"already_verified","root":"not_required","www":"ok","wwwOnlyHostname":"www.lojapremium.com.br"}', 'dns_verified');
SELECT pg_temp.ok((SELECT dns_verified_at IS NOT NULL FROM merchant_domains WHERE normalized_domain='lojapremium.com.br'), 'H re-verified after apex target removed');
-- Non-admin verification of the pilot store is refused in the database too.
SELECT pg_temp.err($$SELECT apply_custom_domain_verification('e599e99d-9156-4b8e-a5af-00b19ceec4c1', d.id, d.updated_at, to_jsonb(a), to_jsonb(c),
   '{"ownership":"already_verified","root":"not_required","www":"ok"}'::jsonb || jsonb_build_object('checkedAt', now()), 'active', NULL)
   FROM merchant_domains d, custom_domain_v2_access a, custom_domain_platform_config c WHERE d.merchant_id = a.store_id AND a.store_id = 'e599e99d-9156-4b8e-a5af-00b19ceec4c1'$$,
  'feature_unavailable', 'AROMA merchant cannot re-verify its pilot domain');

-- J: provisioning completion stores the sanitized observation; only service-role may execute
SELECT complete_custom_domain_provisioning('00000000-0000-4000-8000-000000000003', d.id, d.updated_at, 'aaaaaaaa-1111-4111-8111-111111111111',
  'provisioning', 'pending', 'routing_provisioning', NULL, '{"hostname_status":"pending","ssl_status":"pending_validation"}')
  FROM merchant_domains d WHERE normalized_domain='lojapremium.com.br';
SELECT pg_temp.ok((SELECT external_observation->>'ssl_status' = 'pending_validation' AND external_hostname_id IS NOT NULL AND NOT is_active
  FROM merchant_domains WHERE normalized_domain='lojapremium.com.br'), 'J observation recorded, not active');
SELECT pg_temp.ok((SELECT details->'observation'->>'hostname_status' = 'pending' FROM domain_verification_logs WHERE verification_type='provision' ORDER BY created_at DESC LIMIT 1), 'J observation logged');
SELECT pg_temp.err($$SELECT complete_custom_domain_provisioning('00000000-0000-4000-8000-000000000003', d.id, d.updated_at, NULL, 'provisioning', 'pending', 'routing_provisioning', NULL, '"x"')
  FROM merchant_domains d WHERE normalized_domain='lojapremium.com.br'$$, 'invalid_observation', 'J non-object observation rejected');
SELECT pg_temp.err($$SELECT complete_custom_domain_provisioning('00000000-0000-4000-8000-000000000003', d.id, d.updated_at, 'bbbbbbbb-1111-4111-8111-111111111111', 'active', 'active', 'active', NULL, NULL)
  FROM merchant_domains d WHERE normalized_domain='lojapremium.com.br'$$, 'external_hostname_conflict', 'J external id cannot be swapped');
SELECT pg_temp.ok(NOT has_function_privilege('authenticated', 'public.complete_custom_domain_provisioning(uuid,uuid,timestamptz,text,text,text,text,text,jsonb)', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public._custom_domain_store_eligible(uuid)', 'EXECUTE')
  AND NOT has_function_privilege('authenticated', 'public.mark_custom_domain_removal_pending(uuid,uuid,timestamptz,text)', 'EXECUTE')
  AND has_function_privilege('service_role', 'public._custom_domain_store_eligible(uuid)', 'EXECUTE'), 'J service-only privileges');

-- F/G: activation and public resolution
SELECT complete_custom_domain_provisioning('00000000-0000-4000-8000-000000000003', d.id, d.updated_at, 'aaaaaaaa-1111-4111-8111-111111111111',
  'active', 'active', 'active', NULL, '{"hostname_status":"active","ssl_status":"active"}') FROM merchant_domains d WHERE normalized_domain='lojapremium.com.br';
SELECT pg_temp.ok((SELECT store_slug FROM resolve_public_store_by_domain('www.lojapremium.com.br')) = 'premium', 'F active premium domain resolves');
SELECT pg_temp.ok(_active_v2_store_hostname('00000000-0000-4000-8000-000000000003') = 'www.lojapremium.com.br', 'G public hostname is www');
SELECT pg_temp.ok((SELECT store_slug FROM resolve_public_store_by_domain('www.redearoma.com.br')) = 'aroma', 'AROMA www resolves');
SELECT pg_temp.ok(NOT EXISTS (SELECT 1 FROM resolve_public_store_by_domain('redearoma.com.br')), 'AROMA apex stays unresolved');
SELECT pg_temp.ok(_active_v2_store_hostname('e599e99d-9156-4b8e-a5af-00b19ceec4c1') = 'www.redearoma.com.br', 'AROMA public hostname preserved');
SELECT pg_temp.ok(NOT EXISTS (SELECT 1 FROM resolve_public_store_by_domain('www.desconhecido.com.br')), 'unknown domain refused');
UPDATE _plan_stub SET plan = 'pro' WHERE store = '00000000-0000-4000-8000-000000000003';
SELECT pg_temp.ok(NOT EXISTS (SELECT 1 FROM resolve_public_store_by_domain('www.lojapremium.com.br')) AND _active_v2_store_hostname('00000000-0000-4000-8000-000000000003') IS NULL, 'F losing the entitlement stops resolution');
UPDATE _plan_stub SET plan = 'premium' WHERE store = '00000000-0000-4000-8000-000000000003';
INSERT INTO custom_domain_v2_access(store_id, enabled) VALUES ('00000000-0000-4000-8000-000000000003', false);
SELECT pg_temp.ok(NOT EXISTS (SELECT 1 FROM resolve_public_store_by_domain('www.lojapremium.com.br')), 'C individual block stops resolution');
UPDATE custom_domain_v2_access SET enabled = true WHERE store_id = '00000000-0000-4000-8000-000000000003';
SELECT pg_temp.ok((SELECT store_slug FROM resolve_public_store_by_domain('www.lojapremium.com.br')) = 'premium', 'unblock restores resolution');
DELETE FROM custom_domain_v2_access WHERE store_id = '00000000-0000-4000-8000-000000000003';
UPDATE custom_domain_platform_config SET ingress_ready = false;
SELECT pg_temp.ok(NOT EXISTS (SELECT 1 FROM resolve_public_store_by_domain('www.lojapremium.com.br')), 'ingress off stops generic resolution');
SELECT pg_temp.ok((SELECT store_slug FROM resolve_public_store_by_domain('www.redearoma.com.br')) = 'aroma', 'AROMA unaffected by global flags');
UPDATE _plan_stub SET plan = 'free' WHERE store = 'e599e99d-9156-4b8e-a5af-00b19ceec4c1';
SELECT pg_temp.ok((SELECT store_slug FROM resolve_public_store_by_domain('www.redearoma.com.br')) = 'aroma', 'AROMA pilot branch independent of plan eligibility');
UPDATE _plan_stub SET plan = 'marca' WHERE store = 'e599e99d-9156-4b8e-a5af-00b19ceec4c1';
UPDATE custom_domain_platform_config SET ingress_ready = true;

-- Disconnect with external hostname: internal revoke then pending admin removal; claim cannot orphan it
UPDATE merchant_domains SET is_active = false, v2_state = 'inactive', routing_status = 'removing', updated_at = now() WHERE normalized_domain='lojapremium.com.br';
SELECT pg_temp.ok(NOT EXISTS (SELECT 1 FROM resolve_public_store_by_domain('www.lojapremium.com.br')), 'revoked domain no longer resolves');
SELECT pg_temp.err($$SELECT mark_custom_domain_removal_pending('00000000-0000-4000-8000-000000000003', d.id, d.updated_at, 'anything') FROM merchant_domains d WHERE normalized_domain='lojapremium.com.br'$$, 'invalid_reason', 'pending reason allow-list');
SELECT mark_custom_domain_removal_pending('00000000-0000-4000-8000-000000000003', d.id, d.updated_at, 'deletes_disabled') FROM merchant_domains d WHERE normalized_domain='lojapremium.com.br';
SELECT pg_temp.ok((SELECT external_error = 'external_removal_pending:deletes_disabled' AND external_hostname_id IS NOT NULL AND released_at IS NULL FROM merchant_domains WHERE normalized_domain='lojapremium.com.br'), 'pending admin removal recorded, external id kept');
SELECT pg_temp.as_user('00000000-0000-4000-8000-000000000003');
SELECT pg_temp.err($$SELECT claim_custom_domain('novo.com.br')$$, 'infrastructure_removal_pending', 'claim cannot orphan a pending external hostname');
SELECT pg_temp.as_user('00000000-0000-4000-8000-000000000006');
SELECT pg_temp.err($$SELECT claim_custom_domain('lojapremium.com.br')$$, 'domain_taken', 'pending removal keeps domain reserved');
SELECT pg_temp.ok((SELECT count(*) FROM merchant_domains WHERE external_hostname_id IS NOT NULL) = 2, 'no external hostname record lost');
\echo ALL ELIGIBILITY CHECKS PASSED
