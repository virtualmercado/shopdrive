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
       WHERE id = v_ticket AND status NOT IN ('resolvido','arquivado');
    END IF;
  ELSIF NEW.status IN ('failed','blocked') THEN
    UPDATE public.ticket_landing_responses
       SET status_envio = 'falha', erro_envio = left(COALESCE(NEW.last_error, 'Falha no envio'), 500)
     WHERE email_queue_id = NEW.id AND status_envio <> 'enviado';
  END IF;
  RETURN NEW;
END $$;