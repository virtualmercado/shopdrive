CREATE OR REPLACE FUNCTION public.normalize_email(p_email text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public
AS $$ SELECT NULLIF(lower(btrim(p_email)), '') $$;

CREATE TABLE public.email_suppressions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  reason text NOT NULL DEFAULT 'unsubscribe',
  source text NOT NULL DEFAULT 'unsubscribe_link',
  created_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT email_suppressions_email_normalized CHECK (email = lower(btrim(email)) AND email <> ''),
  CONSTRAINT email_suppressions_reason_check CHECK (reason IN ('unsubscribe','admin','invalid','bounce')),
  CONSTRAINT email_suppressions_source_check CHECK (source IN ('unsubscribe_link','admin','system'))
);
CREATE UNIQUE INDEX uq_email_suppressions_email ON public.email_suppressions (email);
GRANT SELECT ON public.email_suppressions TO authenticated;
GRANT ALL ON public.email_suppressions TO service_role;
ALTER TABLE public.email_suppressions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Only admins read suppressions" ON public.email_suppressions
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
COMMENT ON TABLE public.email_suppressions IS 'Marketing-only suppression list. Never consulted for transactional email.';

CREATE TABLE public.email_unsubscribe_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash text NOT NULL,
  email text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '365 days'),
  used_at timestamptz NULL,
  CONSTRAINT email_unsubscribe_tokens_email_normalized CHECK (email = lower(btrim(email)) AND email <> '')
);
CREATE UNIQUE INDEX uq_email_unsubscribe_tokens_hash ON public.email_unsubscribe_tokens (token_hash);
GRANT ALL ON public.email_unsubscribe_tokens TO service_role;
ALTER TABLE public.email_unsubscribe_tokens ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.create_email_unsubscribe_token(p_email text, p_ttl_days integer DEFAULT 365)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions
AS $$
DECLARE v_email text := public.normalize_email(p_email); v_token text;
BEGIN
  IF v_email IS NULL THEN RAISE EXCEPTION 'invalid_email'; END IF;
  v_token := translate(encode(extensions.gen_random_bytes(32), 'base64'), '+/=', '-_');
  INSERT INTO public.email_unsubscribe_tokens (token_hash, email, expires_at)
  VALUES (encode(extensions.digest(v_token, 'sha256'), 'hex'), v_email, now() + make_interval(days => GREATEST(1, LEAST(p_ttl_days, 730))));
  RETURN v_token;
END $$;
REVOKE ALL ON FUNCTION public.create_email_unsubscribe_token(text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_email_unsubscribe_token(text, integer) TO service_role;

CREATE OR REPLACE FUNCTION public.is_email_suppressed(p_email text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' AND NOT (auth.uid() IS NOT NULL AND public.has_role(auth.uid(), 'admin')) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  RETURN EXISTS (SELECT 1 FROM public.email_suppressions WHERE email = public.normalize_email(p_email));
END $$;
REVOKE ALL ON FUNCTION public.is_email_suppressed(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_email_suppressed(text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.check_email_unsubscribe_token(p_token text)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, extensions
AS $$
DECLARE v_email text;
BEGIN
  IF p_token IS NULL OR length(p_token) < 20 OR length(p_token) > 200 THEN RETURN 'invalid'; END IF;
  SELECT email INTO v_email FROM public.email_unsubscribe_tokens
   WHERE token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex') AND expires_at > now();
  IF v_email IS NULL THEN RETURN 'invalid'; END IF;
  IF EXISTS (SELECT 1 FROM public.email_suppressions WHERE email = v_email) THEN RETURN 'already'; END IF;
  RETURN 'valid';
END $$;

CREATE OR REPLACE FUNCTION public.confirm_email_unsubscribe(p_token text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions
AS $$
DECLARE v_id uuid; v_email text; v_inserted int;
BEGIN
  IF p_token IS NULL OR length(p_token) < 20 OR length(p_token) > 200 THEN RETURN 'invalid'; END IF;
  SELECT id, email INTO v_id, v_email FROM public.email_unsubscribe_tokens
   WHERE token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex') AND expires_at > now();
  IF v_id IS NULL THEN RETURN 'invalid'; END IF;
  INSERT INTO public.email_suppressions (email, reason, source)
  VALUES (v_email, 'unsubscribe', 'unsubscribe_link') ON CONFLICT (email) DO NOTHING;
  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  UPDATE public.email_unsubscribe_tokens SET used_at = COALESCE(used_at, now()) WHERE id = v_id;
  UPDATE public.email_queue SET status = 'suppressed', last_error = 'marketing_suppressed', locked_at = NULL
   WHERE category = 'marketing' AND status IN ('pending','retry') AND public.normalize_email(to_email) = v_email;
  RETURN CASE WHEN v_inserted > 0 THEN 'unsubscribed' ELSE 'already' END;
END $$;
REVOKE ALL ON FUNCTION public.check_email_unsubscribe_token(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.confirm_email_unsubscribe(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_email_unsubscribe_token(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.confirm_email_unsubscribe(text) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.admin_add_email_suppression(p_email text, p_reason text DEFAULT 'admin')
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_email text := public.normalize_email(p_email); v_inserted int;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  IF v_email IS NULL OR v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' THEN RAISE EXCEPTION 'invalid_email'; END IF;
  IF p_reason NOT IN ('admin','invalid') THEN RAISE EXCEPTION 'invalid_reason'; END IF;
  INSERT INTO public.email_suppressions (email, reason, source, created_by)
  VALUES (v_email, p_reason, 'admin', auth.uid()) ON CONFLICT (email) DO NOTHING;
  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  UPDATE public.email_queue SET status = 'suppressed', last_error = 'marketing_suppressed', locked_at = NULL
   WHERE category = 'marketing' AND status IN ('pending','retry') AND public.normalize_email(to_email) = v_email;
  RETURN CASE WHEN v_inserted > 0 THEN 'suppressed' ELSE 'already' END;
END $$;
REVOKE ALL ON FUNCTION public.admin_add_email_suppression(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_add_email_suppression(text, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.enqueue_marketing_email(
  p_to_email text, p_subject text, p_html text, p_idempotency_key text,
  p_payload jsonb DEFAULT '{}'::jsonb, p_priority integer DEFAULT 10, p_tenant_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_email text := public.normalize_email(p_to_email); v_id uuid;
BEGIN
  IF v_email IS NULL THEN RETURN jsonb_build_object('status','invalid'); END IF;
  IF p_idempotency_key IS NULL OR p_idempotency_key = '' THEN RAISE EXCEPTION 'idempotency_key_required'; END IF;
  IF EXISTS (SELECT 1 FROM public.email_suppressions WHERE email = v_email) THEN RETURN jsonb_build_object('status','suppressed'); END IF;
  SELECT id INTO v_id FROM public.email_queue WHERE idempotency_key = p_idempotency_key;
  IF v_id IS NOT NULL THEN RETURN jsonb_build_object('status','exists','queue_id',v_id); END IF;
  INSERT INTO public.email_queue (tenant_id, template, to_email, subject, html, payload, status, category, priority, idempotency_key)
  VALUES (p_tenant_id, 'marketing', v_email, p_subject, p_html, COALESCE(p_payload,'{}'::jsonb), 'pending', 'marketing', LEAST(p_priority, 50), p_idempotency_key)
  RETURNING id INTO v_id;
  RETURN jsonb_build_object('status','queued','queue_id',v_id);
END $$;
REVOKE ALL ON FUNCTION public.enqueue_marketing_email(text, text, text, text, jsonb, integer, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_marketing_email(text, text, text, text, jsonb, integer, uuid) TO service_role;