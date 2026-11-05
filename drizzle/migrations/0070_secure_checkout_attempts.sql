CREATE TABLE public.checkout_payment_attempts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), store_owner_id uuid NOT NULL REFERENCES public.profiles(id), customer_id uuid,
 token_hash text NOT NULL, expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'), order_id uuid UNIQUE REFERENCES public.orders(id), intent jsonb,
 state text NOT NULL DEFAULT 'ready' CHECK (state IN ('ready','submitting','unknown','pending','approved','rejected','cancelled','expired')),
 gateway text, external_payment_id text, qr_code text, qr_code_base64 text, pix_expires_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.checkout_payment_attempts TO service_role;
ALTER TABLE public.checkout_payment_attempts ENABLE ROW LEVEL SECURITY;
CREATE UNIQUE INDEX checkout_payment_external_unique ON public.checkout_payment_attempts(gateway, external_payment_id) WHERE external_payment_id IS NOT NULL;
CREATE FUNCTION public.begin_checkout_attempt(p_store_owner_id uuid, p_customer_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_token text; v_attempt public.checkout_payment_attempts;
BEGIN
 IF NOT public.is_active_store(p_store_owner_id) THEN RAISE EXCEPTION 'Loja indisponível'; END IF;
 IF p_customer_id IS NOT NULL AND p_customer_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Cliente inválido'; END IF;
 v_token := encode(extensions.gen_random_bytes(32),'hex');
 INSERT INTO public.checkout_payment_attempts(store_owner_id,customer_id,token_hash)
 VALUES(p_store_owner_id,p_customer_id,encode(extensions.digest(v_token,'sha256'),'hex')) RETURNING * INTO v_attempt;
 RETURN jsonb_build_object('attemptId',v_attempt.id,'guestPaymentToken',v_token,'expiresAt',v_attempt.expires_at);
END $$;
REVOKE ALL ON FUNCTION public.begin_checkout_attempt(uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.begin_checkout_attempt(uuid,uuid) TO anon,authenticated;
CREATE FUNCTION public.create_checkout_order_once(p_attempt_id uuid,p_guest_payment_token text,p_order jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a public.checkout_payment_attempts; v_order jsonb; v_intent jsonb;
BEGIN
 SELECT * INTO a FROM public.checkout_payment_attempts WHERE id=p_attempt_id FOR UPDATE;
 IF NOT FOUND OR a.expires_at<=now() OR length(coalesce(p_guest_payment_token,''))<>64
 OR a.token_hash<>encode(extensions.digest(p_guest_payment_token,'sha256'),'hex')
 OR (a.customer_id IS NOT NULL AND a.customer_id IS DISTINCT FROM auth.uid())
 THEN RAISE EXCEPTION 'Tentativa não autorizada' USING ERRCODE='42501'; END IF;
 IF jsonb_typeof(p_order) IS DISTINCT FROM 'object'
 OR (p_order->>'p_store_owner_id')::uuid IS DISTINCT FROM a.store_owner_id
 OR nullif(p_order->>'p_customer_id','')::uuid IS DISTINCT FROM a.customer_id
 THEN RAISE EXCEPTION 'Tentativa não autorizada' USING ERRCODE='42501'; END IF;
 v_intent := p_order - ARRAY['p_status','p_payment_status','p_checkout_origin','p_is_guest_order'];
 IF a.order_id IS NOT NULL THEN
  IF a.intent IS DISTINCT FROM v_intent THEN RAISE EXCEPTION 'checkout_content_changed: Reconcilie ou cancele o pedido anterior antes de alterar o carrinho'; END IF;
  SELECT to_jsonb(o) INTO v_order FROM public.orders o WHERE o.id=a.order_id;
  RETURN v_order;
 END IF;
 v_order := public.create_checkout_order(
 p_store_owner_id=>a.store_owner_id,p_customer_id=>a.customer_id,
 p_customer_name=>p_order->>'p_customer_name',p_customer_email=>p_order->>'p_customer_email',p_customer_phone=>p_order->>'p_customer_phone',
 p_customer_address=>p_order->>'p_customer_address',p_delivery_method=>p_order->>'p_delivery_method',p_payment_method=>p_order->>'p_payment_method',
 p_subtotal=>(p_order->>'p_subtotal')::numeric,p_delivery_fee=>(p_order->>'p_delivery_fee')::numeric,p_total_amount=>(p_order->>'p_total_amount')::numeric,
 p_status=>'pending',p_payment_status=>CASE WHEN p_order->>'p_payment_method'='whatsapp' THEN 'aguardando_combinar' ELSE 'pending' END,
 p_notes=>p_order->>'p_notes',p_order_source=>p_order->>'p_order_source',
 p_checkout_origin=>CASE WHEN a.customer_id IS NULL THEN 'checkout_guest' ELSE 'checkout_customer' END,p_is_guest_order=>a.customer_id IS NULL,p_items=>p_order->'p_items');
 UPDATE public.checkout_payment_attempts SET order_id=(v_order->>'id')::uuid,intent=v_intent,updated_at=now() WHERE id=a.id;
 RETURN v_order;
END $$;
REVOKE ALL ON FUNCTION public.create_checkout_order_once(uuid,text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_checkout_order_once(uuid,text,jsonb) TO anon,authenticated;
CREATE FUNCTION public.authorize_checkout_payment(p_order_id uuid,p_user_id uuid,p_token_hash text,p_method text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE o public.orders; a public.checkout_payment_attempts; allowed boolean:=false;
BEGIN
 SELECT * INTO o FROM public.orders WHERE id=p_order_id;
 IF NOT FOUND OR o.payment_method IS DISTINCT FROM p_method THEN RAISE EXCEPTION 'Pagamento não autorizado' USING ERRCODE='42501'; END IF;
 IF p_user_id IS NOT NULL THEN
  allowed:=p_user_id=o.customer_id OR p_user_id=o.store_owner_id OR public.has_role(p_user_id,'admin');
 ELSE
  SELECT * INTO a FROM public.checkout_payment_attempts WHERE order_id=o.id;
  allowed:=a.order_id=o.id AND a.store_owner_id=o.store_owner_id AND a.customer_id IS NULL
   AND o.customer_id IS NULL AND o.is_guest_order=true AND a.expires_at>now() AND a.token_hash=p_token_hash;
 END IF;
 IF NOT coalesce(allowed,false) THEN RAISE EXCEPTION 'Pagamento não autorizado' USING ERRCODE='42501'; END IF;
 RETURN jsonb_build_object('id',o.id,'store_owner_id',o.store_owner_id,'total_amount',o.total_amount,
 'customer_email',o.customer_email,'customer_name',o.customer_name,'customer_phone',o.customer_phone,
 'payment_status',o.payment_status,'pix_payment_status',o.pix_payment_status,'status',o.status,'card_payment_id',o.card_payment_id);
END $$;
REVOKE ALL ON FUNCTION public.authorize_checkout_payment(uuid,uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.authorize_checkout_payment(uuid,uuid,text,text) TO service_role;
CREATE FUNCTION public.claim_checkout_payment(p_order_id uuid,p_user_id uuid,p_token_hash text,p_method text,p_gateway text,p_status_only boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a public.checkout_payment_attempts; o public.orders; v_auth jsonb;
BEGIN
 v_auth:=public.authorize_checkout_payment(p_order_id,p_user_id,p_token_hash,p_method);
 PERFORM pg_advisory_xact_lock(hashtextextended(p_order_id::text,0));
 SELECT * INTO o FROM public.orders WHERE id=p_order_id FOR UPDATE;
 SELECT * INTO a FROM public.checkout_payment_attempts WHERE order_id=p_order_id FOR UPDATE;
 IF NOT FOUND THEN
  IF p_user_id IS NULL THEN RAISE EXCEPTION 'Pagamento não autorizado' USING ERRCODE='42501'; END IF;
  INSERT INTO public.checkout_payment_attempts(store_owner_id,customer_id,token_hash,order_id,state,external_payment_id)
  VALUES(o.store_owner_id,o.customer_id,encode(extensions.gen_random_bytes(32),'hex'),o.id,
   CASE WHEN o.card_payment_id IS NOT NULL OR o.pix_payment_id IS NOT NULL THEN 'pending' ELSE 'ready' END,o.card_payment_id) RETURNING * INTO a;
 END IF;
 IF a.gateway IS NOT NULL AND a.gateway IS DISTINCT FROM p_gateway THEN RAISE EXCEPTION 'Gateway do pedido já definido'; END IF;
 IF o.payment_status='approved' OR o.pix_payment_status='approved' THEN
  UPDATE public.checkout_payment_attempts SET state='approved',updated_at=now() WHERE id=a.id;
  RETURN jsonb_build_object('state','approved','charge',false,'externalPaymentId',coalesce(a.external_payment_id,o.card_payment_id),'orderConfirmed',true);
 END IF;
 IF a.state='ready' AND (o.status NOT IN ('pending','pendente') OR o.payment_status NOT IN ('pending','aguardando_combinar')
  OR EXISTS(SELECT 1 FROM public.order_stock_movements WHERE order_id=o.id AND kind='restore')) THEN
  RAISE EXCEPTION 'Pedido encerrado ou estoque devolvido';
 END IF;
 IF a.state='ready' AND NOT p_status_only THEN
  UPDATE public.checkout_payment_attempts SET state='submitting',gateway=p_gateway,updated_at=now() WHERE id=a.id;
  RETURN jsonb_build_object('state','submitting','charge',true,'idempotencyKey','order-'||o.id);
 END IF;
 RETURN jsonb_build_object('state',a.state,'charge',false,'externalPaymentId',a.external_payment_id,'idempotencyKey','order-'||o.id);
END $$;
REVOKE ALL ON FUNCTION public.claim_checkout_payment(uuid,uuid,text,text,text,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_checkout_payment(uuid,uuid,text,text,text,boolean) TO service_role;
CREATE FUNCTION public.record_checkout_payment_result(p_order_id uuid,p_state text,p_external_id text DEFAULT NULL,p_qr text DEFAULT NULL,p_qr_base64 text DEFAULT NULL,p_pix_expires_at timestamptz DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a public.checkout_payment_attempts;
BEGIN
 SELECT * INTO a FROM public.checkout_payment_attempts WHERE order_id=p_order_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Tentativa inexistente'; END IF;
 IF p_state NOT IN ('ready','unknown','pending','approved','rejected','cancelled','expired') THEN RAISE EXCEPTION 'Estado inválido'; END IF;
 IF a.state IN ('approved','rejected','cancelled','expired') AND a.state<>p_state THEN RAISE EXCEPTION 'Estado final não pode ser substituído'; END IF;
 IF a.external_payment_id IS NOT NULL AND p_external_id IS NOT NULL AND a.external_payment_id<>p_external_id THEN RAISE EXCEPTION 'Referência de pagamento divergente'; END IF;
 UPDATE public.checkout_payment_attempts SET state=p_state,external_payment_id=coalesce(p_external_id,external_payment_id),
 qr_code=coalesce(p_qr,qr_code),qr_code_base64=coalesce(p_qr_base64,qr_code_base64),pix_expires_at=coalesce(p_pix_expires_at,pix_expires_at),updated_at=now() WHERE id=a.id;
END $$;
REVOKE ALL ON FUNCTION public.record_checkout_payment_result(uuid,text,text,text,text,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.record_checkout_payment_result(uuid,text,text,text,text,timestamptz) TO service_role;
CREATE FUNCTION public.apply_checkout_payment_result(p_order_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a public.checkout_payment_attempts; o public.orders; v_pix uuid;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(p_order_id::text,0));
 SELECT * INTO o FROM public.orders WHERE id=p_order_id FOR UPDATE;
 SELECT * INTO a FROM public.checkout_payment_attempts WHERE order_id=p_order_id FOR UPDATE;
 IF NOT FOUND OR a.external_payment_id IS NULL THEN RAISE EXCEPTION 'Resultado ainda desconhecido'; END IF;
 IF a.state='approved' AND EXISTS(SELECT 1 FROM public.order_stock_movements WHERE order_id=o.id AND kind='restore') THEN RAISE EXCEPTION 'Conciliação manual de estoque necessária'; END IF;
 IF o.payment_method='pix' AND a.qr_code IS NOT NULL THEN
  SELECT id INTO v_pix FROM public.pix_payments WHERE order_id=o.id AND external_payment_id=a.external_payment_id LIMIT 1;
  IF v_pix IS NULL THEN
   INSERT INTO public.pix_payments(order_id,store_owner_id,gateway,external_payment_id,amount,status,qr_code,qr_code_base64,expires_at)
   VALUES(o.id,o.store_owner_id,a.gateway,a.external_payment_id,o.total_amount,a.state,a.qr_code,a.qr_code_base64,a.pix_expires_at) RETURNING id INTO v_pix;
  ELSE UPDATE public.pix_payments SET status=a.state,updated_at=now(),paid_at=CASE WHEN a.state='approved' THEN coalesce(paid_at,now()) ELSE paid_at END WHERE id=v_pix; END IF;
  UPDATE public.orders SET pix_payment_id=v_pix,pix_payment_status=a.state,pix_qr_code=a.qr_code,pix_qr_code_base64=a.qr_code_base64,pix_expires_at=a.pix_expires_at WHERE id=o.id;
 END IF;
 UPDATE public.orders SET payment_status=CASE WHEN a.state IN ('approved','rejected','cancelled','expired') THEN a.state ELSE payment_status END,
 status=CASE WHEN a.state='approved' THEN 'confirmed' WHEN a.state IN ('rejected','cancelled','expired') THEN 'cancelled' ELSE status END,
 card_payment_id=CASE WHEN payment_method='cartao_credito' THEN a.external_payment_id ELSE card_payment_id END WHERE id=o.id;
 RETURN jsonb_build_object('status',a.state,'paymentId',a.external_payment_id,'orderConfirmed',a.state='approved',
 'pixPaymentId',v_pix,'qrCode',a.qr_code,'qrCodeBase64',a.qr_code_base64,'expiresAt',a.pix_expires_at,'amount',o.total_amount);
END $$;
REVOKE ALL ON FUNCTION public.apply_checkout_payment_result(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.apply_checkout_payment_result(uuid) TO service_role;
CREATE FUNCTION public.guard_checkout_payment_stock() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a public.checkout_payment_attempts;
BEGIN
 SELECT * INTO a FROM public.checkout_payment_attempts WHERE order_id=OLD.id;
 IF a.state IN ('submitting','unknown','pending') AND OLD.payment_status<>'approved' AND coalesce(OLD.pix_payment_status,'')<>'approved' THEN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Reconcilie o pagamento antes de excluir o pedido'; END IF;
  IF NEW.status IN ('cancelled','canceled','cancelado','expired','rejected') OR NEW.payment_status IN ('cancelled','rejected','expired','refunded') THEN
   RAISE EXCEPTION 'Reconcilie o pagamento antes de devolver o estoque';
  END IF;
 END IF;
 IF TG_OP='UPDATE' AND a.id IS NOT NULL AND NEW.pix_payment_status='approved' THEN
  NEW.payment_status:='approved';
  UPDATE public.checkout_payment_attempts SET state='approved',updated_at=now() WHERE id=a.id;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER aa_checkout_payment_stock_guard BEFORE UPDATE OR DELETE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.guard_checkout_payment_stock();