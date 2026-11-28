-- PROPOSAL ONLY: Phase 5.1 focused review. Await final SQL approval before application.
-- No external execution, no changes to commercial clients or store_charges.
ALTER TABLE public.store_asaas_accounts
  ADD CONSTRAINT store_asaas_accounts_id_store_env_key UNIQUE (id, store_id, environment);
ALTER TABLE public.store_asaas_customers
  ADD COLUMN store_asaas_account_id uuid,
  ADD COLUMN external_reference text NOT NULL DEFAULT ('sd_customer_' || gen_random_uuid()::text),
  ADD COLUMN reservation_state text NOT NULL DEFAULT 'reserved',
  ADD COLUMN attempt_token uuid,
  ADD COLUMN lease_expires_at timestamptz,
  ADD COLUMN send_started_at timestamptz,
  ADD COLUMN last_error_code text;
UPDATE public.store_asaas_customers c
SET store_asaas_account_id = a.id, reservation_state = 'linked'
FROM public.store_asaas_accounts a
WHERE a.store_id = c.store_id AND a.environment = c.environment;
-- Validate all historical mappings before making the subaccount mandatory.
-- Abort rather than fabricate a link, delete history or silently skip an orphan.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.store_asaas_customers WHERE store_asaas_account_id IS NULL) THEN
    RAISE EXCEPTION 'ASAAS_CUSTOMER_UNRESOLVED_ACCOUNT';
  END IF;
END; $$;
ALTER TABLE public.store_asaas_customers ALTER COLUMN store_asaas_account_id SET NOT NULL;
-- Never invent an external customer ID for a pre-send reservation.
-- This reviewed lifecycle change still requires explicit final migration approval.
ALTER TABLE public.store_asaas_customers ALTER COLUMN asaas_customer_id DROP NOT NULL;
ALTER TABLE public.store_asaas_customers DROP CONSTRAINT store_asaas_customers_asaas_id_check;
ALTER TABLE public.store_asaas_customers
  ADD CONSTRAINT store_asaas_customers_account_tenant_fkey
    FOREIGN KEY (store_asaas_account_id, store_id, environment)
    REFERENCES public.store_asaas_accounts(id, store_id, environment) ON DELETE RESTRICT,
  ADD CONSTRAINT store_asaas_customers_reference_key UNIQUE (external_reference),
  ADD CONSTRAINT store_asaas_customers_reference_check CHECK (
    external_reference ~ '^sd_customer_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'),
  ADD CONSTRAINT store_asaas_customers_lifecycle_check CHECK (
    (reservation_state = 'linked' AND nullif(btrim(asaas_customer_id), '') IS NOT NULL)
    OR (reservation_state IN ('reserved','sending','unknown','blocked') AND asaas_customer_id IS NULL)),
  ADD CONSTRAINT store_asaas_customers_attempt_check CHECK (
    reservation_state NOT IN ('reserved','sending','unknown') OR
    (attempt_token IS NOT NULL AND lease_expires_at IS NOT NULL)),
  ADD CONSTRAINT store_asaas_customers_send_check CHECK (
    reservation_state NOT IN ('sending','unknown') OR send_started_at IS NOT NULL),
  ADD CONSTRAINT store_asaas_customers_error_check CHECK (
    last_error_code IS NULL OR last_error_code IN ('RESULT_UNKNOWN','IDENTITY_CONFLICT','MULTIPLE_MATCHES','NO_MATCH','PERSISTENCE_FAILED'));
CREATE INDEX idx_store_asaas_customers_account ON public.store_asaas_customers(store_asaas_account_id);
CREATE UNIQUE INDEX idx_store_asaas_customers_external_id_global ON public.store_asaas_customers(asaas_customer_id)
  WHERE asaas_customer_id IS NOT NULL;
CREATE UNIQUE INDEX idx_store_asaas_customers_attempt ON public.store_asaas_customers(attempt_token)
  WHERE attempt_token IS NOT NULL;
REVOKE ALL ON public.store_asaas_customers FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.store_asaas_customers TO service_role;

