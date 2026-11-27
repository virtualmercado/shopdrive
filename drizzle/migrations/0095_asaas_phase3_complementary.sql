-- Additive Phase 3 safeguards. No authorizations or operational rows are seeded.
CREATE TABLE public.asaas_subaccount_creation_authorizations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 store_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
 actor_id uuid NOT NULL,
 authorized_by uuid NOT NULL,
 attempt_token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
 enabled boolean NOT NULL DEFAULT false,
 expires_at timestamptz NOT NULL,
 consumed_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON public.asaas_subaccount_creation_authorizations FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.asaas_subaccount_creation_authorizations TO service_role;
ALTER TABLE public.asaas_subaccount_creation_authorizations ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_asaas_creation_authorizations_store ON public.asaas_subaccount_creation_authorizations(store_id);
CREATE INDEX idx_asaas_creation_authorizations_actor ON public.asaas_subaccount_creation_authorizations(actor_id);
CREATE INDEX idx_asaas_creation_authorizations_admin ON public.asaas_subaccount_creation_authorizations(authorized_by);
ALTER TABLE public.store_asaas_accounts ADD COLUMN status_revision bigint NOT NULL DEFAULT 0;
-- Provider identifiers must not be reused, even across environments.
CREATE UNIQUE INDEX idx_asaas_account_global ON public.store_asaas_accounts(asaas_account_id) WHERE asaas_account_id IS NOT NULL;
CREATE UNIQUE INDEX idx_asaas_wallet_global ON public.store_asaas_accounts(wallet_id) WHERE wallet_id IS NOT NULL;
CREATE INDEX idx_asaas_events_recovery ON public.asaas_webhook_events(store_id,received_at) WHERE processing_status IN ('received','error');

CREATE OR REPLACE FUNCTION public.admin_authorize_asaas_subaccount_creation(p_store_id uuid,p_actor_id uuid,p_expires_at timestamptz)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_id uuid; v_actor uuid:=auth.uid();
BEGIN
 IF v_actor IS NULL OR NOT public.has_role(v_actor,'admin') THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 IF p_expires_at IS NULL OR p_expires_at<=now() OR p_expires_at>now()+interval '1 hour'
   OR p_actor_id IS NULL OR NOT public.can_actor_manage_marca_store(p_actor_id,p_store_id) THEN
   RAISE EXCEPTION 'invalid_authorization' USING ERRCODE='22023';
 END IF;
 PERFORM 1 FROM public.profiles WHERE id=p_store_id AND deleted_at IS NULL AND account_status='active' FOR UPDATE;
 IF NOT FOUND OR EXISTS(SELECT 1 FROM public.store_asaas_accounts WHERE store_id=p_store_id AND environment='sandbox') THEN
   RAISE EXCEPTION 'reconciliation_required' USING ERRCODE='22023';
 END IF;
 IF EXISTS(SELECT 1 FROM public.asaas_subaccount_creation_authorizations WHERE store_id=p_store_id AND enabled AND consumed_at IS NULL AND expires_at>now()) THEN
   RAISE EXCEPTION 'authorization_already_exists' USING ERRCODE='22023';
 END IF;
 INSERT INTO public.asaas_subaccount_creation_authorizations(store_id,actor_id,authorized_by,enabled,expires_at)
 VALUES(p_store_id,p_actor_id,v_actor,true,p_expires_at) RETURNING id INTO v_id;
 RETURN jsonb_build_object('authorizationId',v_id,'storeId',p_store_id,'environment','sandbox');
END $$;
REVOKE ALL ON FUNCTION public.admin_authorize_asaas_subaccount_creation(uuid,uuid,timestamptz) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_authorize_asaas_subaccount_creation(uuid,uuid,timestamptz) TO authenticated,service_role;

-- Preserve the legacy signature but fail closed for old deployed callers.
CREATE OR REPLACE FUNCTION public.begin_asaas_subaccount_creation(p_actor uuid,p_store_id uuid,p_webhook_token_hash text)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
 SELECT jsonb_build_object('state','creation_not_authorized')
