ALTER TABLE public.ticket_landing_responses
  ADD COLUMN IF NOT EXISTS idempotency_key text,
  ADD COLUMN IF NOT EXISTS email_queue_id uuid,
  ADD COLUMN IF NOT EXISTS erro_envio text,
  ADD COLUMN IF NOT EXISTS enviado_em timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS ticket_landing_responses_idempotency_key_uidx
  ON public.ticket_landing_responses (idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ticket_landing_responses_email_queue_id_uidx
  ON public.ticket_landing_responses (email_queue_id) WHERE email_queue_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public._ltr_on_email_queue_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_ticket uuid;
BEGIN
  IF NEW.status = 'sent' THEN
    UPDATE public.ticket_landing_responses
       SET status_envio = 'enviado', erro_envio = NULL, enviado_em = COALESCE(NEW.sent_at, now())
     WHERE email_queue_id = NEW.id AND status_envio <> 'enviado'
     RETURNING ticket_id INTO v_ticket;
    IF v_ticket IS NOT NULL THEN
      UPDATE public.tickets_landing_page
         SET status = 'aguardando_cliente', updated_at = now()
       WHERE id = v_ticket AND status NOT IN ('resolvido','fechado');
    END IF;
  ELSIF NEW.status IN ('failed','blocked') THEN
    UPDATE public.ticket_landing_responses
       SET status_envio = 'falha', erro_envio = left(COALESCE(NEW.last_error, 'Falha no envio'), 500)
     WHERE email_queue_id = NEW.id AND status_envio <> 'enviado';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public._ltr_on_email_queue_status() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_ltr_email_queue_status ON public.email_queue;
CREATE TRIGGER trg_ltr_email_queue_status
AFTER UPDATE OF status ON public.email_queue
FOR EACH ROW
WHEN (NEW.status IN ('sent','failed','blocked') AND NEW.status IS DISTINCT FROM OLD.status
      AND NEW.template = 'landing_ticket_response')
EXECUTE FUNCTION public._ltr_on_email_queue_status();