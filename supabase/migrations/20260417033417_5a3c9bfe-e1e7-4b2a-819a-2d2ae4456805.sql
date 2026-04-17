-- 1. Adicionar coluna inactive_reason em products
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS inactive_reason TEXT 
CHECK (inactive_reason IN ('manual', 'plan_limit'));

CREATE INDEX IF NOT EXISTS idx_products_user_inactive_reason 
ON public.products(user_id, is_active, inactive_reason);

-- 2. Backfill: marcar produtos inativos de contas no plano gratis (acima do índice 20) como plan_limit
WITH free_users AS (
  SELECT DISTINCT user_id FROM public.master_subscriptions
  WHERE status IN ('active','past_due','expired','pending')
    AND plan_id IN ('gratis','free')
),
ranked AS (
  SELECT p.id,
         ROW_NUMBER() OVER (PARTITION BY p.user_id ORDER BY p.created_at ASC) AS rn
  FROM public.products p
  JOIN free_users f ON f.user_id = p.user_id
)
UPDATE public.products p
SET inactive_reason = 'plan_limit'
FROM ranked r
WHERE p.id = r.id
  AND p.is_active = false
  AND p.inactive_reason IS NULL
  AND r.rn > 20;

-- 3. Função para reativar produtos por limite de plano após upgrade
CREATE OR REPLACE FUNCTION public.reactivate_products_after_upgrade(
  p_user_id UUID,
  p_max_products INTEGER  -- NULL = ilimitado (Premium)
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_active_count INTEGER;
  v_can_reactivate INTEGER;
  v_reactivated INTEGER := 0;
  v_ids UUID[];
BEGIN
  -- Contar produtos atualmente ativos
  SELECT COUNT(*) INTO v_active_count
  FROM public.products
  WHERE user_id = p_user_id AND is_active = true;

  -- Calcular quantos podemos reativar
  IF p_max_products IS NULL THEN
    -- Ilimitado: reativa todos
    UPDATE public.products
    SET is_active = true,
        inactive_reason = NULL,
        updated_at = now()
    WHERE user_id = p_user_id
      AND is_active = false
      AND inactive_reason = 'plan_limit';
    GET DIAGNOSTICS v_reactivated = ROW_COUNT;
  ELSE
    v_can_reactivate := GREATEST(0, p_max_products - v_active_count);
    IF v_can_reactivate > 0 THEN
      SELECT ARRAY_AGG(id) INTO v_ids
      FROM (
        SELECT id FROM public.products
        WHERE user_id = p_user_id
          AND is_active = false
          AND inactive_reason = 'plan_limit'
        ORDER BY created_at ASC
        LIMIT v_can_reactivate
      ) sub;

      IF v_ids IS NOT NULL THEN
        UPDATE public.products
        SET is_active = true,
            inactive_reason = NULL,
            updated_at = now()
        WHERE id = ANY(v_ids);
        v_reactivated := array_length(v_ids, 1);
      END IF;
    END IF;
  END IF;

  RETURN v_reactivated;
END;
$$;