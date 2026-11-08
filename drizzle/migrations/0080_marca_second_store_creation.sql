-- MARCA: owner-initiated creation of the second own store (slot 2) with durable, fenced idempotency.
-- Rollback: DROP the four functions and the request table; restore the previous link_origin CHECK (no existing row uses 'owner_created' before this feature).

ALTER TABLE public.brand_account_owned_stores DROP CONSTRAINT IF EXISTS brand_account_owned_stores_link_origin_check;
ALTER TABLE public.brand_account_owned_stores ADD CONSTRAINT brand_account_owned_stores_link_origin_check
  CHECK (link_origin IS NULL OR link_origin = ANY (ARRAY['owner_auto','admin_link','admin_clone','owner_created']));

CREATE TABLE public.marca_store_creation_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_account_id uuid NOT NULL REFERENCES public.brand_accounts(id) ON DELETE CASCADE,
  actor_id uuid NOT NULL,
  idempotency_key uuid NOT NULL,
  email_normalized text NOT NULL,
  owner_name text NOT NULL,
  store_name text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','completed','failed','abandoned')),
  attempt_token uuid NOT NULL DEFAULT gen_random_uuid(),
  lease_expires_at timestamptz NOT NULL DEFAULT now() + interval '10 minutes',
  store_id uuid,
  failure_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (actor_id, idempotency_key)
);
CREATE UNIQUE INDEX marca_store_creation_one_pending ON public.marca_store_creation_requests(brand_account_id) WHERE status = 'pending';
REVOKE ALL ON public.marca_store_creation_requests FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.marca_store_creation_requests TO service_role;
ALTER TABLE public.marca_store_creation_requests ENABLE ROW LEVEL SECURITY;
COMMENT ON TABLE public.marca_store_creation_requests IS 'Service-role only. One pending MARCA second-store creation per brand account; attempt_token fences retries.';

