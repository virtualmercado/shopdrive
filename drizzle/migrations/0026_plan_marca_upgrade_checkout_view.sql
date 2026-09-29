-- Leitura para a página de pagamento contextual da troca MARCA. Decide o estado com o relógio do servidor
-- (get_my_marca_upgrade devolve o status gravado, que só muda na rotina diária). Somente leitura; sem ids internos.
CREATE OR REPLACE FUNCTION public.get_my_marca_upgrade_checkout()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN auth.uid() IS NULL OR NOT public.is_plan_marca_enabled() THEN jsonb_build_object('state','unavailable')
  ELSE coalesce((
    SELECT jsonb_build_object(
      'state', CASE
        WHEN u.status = 'activated' THEN 'activated'
        WHEN u.status = 'cancelled' THEN 'cancelled'
        WHEN u.status = 'expired' OR now() > u.grace_until THEN 'expired'
        WHEN now() < u.effective_at THEN 'scheduled'
        ELSE 'payable' END,
      'effective_at', u.effective_at, 'grace_until', u.grace_until,
      'amount', u.frozen_amount, 'currency', u.currency,
      'target_cycle', u.target_billing_cycle, 'source_plan', u.source_plan_id)
    FROM public.marca_scheduled_upgrades u
    WHERE u.store_profile_id = auth.uid() AND u.source_payment_method <> 'credit_card'
    ORDER BY u.created_at DESC LIMIT 1), jsonb_build_object('state','none')) END
$$;
REVOKE ALL ON FUNCTION public.get_my_marca_upgrade_checkout() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_marca_upgrade_checkout() TO authenticated;