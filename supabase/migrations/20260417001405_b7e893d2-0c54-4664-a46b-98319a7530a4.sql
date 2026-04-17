
-- 1. Função para auto-expirar pagamentos PIX vencidos
CREATE OR REPLACE FUNCTION public.expire_stale_pix_payments()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  WITH expired_payments AS (
    UPDATE public.master_subscription_payments
    SET 
      status = 'expired',
      updated_at = now()
    WHERE 
      payment_method = 'pix'
      AND status = 'pending'
      AND pix_expires_at IS NOT NULL
      AND pix_expires_at < now()
    RETURNING subscription_id
  )
  SELECT count(*) INTO v_count FROM expired_payments;
  
  -- Atualizar subscriptions cujo último pagamento PIX expirou
  UPDATE public.master_subscriptions ms
  SET 
    status = 'expired',
    updated_at = now()
  WHERE 
    ms.status = 'pending'
    AND EXISTS (
      SELECT 1 FROM public.master_subscription_payments msp
      WHERE msp.subscription_id = ms.id
        AND msp.payment_method = 'pix'
        AND msp.status = 'expired'
        AND msp.created_at = (
          SELECT MAX(created_at) FROM public.master_subscription_payments
          WHERE subscription_id = ms.id
        )
    );
  
  RETURN v_count;
END;
$$;

-- 2. Executar limpeza imediata dos pagamentos PIX vencidos
SELECT public.expire_stale_pix_payments();

-- 3. Sincronizar payment_method das subscriptions com o último pagamento real
UPDATE public.master_subscriptions ms
SET payment_method = msp.payment_method
FROM public.master_subscription_payments msp
WHERE msp.subscription_id = ms.id
  AND msp.created_at = (
    SELECT MAX(created_at) FROM public.master_subscription_payments
    WHERE subscription_id = ms.id
  )
  AND ms.payment_method IS DISTINCT FROM msp.payment_method;