-- Brand account the actor may create a store for: sole direct MARCA owner with own primary slot.
CREATE OR REPLACE FUNCTION public._marca_creation_account(p_actor uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT b.id FROM brand_accounts b
  JOIN brand_account_owned_stores p ON p.brand_account_id = b.id AND p.slot = 1 AND p.store_role = 'primary' AND p.store_profile_id = b.owner_profile_id
  JOIN profiles pr ON pr.id = b.owner_profile_id
  WHERE p_actor IS NOT NULL AND b.owner_profile_id = p_actor
    AND pr.deleted_at IS NULL AND coalesce(pr.account_status,'active') = 'active'
    AND (SELECT count(*) FROM brand_accounts x WHERE x.owner_profile_id = p_actor) = 1
    AND get_effective_store_plan(p_actor)->>'plan' = 'marca'
    AND get_effective_store_plan(p_actor)->>'planSource' = 'direct'
  LIMIT 1
$$;
REVOKE ALL ON FUNCTION public._marca_creation_account(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._marca_creation_account(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public._marca_creation_user(p_request_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT u.id FROM auth.users u
  WHERE u.raw_user_meta_data->>'marca_store_request_id' = p_request_id::text
    AND NOT EXISTS (SELECT 1 FROM brand_account_owned_stores o WHERE o.store_profile_id = u.id)
  ORDER BY u.created_at LIMIT 1
$$;
REVOKE ALL ON FUNCTION public._marca_creation_user(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._marca_creation_user(uuid) TO service_role;

-- Merchant UI: slot state only (no identifiers of other accounts).
CREATE OR REPLACE FUNCTION public.get_my_marca_store_slots()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_acc uuid := _marca_creation_account(auth.uid()); v_used int := 0; v_pending boolean := false;
BEGIN
  IF v_acc IS NULL THEN RETURN jsonb_build_object('eligible',false,'used',0,'limit',2,'canCreate',false,'pending',false); END IF;
  SELECT count(*) INTO v_used FROM brand_account_owned_stores WHERE brand_account_id = v_acc;
  SELECT EXISTS (SELECT 1 FROM marca_store_creation_requests WHERE brand_account_id = v_acc AND status = 'pending' AND lease_expires_at > now()) INTO v_pending;
  RETURN jsonb_build_object('eligible',true,'used',v_used,'limit',2,'canCreate',v_used < 2,'pending',v_pending);
END $$;
REVOKE ALL ON FUNCTION public.get_my_marca_store_slots() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_marca_store_slots() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.begin_marca_second_store_creation(p_actor uuid, p_key uuid, p_email text, p_owner_name text, p_store_name text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_acc uuid; r marca_store_creation_requests; o marca_store_creation_requests; v_cleanup uuid;
  v_email text := lower(btrim(coalesce(p_email,'')));
  v_owner text := regexp_replace(btrim(coalesce(p_owner_name,'')), '\s+', ' ', 'g');
  v_store text := regexp_replace(btrim(coalesce(p_store_name,'')), '\s+', ' ', 'g');
BEGIN
  IF p_actor IS NULL OR p_key IS NULL THEN RAISE EXCEPTION 'invalid_request' USING ERRCODE='22023'; END IF;
  SELECT * INTO r FROM marca_store_creation_requests WHERE actor_id = p_actor AND idempotency_key = p_key;
  IF FOUND AND r.status = 'completed' THEN RETURN jsonb_build_object('state','completed','storeId',r.store_id); END IF;
  IF FOUND AND r.status IN ('failed','abandoned') THEN RETURN jsonb_build_object('state','failed','code',coalesce(r.failure_code,'failed')); END IF;

  v_acc := _marca_creation_account(p_actor);
  IF v_acc IS NULL THEN RETURN jsonb_build_object('state','ineligible'); END IF;
  BEGIN PERFORM _marca_assert_owner_eligible(p_actor);
  EXCEPTION WHEN others THEN RETURN jsonb_build_object('state','ineligible'); END;

  -- Serialise every creation attempt of this brand account.
  PERFORM 1 FROM brand_accounts WHERE id = v_acc FOR UPDATE;
  SELECT * INTO r FROM marca_store_creation_requests WHERE actor_id = p_actor AND idempotency_key = p_key FOR UPDATE;
  IF FOUND AND r.status = 'completed' THEN RETURN jsonb_build_object('state','completed','storeId',r.store_id); END IF;
  IF FOUND AND r.status <> 'pending' THEN RETURN jsonb_build_object('state','failed','code',coalesce(r.failure_code,'failed')); END IF;

  IF (SELECT count(*) FROM brand_account_owned_stores WHERE brand_account_id = v_acc) >= 2 THEN
    UPDATE marca_store_creation_requests SET status='failed', failure_code='limit_reached', updated_at=now()
      WHERE brand_account_id = v_acc AND status = 'pending';
    RETURN jsonb_build_object('state','limit_reached');
  END IF;

  SELECT * INTO o FROM marca_store_creation_requests
    WHERE brand_account_id = v_acc AND status = 'pending' AND (r.id IS NULL OR id <> r.id) FOR UPDATE;
  IF FOUND THEN
    IF o.lease_expires_at > now() THEN RETURN jsonb_build_object('state','in_progress'); END IF;
    -- Expired attempt: fence it out and hand its unlinked owner account (if any) to the caller for removal.
    v_cleanup := _marca_creation_user(o.id);
    UPDATE marca_store_creation_requests SET status='abandoned', failure_code='lease_expired', attempt_token=gen_random_uuid(), updated_at=now() WHERE id = o.id;
  END IF;

  IF r.id IS NOT NULL THEN
    IF r.lease_expires_at > now() THEN RETURN jsonb_build_object('state','in_progress'); END IF;
    UPDATE marca_store_creation_requests SET attempt_token=gen_random_uuid(), lease_expires_at=now()+interval '10 minutes', updated_at=now()
      WHERE id = r.id RETURNING * INTO r;
    RETURN jsonb_build_object('state','claimed','requestId',r.id,'attemptToken',r.attempt_token,'email',r.email_normalized,
      'ownerName',r.owner_name,'storeName',r.store_name,'existingUserId',_marca_creation_user(r.id),'cleanupUserId',v_cleanup);
  END IF;

  IF length(v_email) > 255 OR v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' THEN RETURN jsonb_build_object('state','invalid_input','field','email'); END IF;
  IF length(v_owner) < 3 OR length(v_owner) > 100 OR v_owner ~ '[<>[:cntrl:]]' THEN RETURN jsonb_build_object('state','invalid_input','field','ownerName'); END IF;
  IF length(v_store) < 3 OR length(v_store) > 100 OR v_store ~ '[<>[:cntrl:]]' THEN RETURN jsonb_build_object('state','invalid_input','field','storeName'); END IF;
  IF EXISTS (SELECT 1 FROM auth.users WHERE lower(email) = v_email) THEN
    RETURN jsonb_build_object('state','email_unavailable','cleanupUserId',v_cleanup);
  END IF;

  INSERT INTO marca_store_creation_requests(brand_account_id, actor_id, idempotency_key, email_normalized, owner_name, store_name)
  VALUES (v_acc, p_actor, p_key, v_email, v_owner, v_store) RETURNING * INTO r;
  RETURN jsonb_build_object('state','claimed','requestId',r.id,'attemptToken',r.attempt_token,'email',r.email_normalized,
    'ownerName',r.owner_name,'storeName',r.store_name,'existingUserId',NULL,'cleanupUserId',v_cleanup);
END $$;
REVOKE ALL ON FUNCTION public.begin_marca_second_store_creation(uuid,uuid,text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.begin_marca_second_store_creation(uuid,uuid,text,text,text) TO service_role;

-- Atomic link: slot 2 + approved administrator membership in the published per-store model, or nothing.
CREATE OR REPLACE FUNCTION public.complete_marca_second_store_creation(p_request_id uuid, p_attempt_token uuid, p_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE r marca_store_creation_requests; v_owner uuid; v_user uuid; v_email text; v_meta text; p profiles;
BEGIN
  SELECT * INTO r FROM marca_store_creation_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND OR r.status <> 'pending' OR r.attempt_token <> p_attempt_token THEN RAISE EXCEPTION 'request_superseded' USING ERRCODE='P0001'; END IF;
  SELECT owner_profile_id INTO v_owner FROM brand_accounts WHERE id = r.brand_account_id FOR UPDATE;
  IF v_owner IS DISTINCT FROM r.actor_id OR _marca_creation_account(r.actor_id) IS DISTINCT FROM r.brand_account_id THEN
    RAISE EXCEPTION 'ineligible' USING ERRCODE='42501'; END IF;
  SELECT u.id, lower(u.email), u.raw_user_meta_data->>'marca_store_request_id' INTO v_user, v_email, v_meta
    FROM auth.users u WHERE u.id = coalesce(p_user_id, _marca_creation_user(r.id));
  IF v_user IS NULL OR v_user = r.actor_id OR v_meta IS DISTINCT FROM r.id::text OR v_email IS DISTINCT FROM r.email_normalized THEN
    RAISE EXCEPTION 'owner_mismatch' USING ERRCODE='P0001'; END IF;
  SELECT * INTO p FROM profiles WHERE id = v_user;
  IF NOT FOUND OR p.store_slug IS NULL THEN RAISE EXCEPTION 'store_not_provisioned' USING ERRCODE='P0001'; END IF;
  IF EXISTS (SELECT 1 FROM brand_account_owned_stores WHERE brand_account_id = r.brand_account_id AND slot = 2) THEN
    RAISE EXCEPTION 'limit_reached' USING ERRCODE='P0001'; END IF;

  INSERT INTO brand_account_owned_stores(brand_account_id, store_profile_id, slot, store_role, link_origin, created_by)
  VALUES (r.brand_account_id, v_user, 2, 'secondary', 'owner_created', r.actor_id);
  INSERT INTO merchant_store_memberships(user_id, store_id, active, authorization_approved, created_by)
  VALUES (r.actor_id, v_user, true, true, r.actor_id);
  PERFORM propagate_brand_plan_to_secondaries(r.actor_id);
  INSERT INTO audit_logs(user_id, action, entity_type, entity_id, metadata)
  VALUES (r.actor_id, 'MARCA_SECOND_STORE_CREATED', 'brand_account', r.brand_account_id,
          jsonb_build_object('store_profile_id', v_user, 'slot', 2, 'request_id', r.id));
  UPDATE marca_store_creation_requests SET status='completed', store_id=v_user, updated_at=now() WHERE id = r.id;
  RETURN jsonb_build_object('storeId', v_user, 'storeSlug', p.store_slug, 'storeName', p.store_name);
END $$;
REVOKE ALL ON FUNCTION public.complete_marca_second_store_creation(uuid,uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_marca_second_store_creation(uuid,uuid,uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.fail_marca_second_store_creation(p_request_id uuid, p_attempt_token uuid, p_code text)
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $$
  WITH u AS (UPDATE marca_store_creation_requests SET status='failed', failure_code=left(coalesce(p_code,'failed'),64), updated_at=now()
             WHERE id = p_request_id AND attempt_token = p_attempt_token AND status = 'pending' RETURNING 1)
  SELECT EXISTS (SELECT 1 FROM u)
$$;
REVOKE ALL ON FUNCTION public.fail_marca_second_store_creation(uuid,uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fail_marca_second_store_creation(uuid,uuid,text) TO service_role;