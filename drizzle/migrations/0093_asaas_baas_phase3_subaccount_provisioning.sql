-- ASAAS BaaS Phase 3: Sandbox subaccount leases and account-status webhooks.
-- Service-role-only RPCs; no frontend grants, orders, charges or Production writes.

ALTER TABLE public.store_asaas_accounts
  ADD COLUMN creation_attempt_token UUID NULL;
COMMENT ON COLUMN public.store_asaas_accounts.creation_attempt_token IS 'Phase 3 fence: only the current leased creation attempt may capture, finish or fail its own transition.';

CREATE UNIQUE INDEX idx_store_asaas_accounts_webhook_token_hash
  ON public.store_asaas_accounts (webhook_token_hash)
  WHERE webhook_token_hash IS NOT NULL;

CREATE OR REPLACE FUNCTION public._asaas_derive_account_status(
  p_commercial text,
  p_bank text,
  p_document text,
  p_general text
) RETURNS text
LANGUAGE sql IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_general = 'APPROVED' THEN 'active'
    WHEN p_general = 'REJECTED' THEN 'rejected'
    WHEN p_document IN ('PENDING', 'REJECTED') THEN 'awaiting_documents'
    ELSE 'under_review'
  END
$$;
REVOKE ALL ON FUNCTION public._asaas_derive_account_status(text,text,text,text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.begin_asaas_subaccount_creation(
  p_actor uuid,
  p_store_id uuid,
  p_webhook_token_hash text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r public.store_asaas_accounts%ROWTYPE;
  v_attempt uuid := gen_random_uuid();
BEGIN
  IF p_actor IS NULL OR p_store_id IS NULL OR p_webhook_token_hash !~ '^[a-f0-9]{64}$' THEN
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
    IF r.status = 'error' AND coalesce(r.last_error_code, '') NOT IN (
      'ASAAS_SUBACCOUNT_NOT_FOUND', 'ASAAS_CREATE_REJECTED'
    ) THEN
      RETURN jsonb_build_object('state', 'existing', 'account', jsonb_build_object(
        'storeId', r.store_id, 'environment', r.environment, 'status', r.status,
        'accountId', r.asaas_account_id, 'commercialStatus', r.commercial_status,
        'bankAccountStatus', r.bank_account_status, 'documentStatus', r.document_status,
        'generalApprovalStatus', r.general_approval_status, 'lastSyncAt', r.last_sync_at,
        'lastErrorCode', r.last_error_code
      ));
    END IF;

    UPDATE public.store_asaas_accounts SET
      status = 'pending_creation', creation_attempt_token = v_attempt,
      creation_lease_expires_at = now() + interval '2 minutes',
      webhook_token_hash = p_webhook_token_hash,
      asaas_account_id = NULL, wallet_id = NULL, account_number = NULL,
      encrypted_api_key = NULL, api_key_fingerprint = NULL,
      commercial_status = NULL, bank_account_status = NULL,
      document_status = NULL, general_approval_status = NULL,
      document_summary = '{}'::jsonb, last_sync_at = NULL, last_error_code = NULL
    WHERE id = r.id;
  ELSE
    INSERT INTO public.store_asaas_accounts (
      store_id, environment, status, creation_attempt_token,
      creation_lease_expires_at, webhook_token_hash
    ) VALUES (
      p_store_id, 'sandbox', 'pending_creation', v_attempt,
      now() + interval '2 minutes', p_webhook_token_hash
    );
  END IF;

  RETURN jsonb_build_object('state', 'claimed', 'attemptToken', v_attempt);
END;
$$;
REVOKE ALL ON FUNCTION public.begin_asaas_subaccount_creation(uuid,uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.begin_asaas_subaccount_creation(uuid,uuid,text) TO service_role;

CREATE OR REPLACE FUNCTION public.capture_asaas_subaccount_credentials(
  p_attempt_token uuid,
  p_asaas_account_id text,
  p_wallet_id text,
  p_account_number text,
  p_encrypted_api_key text,
  p_api_key_fingerprint text
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE r public.store_asaas_accounts%ROWTYPE;
BEGIN
  IF p_attempt_token IS NULL OR nullif(btrim(p_asaas_account_id), '') IS NULL
    OR nullif(btrim(p_wallet_id), '') IS NULL OR nullif(btrim(p_encrypted_api_key), '') IS NULL
    OR p_api_key_fingerprint !~ '^sha256:[a-f0-9]{64}$' THEN RETURN false; END IF;
  SELECT * INTO r FROM public.store_asaas_accounts
    WHERE creation_attempt_token = p_attempt_token AND environment = 'sandbox'
      AND status = 'pending_creation' AND creation_lease_expires_at > now()
    FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  UPDATE public.store_asaas_accounts SET
    asaas_account_id = p_asaas_account_id, wallet_id = p_wallet_id,
    account_number = nullif(btrim(p_account_number), ''),
    encrypted_api_key = p_encrypted_api_key, api_key_fingerprint = p_api_key_fingerprint,
    status = 'under_review', last_error_code = NULL,
    creation_lease_expires_at = now() + interval '2 minutes'
  WHERE id = r.id;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.capture_asaas_subaccount_credentials(uuid,text,text,text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.capture_asaas_subaccount_credentials(uuid,text,text,text,text,text) TO service_role;

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
    creation_lease_expires_at = NULL
  WHERE id = r.id;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.complete_asaas_subaccount_creation(uuid,text,text,text,text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_asaas_subaccount_creation(uuid,text,text,text,text,text,text) TO service_role;

CREATE OR REPLACE FUNCTION public.fail_asaas_subaccount_creation(
  p_attempt_token uuid,
  p_error_code text,
  p_asaas_account_id text,
  p_wallet_id text,
  p_account_number text
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE r public.store_asaas_accounts%ROWTYPE;
BEGIN
  IF p_attempt_token IS NULL OR nullif(btrim(p_error_code), '') IS NULL THEN RETURN false; END IF;
  SELECT * INTO r FROM public.store_asaas_accounts
    WHERE creation_attempt_token = p_attempt_token AND environment = 'sandbox'
      AND status = 'pending_creation'
    FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  IF r.asaas_account_id IS NOT NULL AND r.asaas_account_id IS DISTINCT FROM p_asaas_account_id THEN RETURN false; END IF;
  UPDATE public.store_asaas_accounts SET
    status = 'error', last_error_code = p_error_code,
    asaas_account_id = coalesce(r.asaas_account_id, nullif(btrim(p_asaas_account_id), '')),
    wallet_id = coalesce(r.wallet_id, nullif(btrim(p_wallet_id), '')),
    account_number = coalesce(r.account_number, nullif(btrim(p_account_number), '')),
    creation_attempt_token = NULL, creation_lease_expires_at = NULL
  WHERE id = r.id;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.fail_asaas_subaccount_creation(uuid,text,text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fail_asaas_subaccount_creation(uuid,text,text,text,text) TO service_role;

CREATE OR REPLACE FUNCTION public.apply_asaas_account_webhook(
  p_store_id uuid,
  p_webhook_token_hash text,
  p_event_id text,
  p_event_type text,
  p_account_id text,
  p_payload jsonb,
  p_commercial_status text,
  p_bank_account_status text,
  p_document_status text,
  p_general_approval_status text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  a public.store_asaas_accounts%ROWTYPE;
  v_event uuid;
  v_status text;
  v_known boolean;
  v_valid_statuses boolean;
BEGIN
  SELECT * INTO a FROM public.store_asaas_accounts
    WHERE id IS NOT NULL AND store_id = p_store_id AND environment = 'sandbox'
      AND webhook_token_hash = p_webhook_token_hash
    FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('state', 'unauthorized'); END IF;

  INSERT INTO public.asaas_webhook_events (
    event_id, account_id, event_type, store_id, payload_sanitized, processing_status
  ) VALUES (
    p_event_id, p_account_id, p_event_type, p_store_id, p_payload, 'received'
  ) ON CONFLICT (event_id) DO NOTHING
  RETURNING id INTO v_event;
  IF v_event IS NULL THEN RETURN jsonb_build_object('state', 'duplicate'); END IF;

  IF a.asaas_account_id IS NULL THEN
    UPDATE public.asaas_webhook_events SET processing_status='processed', processed_at=now() WHERE id=v_event;
    RETURN jsonb_build_object('state', 'deferred');
  END IF;
  IF a.asaas_account_id <> p_account_id THEN
    UPDATE public.asaas_webhook_events SET processing_status='ignored', processed_at=now(), error_code='ASAAS_ACCOUNT_MISMATCH' WHERE id=v_event;
    RETURN jsonb_build_object('state', 'ignored');
  END IF;

  v_known := p_event_type LIKE 'ACCOUNT_STATUS\_%' ESCAPE '\';
  IF NOT v_known THEN
    UPDATE public.asaas_webhook_events SET processing_status='ignored', processed_at=now() WHERE id=v_event;
    RETURN jsonb_build_object('state', 'ignored');
  END IF;
  IF a.status = 'error' AND a.encrypted_api_key IS NULL THEN
    UPDATE public.asaas_webhook_events SET processing_status='ignored', processed_at=now(), error_code='ASAAS_CREDENTIAL_RECOVERY_REQUIRED' WHERE id=v_event;
    RETURN jsonb_build_object('state', 'ignored');
  END IF;

  v_valid_statuses := (p_commercial_status IS NULL OR p_commercial_status IN ('PENDING','AWAITING_APPROVAL','APPROVED','REJECTED'))
    AND (p_bank_account_status IS NULL OR p_bank_account_status IN ('PENDING','AWAITING_APPROVAL','APPROVED','REJECTED'))
    AND (p_document_status IS NULL OR p_document_status IN ('PENDING','AWAITING_APPROVAL','APPROVED','REJECTED'))
    AND (p_general_approval_status IS NULL OR p_general_approval_status IN ('PENDING','AWAITING_APPROVAL','APPROVED','REJECTED'));
  IF NOT v_valid_statuses THEN
    UPDATE public.asaas_webhook_events SET processing_status='ignored', processed_at=now(), error_code='ASAAS_UNSUPPORTED_ACCOUNT_STATUS' WHERE id=v_event;
    RETURN jsonb_build_object('state', 'ignored');
  END IF;

  v_status := public._asaas_derive_account_status(
    p_commercial_status, p_bank_account_status, p_document_status, p_general_approval_status
  );
  UPDATE public.store_asaas_accounts SET
    commercial_status = p_commercial_status, bank_account_status = p_bank_account_status,
    document_status = p_document_status, general_approval_status = p_general_approval_status,
    status = v_status, last_sync_at = now(), last_error_code = NULL
  WHERE id = a.id;
  UPDATE public.asaas_webhook_events SET processing_status='processed', processed_at=now() WHERE id=v_event;
  RETURN jsonb_build_object('state', 'processed', 'status', v_status);
END;
$$;
REVOKE ALL ON FUNCTION public.apply_asaas_account_webhook(uuid,text,text,text,text,jsonb,text,text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_asaas_account_webhook(uuid,text,text,text,text,jsonb,text,text,text,text) TO service_role;
