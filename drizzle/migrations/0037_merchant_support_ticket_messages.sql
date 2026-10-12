CREATE TABLE public.merchant_support_ticket_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.merchant_support_tickets(id) ON DELETE CASCADE,
  sender_type text NOT NULL CHECK (sender_type IN ('merchant','support')),
  sender_user_id uuid,
  message text NOT NULL CHECK (char_length(btrim(message)) > 0 AND char_length(message) <= 5000),
  legacy_source text CHECK (legacy_source IN ('initial','response')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ticket_id, legacy_source)
);
CREATE INDEX idx_mstm_ticket_created ON public.merchant_support_ticket_messages (ticket_id, created_at);

GRANT SELECT ON public.merchant_support_ticket_messages TO authenticated;
GRANT ALL ON public.merchant_support_ticket_messages TO service_role;
ALTER TABLE public.merchant_support_ticket_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Merchants read own ticket messages" ON public.merchant_support_ticket_messages
FOR SELECT TO authenticated USING (EXISTS (
  SELECT 1 FROM public.merchant_support_tickets t WHERE t.id = ticket_id AND t.merchant_id = auth.uid()));
CREATE POLICY "Support reads all ticket messages" ON public.merchant_support_ticket_messages
FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'suporte'));

-- Backfill (idempotent via legacy_source unique)
INSERT INTO public.merchant_support_ticket_messages (ticket_id, sender_type, sender_user_id, message, legacy_source, created_at)
SELECT id, 'merchant', merchant_id, left(message, 5000), 'initial', created_at
FROM public.merchant_support_tickets WHERE btrim(coalesce(message,'')) <> ''
ON CONFLICT (ticket_id, legacy_source) DO NOTHING;
INSERT INTO public.merchant_support_ticket_messages (ticket_id, sender_type, sender_user_id, message, legacy_source, created_at)
SELECT id, 'support', NULL, left(response, 5000), 'response', coalesce(answered_at, updated_at)
FROM public.merchant_support_tickets WHERE btrim(coalesce(response,'')) <> ''
ON CONFLICT (ticket_id, legacy_source) DO NOTHING;

-- New tickets: initial message recorded atomically
CREATE OR REPLACE FUNCTION public.mst_record_initial_message() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF btrim(coalesce(NEW.message,'')) <> '' THEN
    INSERT INTO public.merchant_support_ticket_messages (ticket_id, sender_type, sender_user_id, message, legacy_source, created_at)
    VALUES (NEW.id, 'merchant', NEW.merchant_id, left(NEW.message,5000), 'initial', NEW.created_at)
    ON CONFLICT (ticket_id, legacy_source) DO NOTHING;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_mst_initial_message AFTER INSERT ON public.merchant_support_tickets
FOR EACH ROW EXECUTE FUNCTION public.mst_record_initial_message();

CREATE OR REPLACE FUNCTION public.merchant_reply_support_ticket(_ticket_id uuid, _message text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _msg text := btrim(coalesce(_message,'')); _id uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF _msg = '' OR char_length(_msg) > 5000 THEN RAISE EXCEPTION 'invalid_message'; END IF;
  PERFORM 1 FROM public.merchant_support_tickets
   WHERE id = _ticket_id AND merchant_id = _uid AND deleted_by_merchant = false FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ticket_not_found'; END IF;
  INSERT INTO public.merchant_support_ticket_messages (ticket_id, sender_type, sender_user_id, message)
  VALUES (_ticket_id, 'merchant', _uid, _msg) RETURNING id INTO _id;
  UPDATE public.merchant_support_tickets
     SET status = 'pending', last_interaction_by = 'lojista', last_interaction_at = now()
   WHERE id = _ticket_id;
  RETURN _id;
END $$;

CREATE OR REPLACE FUNCTION public.support_reply_merchant_ticket(_ticket_id uuid, _message text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _msg text := btrim(coalesce(_message,'')); _id uuid;
BEGIN
  IF _uid IS NULL OR NOT (public.has_role(_uid,'admin') OR public.has_role(_uid,'suporte')) THEN
    RAISE EXCEPTION 'forbidden'; END IF;
  IF _msg = '' OR char_length(_msg) > 5000 THEN RAISE EXCEPTION 'invalid_message'; END IF;
  PERFORM 1 FROM public.merchant_support_tickets WHERE id = _ticket_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ticket_not_found'; END IF;
  INSERT INTO public.merchant_support_ticket_messages (ticket_id, sender_type, sender_user_id, message)
  VALUES (_ticket_id, 'support', _uid, _msg) RETURNING id INTO _id;
  UPDATE public.merchant_support_tickets
     SET response = _msg, status = 'answered', answered_at = now(),
         last_interaction_by = 'admin', last_interaction_at = now()
   WHERE id = _ticket_id;
  RETURN _id;
END $$;

REVOKE ALL ON FUNCTION public.merchant_reply_support_ticket(uuid,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.support_reply_merchant_ticket(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.merchant_reply_support_ticket(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.support_reply_merchant_ticket(uuid,text) TO authenticated;
REVOKE ALL ON FUNCTION public.mst_record_initial_message() FROM PUBLIC, anon, authenticated;