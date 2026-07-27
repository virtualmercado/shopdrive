
-- 1) products: track was-active-before-restriction
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS was_active_before_plan_restriction boolean NOT NULL DEFAULT false;

-- 2) master_subscriptions: pending plan awaiting payment + audit link
ALTER TABLE public.master_subscriptions
  ADD COLUMN IF NOT EXISTS pending_plan_id text,
  ADD COLUMN IF NOT EXISTS source_profile_id uuid;

-- 3) store_clone_logs: idempotency
ALTER TABLE public.store_clone_logs
  ADD COLUMN IF NOT EXISTS idempotency_key text;

CREATE UNIQUE INDEX IF NOT EXISTS store_clone_logs_idempotency_key_uniq
  ON public.store_clone_logs (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- 4) Extend reactivate_products_after_upgrade to also recover
--    products deactivated during clone (inactive_reason = 'pending_plan_limit').
--    Only those with was_active_before_plan_restriction = true are reactivated
--    (products the source store had manually inactive stay inactive).
CREATE OR REPLACE FUNCTION public.reactivate_products_after_upgrade(p_user_id uuid, p_max_products integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_active_count integer;
  v_can_reactivate integer;
  v_reactivated integer := 0;
  v_ids uuid[];
BEGIN
  SELECT COUNT(*) INTO v_active_count
  FROM public.products
  WHERE user_id = p_user_id AND is_active = true;

  IF p_max_products IS NULL THEN
    UPDATE public.products
    SET is_active = true,
        inactive_reason = NULL,
        was_active_before_plan_restriction = false,
        updated_at = now()
    WHERE user_id = p_user_id
      AND is_active = false
      AND (
        inactive_reason = 'plan_limit'
        OR (inactive_reason = 'pending_plan_limit' AND was_active_before_plan_restriction = true)
      );
    GET DIAGNOSTICS v_reactivated = ROW_COUNT;
  ELSE
    v_can_reactivate := GREATEST(0, p_max_products - v_active_count);
    IF v_can_reactivate > 0 THEN
      SELECT ARRAY_AGG(id) INTO v_ids
      FROM (
        SELECT id
        FROM public.products
        WHERE user_id = p_user_id
          AND is_active = false
          AND (
            inactive_reason = 'plan_limit'
            OR (inactive_reason = 'pending_plan_limit' AND was_active_before_plan_restriction = true)
          )
        ORDER BY COALESCE(sales_count, 0) DESC,
                 COALESCE(is_featured, false) DESC,
                 created_at DESC,
                 id ASC
        LIMIT v_can_reactivate
      ) sub;

      IF v_ids IS NOT NULL THEN
        UPDATE public.products
        SET is_active = true,
            inactive_reason = NULL,
            was_active_before_plan_restriction = false,
            updated_at = now()
        WHERE id = ANY(v_ids);
        GET DIAGNOSTICS v_reactivated = ROW_COUNT;
      END IF;
    END IF;
  END IF;

  RETURN v_reactivated;
END;
$function$;
