REVOKE ALL ON public.checkout_payment_attempts FROM anon, authenticated, PUBLIC;
GRANT ALL ON public.checkout_payment_attempts TO service_role;
CREATE FUNCTION public.close_checkout_attempt(p_attempt_id uuid,p_guest_payment_token text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a public.checkout_payment_attempts; o public.orders;
BEGIN
 SELECT * INTO a FROM public.checkout_payment_attempts WHERE id=p_attempt_id FOR UPDATE;
 IF NOT FOUND OR a.expires_at<=now() OR a.token_hash<>encode(extensions.digest(coalesce(p_guest_payment_token,''),'sha256'),'hex')
 OR (a.customer_id IS NOT NULL AND a.customer_id IS DISTINCT FROM auth.uid()) THEN RAISE EXCEPTION 'Tentativa não autorizada' USING ERRCODE='42501'; END IF;
 IF a.order_id IS NULL OR a.state NOT IN ('rejected','cancelled','expired') THEN RAISE EXCEPTION 'Reconcilie o pedido antes de iniciar outra tentativa'; END IF;
 SELECT * INTO o FROM public.orders WHERE id=a.order_id;
 IF o.status<>'cancelled' OR o.payment_status NOT IN ('rejected','cancelled','expired') THEN RAISE EXCEPTION 'Encerramento do pedido ainda pendente'; END IF;
 UPDATE public.checkout_payment_attempts SET expires_at=now(),updated_at=now() WHERE id=a.id;
END $$;
REVOKE ALL ON FUNCTION public.close_checkout_attempt(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.close_checkout_attempt(uuid,text) TO anon,authenticated;