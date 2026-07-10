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
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_product_activation_limit ON public.products;
CREATE TRIGGER trg_validate_product_activation_limit
BEFORE INSERT OR UPDATE OF is_active ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.validate_product_activation_limit();