CREATE FUNCTION public._guard_asaas_customer_identity() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.store_asaas_account_id IS NULL THEN
    RAISE EXCEPTION 'ASAAS_CUSTOMER_ACCOUNT_REQUIRED' USING ERRCODE = '22023';
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF ROW(NEW.id,NEW.store_id,NEW.environment,NEW.store_asaas_account_id,NEW.external_reference,NEW.cpf_cnpj_normalized)
       IS DISTINCT FROM ROW(OLD.id,OLD.store_id,OLD.environment,OLD.store_asaas_account_id,OLD.external_reference,OLD.cpf_cnpj_normalized)
       OR (OLD.asaas_customer_id IS NOT NULL AND NEW.asaas_customer_id IS DISTINCT FROM OLD.asaas_customer_id)
       OR (OLD.send_started_at IS NOT NULL AND NEW.send_started_at IS DISTINCT FROM OLD.send_started_at)
       OR (OLD.reservation_state = 'linked' AND NEW.reservation_state <> 'linked') THEN
      RAISE EXCEPTION 'ASAAS_CUSTOMER_IDENTITY_IMMUTABLE' USING ERRCODE = '22023';
    END IF;
    IF NEW.customer_profile_id IS DISTINCT FROM OLD.customer_profile_id THEN
      -- Only the FK's legitimate ON DELETE SET NULL path is allowed: its old
      -- commercial profile has actually been deleted in this transaction.
      -- No manual unlink of an existing profile, NULL->profile, or reassignment.
      IF OLD.customer_profile_id IS NULL OR NEW.customer_profile_id IS NOT NULL
        OR EXISTS (SELECT 1 FROM public.customer_profiles WHERE id=OLD.customer_profile_id) THEN
        RAISE EXCEPTION 'ASAAS_CUSTOMER_PROFILE_REASSIGNMENT_BLOCKED' USING ERRCODE='22023';
      END IF;
    END IF;
  ELSIF NEW.customer_profile_id IS NOT NULL THEN
    -- Reuse the existing store_customers tenant link, not browser input or
    -- registered_store_id. Lock profile first for safe concurrent deletion.
    PERFORM 1 FROM public.customer_profiles WHERE id=NEW.customer_profile_id FOR KEY SHARE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'ASAAS_CUSTOMER_COMMERCIAL_SCOPE_BLOCKED' USING ERRCODE='42501';
    END IF;
    PERFORM 1 FROM public.store_customers
      WHERE customer_id=NEW.customer_profile_id AND store_owner_id=NEW.store_id FOR KEY SHARE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'ASAAS_CUSTOMER_COMMERCIAL_SCOPE_BLOCKED' USING ERRCODE='42501';
    END IF;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_asaas_customer_identity BEFORE INSERT OR UPDATE ON public.store_asaas_customers
FOR EACH ROW EXECUTE FUNCTION public._guard_asaas_customer_identity();
REVOKE ALL ON FUNCTION public._guard_asaas_customer_identity() FROM PUBLIC, anon, authenticated;

