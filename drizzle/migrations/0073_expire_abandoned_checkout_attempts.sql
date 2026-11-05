CREATE FUNCTION public.expire_abandoned_checkout_attempts(p_limit integer DEFAULT 200)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r record; a public.checkout_payment_attempts; o public.orders; n integer:=0;
BEGIN
 FOR r IN SELECT order_id FROM public.checkout_payment_attempts
  WHERE state='ready' AND order_id IS NOT NULL AND intent IS NOT NULL AND expires_at<=now()
  ORDER BY expires_at LIMIT greatest(1,least(coalesce(p_limit,200),1000))
 LOOP
  PERFORM pg_advisory_xact_lock(hashtextextended(r.order_id::text,0));
  SELECT * INTO o FROM public.orders WHERE id=r.order_id FOR UPDATE;
  SELECT * INTO a FROM public.checkout_payment_attempts WHERE order_id=r.order_id FOR UPDATE;
  -- Only attempts that never reached the gateway: still ready, no external reference, order still open.
  CONTINUE WHEN a.state<>'ready' OR a.external_payment_id IS NOT NULL OR a.expires_at>now()
   OR o.card_payment_id IS NOT NULL OR o.pix_payment_id IS NOT NULL
   OR o.status NOT IN ('pending','pendente') OR o.payment_status NOT IN ('pending','aguardando_combinar');
  UPDATE public.checkout_payment_attempts SET state='expired',updated_at=now() WHERE id=a.id;
  UPDATE public.orders SET status='cancelled',payment_status='expired' WHERE id=o.id;
  n:=n+1;
 END LOOP;
 RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.expire_abandoned_checkout_attempts(integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.expire_abandoned_checkout_attempts(integer) TO service_role;
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname='expire-abandoned-checkout-attempts';
SELECT cron.schedule('expire-abandoned-checkout-attempts','17 * * * *',$$select public.expire_abandoned_checkout_attempts()$$);