-- Clone-store full data V2 support: preserve all copied records, apply plan limits only to active status.

-- 1) Products: allow clone-specific inactive reasons and tie copied records to clone job.
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS clone_job_id uuid REFERENCES public.store_clone_logs(id) ON DELETE SET NULL;

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_inactive_reason_check;

ALTER TABLE public.products
  ADD CONSTRAINT products_inactive_reason_check
  CHECK (inactive_reason IS NULL OR inactive_reason IN ('manual', 'plan_limit', 'pending_plan_limit', 'clone_pending_plan_limit'));

CREATE INDEX IF NOT EXISTS idx_products_clone_job_id
  ON public.products (clone_job_id)
  WHERE clone_job_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS products_user_cloned_from_product_unique
  ON public.products (user_id, cloned_from_product_id)
  WHERE cloned_from_product_id IS NOT NULL;

-- 2) Clone logs: persist batch progress and integrity counters.
ALTER TABLE public.store_clone_logs
  ADD COLUMN IF NOT EXISTS source_products_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cloned_products_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS source_categories_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cloned_categories_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS source_brands_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cloned_brands_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS source_images_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cloned_images_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS clone_batch_size integer NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS clone_batches_processed integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS clone_last_product_cursor text,
  ADD COLUMN IF NOT EXISTS integrity_report jsonb NOT NULL DEFAULT '{}'::jsonb;

-- 3) Keep active-product enforcement, but return a clearer backend block for clone-limited products.
CREATE OR REPLACE FUNCTION public.activate_product_with_plan_validation(p_product_id uuid, p_active boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_product RECORD;
  v_plan jsonb;
  v_limit integer;
  v_active_count integer := 0;
  v_previous boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autorizado';
  END IF;

  SELECT id, user_id, is_active, inactive_reason
  INTO v_product
  FROM public.products
  WHERE id = p_product_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Produto não encontrado';
  END IF;

  IF v_product.user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Não autorizado';
  END IF;

  v_previous := v_product.is_active;

  IF p_active IS TRUE AND v_previous IS FALSE THEN
    v_plan := public.get_effective_store_plan(v_product.user_id);
    v_limit := NULLIF(v_plan->>'productLimit', '')::integer;

    IF COALESCE((v_plan->>'unlimited')::boolean, false) IS FALSE THEN
      SELECT COUNT(*)
      INTO v_active_count
      FROM public.products
      WHERE user_id = v_product.user_id
        AND is_active = true;

      IF v_active_count >= COALESCE(v_limit, 0) THEN
        RETURN jsonb_build_object(
          'success', false,
          'reason', 'plan_limit',
          'message', CASE
            WHEN v_product.inactive_reason IN ('clone_pending_plan_limit', 'pending_plan_limit') THEN
              format('Seu plano atual permite até %s produtos ativos. Escolha e pague um plano compatível para liberar mais produtos.', COALESCE(v_limit, 0))
            ELSE
              'Você atingiu o limite de produtos ativos do seu plano. Faça upgrade para publicar mais produtos.'
          END,
          'plan', v_plan->>'plan',
          'productLimit', v_limit,
          'activeProducts', v_active_count,
          'previousActive', v_previous
        );
      END IF;
    END IF;
  END IF;

  UPDATE public.products
  SET is_active = p_active,
      inactive_reason = CASE WHEN p_active THEN NULL ELSE 'manual' END,
      was_active_before_plan_restriction = CASE WHEN p_active THEN false ELSE was_active_before_plan_restriction END,
      updated_at = now()
  WHERE id = p_product_id;

  RETURN jsonb_build_object(
    'success', true,
    'productId', p_product_id,
    'previousActive', v_previous,
    'newActive', p_active,
    'origin', 'manual_toggle'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.activate_product_with_plan_validation(uuid, boolean) TO authenticated, service_role;

-- 4) Reactivate only products automatically disabled by plan logic; preserve manual inactive products.
CREATE OR REPLACE FUNCTION public.reactivate_products_after_upgrade(p_user_id uuid, p_max_products integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
      AND was_active_before_plan_restriction = true
      AND inactive_reason IN ('plan_limit', 'pending_plan_limit', 'clone_pending_plan_limit');
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
          AND was_active_before_plan_restriction = true
          AND inactive_reason IN ('plan_limit', 'pending_plan_limit', 'clone_pending_plan_limit')
        ORDER BY created_at ASC, id ASC
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
$$;

GRANT EXECUTE ON FUNCTION public.reactivate_products_after_upgrade(uuid, integer) TO service_role;

-- 5) Keep existing trigger behavior globally: it controls active status, not record creation.
CREATE OR REPLACE FUNCTION public.validate_product_activation_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan jsonb;
  v_limit integer;
  v_active_count integer;
  v_user_id uuid;
BEGIN
  IF NEW.is_active IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.is_active IS TRUE THEN
    RETURN NEW;
  END IF;

  v_user_id := NEW.user_id;

  IF auth.uid() IS NOT NULL AND auth.uid() <> v_user_id THEN
    RAISE EXCEPTION 'Não autorizado';
  END IF;

  v_plan := public.get_effective_store_plan(v_user_id);

  IF COALESCE((v_plan->>'unlimited')::boolean, false) THEN
    IF TG_OP = 'UPDATE' THEN
      NEW.inactive_reason := NULL;
      NEW.was_active_before_plan_restriction := false;
    END IF;
    RETURN NEW;
  END IF;

  v_limit := NULLIF(v_plan->>'productLimit', '')::integer;

  SELECT COUNT(*)
  INTO v_active_count
  FROM public.products
  WHERE user_id = v_user_id
    AND is_active = true
    AND (TG_OP = 'INSERT' OR id <> NEW.id);

  IF v_active_count >= COALESCE(v_limit, 0) THEN
    RAISE EXCEPTION 'Você atingiu o limite de produtos ativos do seu plano. Faça upgrade para publicar mais produtos.';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    NEW.inactive_reason := NULL;
    NEW.was_active_before_plan_restriction := false;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_product_activation_limit ON public.products;
CREATE TRIGGER trg_validate_product_activation_limit
BEFORE INSERT OR UPDATE OF is_active ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.validate_product_activation_limit();