$$;
REVOKE ALL ON FUNCTION public.begin_asaas_subaccount_creation(uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.begin_asaas_subaccount_creation(uuid,uuid,text) TO service_role;
CREATE OR REPLACE FUNCTION public.begin_asaas_subaccount_creation(
  p_actor uuid,
  p_store_id uuid,
  p_webhook_token_hash text,
  p_authorization_id uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r public.store_asaas_accounts%ROWTYPE;
  v_attempt uuid;
  g public.asaas_subaccount_creation_authorizations%ROWTYPE;
BEGIN
  IF p_actor IS NULL OR p_store_id IS NULL OR p_webhook_token_hash IS NULL OR p_webhook_token_hash !~ '^[a-f0-9]{64}$' THEN
    RETURN jsonb_build_object('state', 'invalid_input');
  END IF;
  IF NOT public.can_actor_manage_marca_store(p_actor, p_store_id) THEN
    RETURN jsonb_build_object('state', 'forbidden');
  END IF;

  -- The profile row is the per-store mutex, including the first insert.
  PERFORM 1 FROM public.profiles
    WHERE id = p_store_id AND deleted_at IS NULL AND coalesce(account_status, 'active') = 'active'
    FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('state', 'forbidden'); END IF;
  IF NOT public.can_actor_manage_marca_store(p_actor, p_store_id) THEN
    RETURN jsonb_build_object('state', 'forbidden');
  END IF;

  SELECT * INTO r FROM public.store_asaas_accounts
    WHERE store_id = p_store_id AND environment = 'sandbox'
    FOR UPDATE;

  IF FOUND THEN
    IF r.status = 'pending_creation' AND r.creation_lease_expires_at > now() THEN
      RETURN jsonb_build_object('state', 'creation_in_progress');
    END IF;
    IF r.asaas_account_id IS NOT NULL OR r.status NOT IN ('pending_creation', 'error') THEN
      RETURN jsonb_build_object('state', 'existing', 'account', jsonb_build_object(
        'storeId', r.store_id, 'environment', r.environment, 'status', r.status,
        'accountId', r.asaas_account_id, 'commercialStatus', r.commercial_status,
        'bankAccountStatus', r.bank_account_status, 'documentStatus', r.document_status,
        'generalApprovalStatus', r.general_approval_status, 'lastSyncAt', r.last_sync_at,
        'lastErrorCode', r.last_error_code
      ));
    END IF;
    -- Expiration is not evidence that the external POST never happened.
    RETURN jsonb_build_object('state', 'reconciliation_required');
  END IF;

  SELECT * INTO g FROM public.asaas_subaccount_creation_authorizations
    WHERE id=p_authorization_id AND store_id=p_store_id AND actor_id=p_actor
    FOR UPDATE;
  IF NOT FOUND OR NOT g.enabled OR g.consumed_at IS NOT NULL OR g.expires_at<=now()
    OR NOT public.has_role(g.authorized_by,'admin') THEN
    RETURN jsonb_build_object('state','creation_not_authorized');
  END IF;
  v_attempt := g.attempt_token;
  UPDATE public.asaas_subaccount_creation_authorizations SET consumed_at=now(), enabled=false WHERE id=g.id;
  INSERT INTO public.store_asaas_accounts(store_id,environment,status,creation_attempt_token,creation_lease_expires_at,webhook_token_hash)
    VALUES(p_store_id,'sandbox','pending_creation',v_attempt,now()+interval '2 minutes',p_webhook_token_hash);

  RETURN jsonb_build_object('state', 'claimed', 'attemptToken', v_attempt);
END;
$$;
REVOKE ALL ON FUNCTION public.begin_asaas_subaccount_creation(uuid,uuid,text,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.begin_asaas_subaccount_creation(uuid,uuid,text,uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.complete_asaas_subaccount_creation(
  p_attempt_token uuid,
  p_commercial_status text,
  p_bank_account_status text,
  p_document_status text,
  p_general_approval_status text,
  p_status text,
  p_last_error_code text
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE r public.store_asaas_accounts%ROWTYPE;
BEGIN
  IF p_attempt_token IS NULL OR p_status NOT IN ('awaiting_documents','under_review','active','rejected') THEN
    RETURN false;
  END IF;
  SELECT * INTO r FROM public.store_asaas_accounts
    WHERE creation_attempt_token = p_attempt_token AND environment = 'sandbox'
      AND status IN ('under_review','awaiting_documents','active','rejected')
      AND encrypted_api_key IS NOT NULL
    FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  UPDATE public.store_asaas_accounts SET
    commercial_status = p_commercial_status, bank_account_status = p_bank_account_status,
    document_status = p_document_status, general_approval_status = p_general_approval_status,
    status = p_status, last_sync_at = CASE WHEN p_last_error_code IS NULL THEN now() ELSE last_sync_at END,
    last_error_code = p_last_error_code, creation_attempt_token = NULL,
    creation_lease_expires_at = NULL, status_revision=status_revision+1
  WHERE id = r.id;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.complete_asaas_subaccount_creation(uuid,text,text,text,text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_asaas_subaccount_creation(uuid,text,text,text,text,text,text) TO service_role;


-- Acceptance only: webhook-supplied status/date never becomes financial account authority.
CREATE OR REPLACE FUNCTION public.apply_asaas_account_webhook(
 p_store_id uuid,p_webhook_token_hash text,p_event_id text,p_event_type text,p_account_id text,p_payload jsonb,
 p_commercial_status text,p_bank_account_status text,p_document_status text,p_general_approval_status text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a public.store_asaas_accounts%ROWTYPE; e public.asaas_webhook_events%ROWTYPE;
BEGIN
 SELECT * INTO a FROM public.store_asaas_accounts WHERE store_id=p_store_id AND environment='sandbox' AND webhook_token_hash=p_webhook_token_hash FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('state','unauthorized'); END IF;
 IF nullif(btrim(p_event_id),'') IS NULL OR nullif(btrim(p_account_id),'') IS NULL OR p_payload IS NULL OR jsonb_typeof(p_payload)<>'object' THEN
   RETURN jsonb_build_object('state','invalid_event');
 END IF;
 INSERT INTO public.asaas_webhook_events(event_id,account_id,event_type,store_id,payload_sanitized,processing_status)
 VALUES(p_event_id,p_account_id,p_event_type,p_store_id,p_payload,'received') ON CONFLICT(event_id) DO NOTHING;
 SELECT * INTO e FROM public.asaas_webhook_events WHERE event_id=p_event_id FOR UPDATE;
 IF e.store_id IS DISTINCT FROM p_store_id OR e.account_id IS DISTINCT FROM p_account_id OR e.event_type IS DISTINCT FROM p_event_type THEN
   RETURN jsonb_build_object('state','unauthorized');
 END IF;
 IF e.processing_status IN ('processed','ignored') THEN RETURN jsonb_build_object('state','duplicate'); END IF;
 IF a.asaas_account_id IS NULL OR a.encrypted_api_key IS NULL OR a.creation_attempt_token IS NOT NULL THEN
   RETURN jsonb_build_object('state','deferred');
 END IF;
 IF a.asaas_account_id<>p_account_id OR p_event_type NOT LIKE 'ACCOUNT_STATUS\_%' ESCAPE '\' THEN
   UPDATE public.asaas_webhook_events SET processing_status='ignored',processed_at=now(),error_code='ASAAS_ACCOUNT_MISMATCH_OR_UNSUPPORTED_EVENT' WHERE id=e.id;
   RETURN jsonb_build_object('state','ignored');
 END IF;
 RETURN jsonb_build_object('state','reconciliation_required');
END $$;
REVOKE ALL ON FUNCTION public.apply_asaas_account_webhook(uuid,text,text,text,text,jsonb,text,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.apply_asaas_account_webhook(uuid,text,text,text,text,jsonb,text,text,text,text) TO service_role;

-- Only a current, authenticated provider status observation may finish pending events.
CREATE OR REPLACE FUNCTION public.reconcile_asaas_account_events(
 p_store_id uuid,p_account_id text,p_webhook_token_hash text,p_expected_revision bigint,p_through timestamptz,
 p_commercial_status text,p_bank_account_status text,p_document_status text,p_general_approval_status text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a public.store_asaas_accounts%ROWTYPE; v_count integer;
BEGIN
 SELECT * INTO a FROM public.store_asaas_accounts WHERE store_id=p_store_id AND environment='sandbox' FOR UPDATE;
 IF NOT FOUND OR a.asaas_account_id IS DISTINCT FROM p_account_id OR a.webhook_token_hash IS DISTINCT FROM p_webhook_token_hash
   OR a.encrypted_api_key IS NULL OR (a.creation_attempt_token IS NOT NULL AND coalesce(a.creation_lease_expires_at,now()+interval '1 minute')>now()) THEN RETURN jsonb_build_object('state','deferred'); END IF;
 IF a.status_revision IS DISTINCT FROM p_expected_revision THEN RETURN jsonb_build_object('state','stale_observation'); END IF;
 IF p_through IS NULL OR p_through>now() OR p_general_approval_status IS NULL
   OR p_general_approval_status NOT IN ('PENDING','AWAITING_APPROVAL','APPROVED','REJECTED')
   OR coalesce(p_commercial_status,'PENDING') NOT IN ('PENDING','AWAITING_APPROVAL','APPROVED','REJECTED')
   OR coalesce(p_bank_account_status,'PENDING') NOT IN ('PENDING','AWAITING_APPROVAL','APPROVED','REJECTED')
   OR coalesce(p_document_status,'PENDING') NOT IN ('PENDING','AWAITING_APPROVAL','APPROVED','REJECTED') THEN
   RETURN jsonb_build_object('state','deferred');
 END IF;
 UPDATE public.asaas_webhook_events SET processing_status=CASE WHEN account_id=p_account_id AND event_type LIKE 'ACCOUNT_STATUS\_%' ESCAPE '\' THEN 'processed' ELSE 'ignored' END,
   processed_at=now(),error_code=CASE WHEN account_id=p_account_id THEN NULL ELSE 'ASAAS_ACCOUNT_MISMATCH' END
 WHERE store_id=p_store_id AND processing_status IN ('received','error') AND received_at<=p_through;
 GET DIAGNOSTICS v_count=ROW_COUNT;
 IF v_count=0 THEN RETURN jsonb_build_object('state','duplicate'); END IF;
 UPDATE public.store_asaas_accounts SET commercial_status=p_commercial_status,bank_account_status=p_bank_account_status,
 document_status=p_document_status,general_approval_status=p_general_approval_status,
 status=public._asaas_derive_account_status(p_commercial_status,p_bank_account_status,p_document_status,p_general_approval_status),
 last_sync_at=now(),last_error_code=NULL,status_revision=status_revision+1,creation_attempt_token=NULL,creation_lease_expires_at=NULL WHERE id=a.id;
 RETURN jsonb_build_object('state','processed','events',v_count);
END $$;
REVOKE ALL ON FUNCTION public.reconcile_asaas_account_events(uuid,text,text,bigint,timestamptz,text,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.reconcile_asaas_account_events(uuid,text,text,bigint,timestamptz,text,text,text,text) TO service_role;
