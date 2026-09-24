ALTER TABLE public.account_deletion_requests ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;
ALTER TABLE public.account_deletion_requests ADD COLUMN IF NOT EXISTS cancelled_by uuid;
ALTER TABLE public.account_deletion_requests DROP CONSTRAINT IF EXISTS account_deletion_requests_status_check;
ALTER TABLE public.account_deletion_requests ADD CONSTRAINT account_deletion_requests_status_check
  CHECK (status IN ('pending','in_review','approved','rejected','completed','cancelled_by_user'));
CREATE UNIQUE INDEX IF NOT EXISTS uq_deletion_requests_one_active_per_merchant
  ON public.account_deletion_requests (merchant_id) WHERE status IN ('pending','in_review');

CREATE OR REPLACE FUNCTION public.cancel_account_deletion_request(p_request_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_status text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT status INTO v_status FROM account_deletion_requests
   WHERE id = p_request_id AND merchant_id = v_uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'request_not_found'; END IF;
  IF v_status = 'cancelled_by_user' THEN
    RETURN jsonb_build_object('status','cancelled_by_user','already_cancelled',true);
  END IF;
  IF v_status NOT IN ('pending','in_review') THEN RAISE EXCEPTION 'request_already_processing'; END IF;
  UPDATE account_deletion_requests SET status='cancelled_by_user', cancelled_at=now(), cancelled_by=v_uid
   WHERE id=p_request_id AND status IN ('pending','in_review');
  UPDATE profiles SET account_status='active', account_status_updated_at=now()
   WHERE id=v_uid AND account_status='exclusao_solicitada';
  INSERT INTO audit_logs(user_id, action, entity_type, entity_id, metadata)
   VALUES (v_uid,'account_deletion_request_cancelled','account_deletion_request',p_request_id,
           jsonb_build_object('request_id',p_request_id,'merchant_id',v_uid,'previous_status',v_status));
  RETURN jsonb_build_object('status','cancelled_by_user','already_cancelled',false);
END $$;
REVOKE ALL ON FUNCTION public.cancel_account_deletion_request(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_account_deletion_request(uuid) TO authenticated, service_role;