-- Dedicated Master scope, independent of visual or consumed subaccount authorizations.
-- Caller actor is resolved from validated JWT by future server handler, never browser identity.
CREATE FUNCTION public._lock_asaas_customer_scope(p_actor uuid, p_store_id uuid, p_environment text, p_account_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a public.store_asaas_accounts%ROWTYPE;
BEGIN
  IF p_actor IS NULL OR NOT public.has_role(p_actor, 'admin') THEN
    RAISE EXCEPTION 'ASAAS_CUSTOMER_FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  IF p_environment IS DISTINCT FROM 'sandbox'
     OR p_store_id IS DISTINCT FROM '323c7e89-7d28-492f-b3bc-be9f7f014bf0'::uuid THEN
    RAISE EXCEPTION 'ASAAS_CUSTOMER_SCOPE_BLOCKED' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO a FROM public.store_asaas_accounts
    WHERE id = p_account_id AND store_id = p_store_id AND environment = p_environment FOR UPDATE;
  IF NOT FOUND OR a.asaas_account_id IS DISTINCT FROM '111ce0e7-8dd0-4348-97bd-4b25add64fb0'
    OR a.status IS DISTINCT FROM 'active'
    OR a.commercial_status IS DISTINCT FROM 'APPROVED' OR a.bank_account_status IS DISTINCT FROM 'APPROVED'
    OR a.document_status IS DISTINCT FROM 'APPROVED' OR a.general_approval_status IS DISTINCT FROM 'APPROVED'
    OR nullif(btrim(a.encrypted_api_key),'') IS NULL
    OR NOT EXISTS (SELECT 1 FROM public.profiles WHERE id=p_store_id AND deleted_at IS NULL AND account_status='active') THEN
    RAISE EXCEPTION 'ASAAS_CUSTOMER_ACCOUNT_NOT_APPROVED' USING ERRCODE = '42501';
  END IF;
END; $$;
REVOKE ALL ON FUNCTION public._lock_asaas_customer_scope(uuid,uuid,text,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._lock_asaas_customer_scope(uuid,uuid,text,uuid) TO service_role;

CREATE FUNCTION public.reserve_asaas_customer(p_actor uuid,p_store_id uuid,p_environment text,p_account_id uuid,
  p_document text,p_name text,p_customer_profile_id uuid DEFAULT NULL,p_email text DEFAULT NULL,p_phone text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c public.store_asaas_customers%ROWTYPE; v_matches uuid[];
BEGIN
  PERFORM public._lock_asaas_customer_scope(p_actor,p_store_id,p_environment,p_account_id);
  IF p_document IS NULL OR p_document !~ '^[0-9]{11}([0-9]{3})?$' OR nullif(btrim(p_name),'') IS NULL THEN
    RAISE EXCEPTION 'ASAAS_CUSTOMER_INVALID_IDENTITY' USING ERRCODE='22023';
  END IF;
  IF p_customer_profile_id IS NOT NULL THEN
    PERFORM 1 FROM public.customer_profiles WHERE id=p_customer_profile_id FOR KEY SHARE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'ASAAS_CUSTOMER_COMMERCIAL_SCOPE_BLOCKED' USING ERRCODE='42501';
    END IF;
    PERFORM 1 FROM public.store_customers
      WHERE customer_id=p_customer_profile_id AND store_owner_id=p_store_id FOR KEY SHARE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'ASAAS_CUSTOMER_COMMERCIAL_SCOPE_BLOCKED' USING ERRCODE='42501';
    END IF;
  END IF;
  -- Serial account lock covers document and optional local identity collisions together.
  SELECT array_agg(m.id) INTO v_matches FROM (
    SELECT id FROM public.store_asaas_customers WHERE store_id=p_store_id AND environment=p_environment
      AND (cpf_cnpj_normalized=p_document OR (p_customer_profile_id IS NOT NULL AND customer_profile_id=p_customer_profile_id))
    ORDER BY id FOR UPDATE
  ) m;
  IF coalesce(cardinality(v_matches),0)>1 THEN
    RETURN jsonb_build_object('state','identity_conflict');
  END IF;
  SELECT * INTO c FROM public.store_asaas_customers WHERE id=v_matches[1] FOR UPDATE;
  IF FOUND THEN
    IF c.store_asaas_account_id IS DISTINCT FROM p_account_id OR c.cpf_cnpj_normalized IS DISTINCT FROM p_document
      OR (p_customer_profile_id IS NOT NULL AND c.customer_profile_id IS DISTINCT FROM p_customer_profile_id) THEN
      RETURN jsonb_build_object('state','identity_conflict');
    END IF;
    IF c.reservation_state='linked' THEN
      RETURN jsonb_build_object('state','existing','customerId',c.id,'asaasCustomerId',c.asaas_customer_id,'externalReference',c.external_reference);
    END IF;
    -- Neither lease expiry nor a no-match lookup can grant a fresh POST.
    RETURN jsonb_build_object('state',CASE WHEN c.send_started_at IS NOT NULL THEN 'reconciliation_required' ELSE 'reservation_exists' END,
      'customerId',c.id,'externalReference',c.external_reference);
  END IF;
  INSERT INTO public.store_asaas_customers(store_id,environment,store_asaas_account_id,cpf_cnpj_normalized,name,
    customer_profile_id,email,phone,attempt_token,lease_expires_at)
  VALUES(p_store_id,p_environment,p_account_id,p_document,btrim(p_name),p_customer_profile_id,p_email,p_phone,
    gen_random_uuid(),clock_timestamp()+interval '2 minutes') RETURNING * INTO c;
  RETURN jsonb_build_object('state','reserved','customerId',c.id,'externalReference',c.external_reference,'attemptToken',c.attempt_token);
END; $$;
REVOKE ALL ON FUNCTION public.reserve_asaas_customer(uuid,uuid,text,uuid,text,text,uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_asaas_customer(uuid,uuid,text,uuid,text,text,uuid,text,text) TO service_role;

-- Records uncertain outcomes only; does not reset a sent attempt or create another token.
CREATE FUNCTION public.record_asaas_customer_unknown(p_actor uuid,p_store_id uuid,p_environment text,p_account_id uuid,
  p_customer_id uuid,p_attempt_token uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  PERFORM public._lock_asaas_customer_scope(p_actor,p_store_id,p_environment,p_account_id);
  UPDATE public.store_asaas_customers SET reservation_state='unknown',last_error_code='RESULT_UNKNOWN'
  WHERE id=p_customer_id AND store_id=p_store_id AND environment=p_environment AND store_asaas_account_id=p_account_id
    AND attempt_token=p_attempt_token AND send_started_at IS NOT NULL AND reservation_state IN ('sending','unknown');
  RETURN FOUND;
END; $$;
REVOKE ALL ON FUNCTION public.record_asaas_customer_unknown(uuid,uuid,text,uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.record_asaas_customer_unknown(uuid,uuid,text,uuid,uuid,uuid) TO service_role;

-- Completion requires server-verified evidence from this exact subaccount and stable reference.
-- Zero/multiple matches or identity mismatch can never associate a payer or reset the attempt.
CREATE FUNCTION public.complete_asaas_customer_reservation(p_actor uuid,p_store_id uuid,p_environment text,p_account_id uuid,
  p_customer_id uuid,p_attempt_token uuid,p_external_reference text,p_document text,p_provider_id text,p_match_count integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c public.store_asaas_customers%ROWTYPE;
BEGIN
  PERFORM public._lock_asaas_customer_scope(p_actor,p_store_id,p_environment,p_account_id);
  SELECT * INTO c FROM public.store_asaas_customers
  WHERE id=p_customer_id AND store_id=p_store_id AND environment=p_environment AND store_asaas_account_id=p_account_id FOR UPDATE;
  IF NOT FOUND OR c.attempt_token IS DISTINCT FROM p_attempt_token OR p_attempt_token IS NULL THEN
    RETURN jsonb_build_object('state','stale_attempt');
  END IF;
  IF c.reservation_state='linked' THEN
    RETURN jsonb_build_object('state',CASE WHEN c.asaas_customer_id=p_provider_id AND c.external_reference=p_external_reference
      AND c.cpf_cnpj_normalized=p_document AND p_match_count=1 THEN 'existing' ELSE 'identity_conflict' END);
  END IF;
  IF p_match_count IS DISTINCT FROM 1 OR c.external_reference IS DISTINCT FROM p_external_reference
    OR c.cpf_cnpj_normalized IS DISTINCT FROM p_document OR p_provider_id IS NULL OR p_provider_id !~ '^cus_[A-Za-z0-9]+$' THEN
    UPDATE public.store_asaas_customers SET reservation_state='blocked',last_error_code=CASE
      WHEN p_match_count=0 THEN 'NO_MATCH' WHEN p_match_count>1 THEN 'MULTIPLE_MATCHES' ELSE 'IDENTITY_CONFLICT' END WHERE id=c.id;
    RETURN jsonb_build_object('state','reconciliation_required');
  END IF;
  IF c.reservation_state='blocked' THEN
    RETURN jsonb_build_object('state','administrative_review_required');
  END IF;
  BEGIN
    UPDATE public.store_asaas_customers SET asaas_customer_id=p_provider_id,reservation_state='linked',
      lease_expires_at=NULL,last_error_code=NULL WHERE id=c.id;
  EXCEPTION WHEN unique_violation THEN
    UPDATE public.store_asaas_customers SET reservation_state='blocked',last_error_code='IDENTITY_CONFLICT' WHERE id=c.id;
    RETURN jsonb_build_object('state','identity_conflict');
  END;
  RETURN jsonb_build_object('state','linked','customerId',c.id,'asaasCustomerId',p_provider_id);
END; $$;
REVOKE ALL ON FUNCTION public.complete_asaas_customer_reservation(uuid,uuid,text,uuid,uuid,uuid,text,text,text,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.complete_asaas_customer_reservation(uuid,uuid,text,uuid,uuid,uuid,text,text,text,integer) TO service_role;

-- No function authorizes or claims external sending in Phase 5.1.
-- The future send claim and any real provider call require separate Phase 5.2 authorization.
COMMENT ON FUNCTION public.reserve_asaas_customer(uuid,uuid,text,uuid,text,text,uuid,text,text)
  IS 'Phase 5.1 local reservation only; does not grant external execution. Phase 5.2 remains blocked.';
