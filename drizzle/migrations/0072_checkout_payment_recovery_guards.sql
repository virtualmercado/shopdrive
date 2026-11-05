CREATE FUNCTION public.authorize_checkout_payment_status(p_order_id uuid,p_user_id uuid,p_token_hash text,p_method text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE o public.orders; a public.checkout_payment_attempts;
BEGIN
 IF p_user_id IS NOT NULL THEN RETURN public.authorize_checkout_payment(p_order_id,p_user_id,p_token_hash,p_method); END IF;
 SELECT * INTO o FROM public.orders WHERE id=p_order_id;
 SELECT * INTO a FROM public.checkout_payment_attempts WHERE order_id=p_order_id;
 IF a.state NOT IN ('submitting','unknown','pending','approved','rejected','cancelled','expired') OR a.token_hash IS DISTINCT FROM p_token_hash
 OR a.store_owner_id IS DISTINCT FROM o.store_owner_id OR a.customer_id IS NOT NULL OR o.customer_id IS NOT NULL OR o.is_guest_order IS DISTINCT FROM true OR o.payment_method IS DISTINCT FROM p_method
 THEN RAISE EXCEPTION 'Pagamento não autorizado' USING ERRCODE='42501'; END IF;
 RETURN jsonb_build_object('id',o.id,'store_owner_id',o.store_owner_id,'total_amount',o.total_amount,'customer_email',o.customer_email,'customer_name',o.customer_name,'customer_phone',o.customer_phone,'payment_status',o.payment_status,'pix_payment_status',o.pix_payment_status,'status',o.status,'card_payment_id',o.card_payment_id);
END $$;
REVOKE ALL ON FUNCTION public.authorize_checkout_payment_status(uuid,uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.authorize_checkout_payment_status(uuid,uuid,text,text) TO service_role;
CREATE OR REPLACE FUNCTION public.claim_checkout_payment(p_order_id uuid,p_user_id uuid,p_token_hash text,p_method text,p_gateway text,p_status_only boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a public.checkout_payment_attempts; o public.orders; v_auth jsonb;
BEGIN
 IF p_status_only THEN v_auth:=public.authorize_checkout_payment_status(p_order_id,p_user_id,p_token_hash,p_method);
 ELSE v_auth:=public.authorize_checkout_payment(p_order_id,p_user_id,p_token_hash,p_method); END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_order_id::text,0));
 SELECT * INTO o FROM public.orders WHERE id=p_order_id FOR UPDATE;
 SELECT * INTO a FROM public.checkout_payment_attempts WHERE order_id=p_order_id FOR UPDATE;
 IF NOT FOUND THEN
  IF p_user_id IS NULL THEN RAISE EXCEPTION 'Pagamento não autorizado' USING ERRCODE='42501'; END IF;
  INSERT INTO public.checkout_payment_attempts(store_owner_id,customer_id,token_hash,order_id,state,external_payment_id)
  VALUES(o.store_owner_id,o.customer_id,encode(extensions.gen_random_bytes(32),'hex'),o.id,CASE WHEN o.card_payment_id IS NOT NULL OR o.pix_payment_id IS NOT NULL THEN 'pending' ELSE 'ready' END,o.card_payment_id) RETURNING * INTO a;
 END IF;
 IF a.gateway IS NOT NULL AND a.gateway IS DISTINCT FROM p_gateway THEN RAISE EXCEPTION 'Gateway do pedido já definido'; END IF;
 IF o.payment_status='approved' OR o.pix_payment_status='approved' THEN
  UPDATE public.checkout_payment_attempts SET state='approved',updated_at=now() WHERE id=a.id;
  RETURN jsonb_build_object('state','approved','charge',false,'externalPaymentId',coalesce(a.external_payment_id,o.card_payment_id),'orderConfirmed',true);
 END IF;
 IF a.state='ready' AND (o.status NOT IN ('pending','pendente') OR o.payment_status NOT IN ('pending','aguardando_combinar') OR EXISTS(SELECT 1 FROM public.order_stock_movements WHERE order_id=o.id AND kind='restore')) THEN RAISE EXCEPTION 'Pedido encerrado ou estoque devolvido'; END IF;
 IF a.state='ready' AND NOT p_status_only THEN
  UPDATE public.checkout_payment_attempts SET state='submitting',gateway=p_gateway,updated_at=now() WHERE id=a.id;
  RETURN jsonb_build_object('state','submitting','charge',true,'idempotencyKey','order-'||o.id);
 END IF;
 RETURN jsonb_build_object('state',a.state,'charge',false,'externalPaymentId',a.external_payment_id,'idempotencyKey','order-'||o.id);
END $$;
CREATE FUNCTION public.guard_checkout_payment_item_stock() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM public.checkout_payment_attempts WHERE order_id=OLD.order_id AND state IN ('submitting','unknown','pending','approved')) THEN RAISE EXCEPTION 'Reconcilie ou encerre o pagamento antes de alterar os itens'; END IF;
 RETURN OLD;
END $$;
CREATE TRIGGER aa_checkout_payment_item_guard BEFORE DELETE ON public.order_items FOR EACH ROW EXECUTE FUNCTION public.guard_checkout_payment_item_stock();