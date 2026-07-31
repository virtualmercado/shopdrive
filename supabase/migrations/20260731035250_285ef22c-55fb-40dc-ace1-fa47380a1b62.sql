-- =========================================================
-- 1. CUSTOMER_PROFILES: permitir registro comercial sem conta de acesso
-- =========================================================
ALTER TABLE public.customer_profiles
  DROP CONSTRAINT IF EXISTS customer_profiles_id_fkey;

ALTER TABLE public.customer_profiles
  ALTER COLUMN email DROP NOT NULL,
  ALTER COLUMN id SET DEFAULT gen_random_uuid();

ALTER TABLE public.customer_profiles
  ADD COLUMN IF NOT EXISTS is_guest_record boolean NOT NULL DEFAULT false;

ALTER TABLE public.customer_profiles
  ADD COLUMN IF NOT EXISTS email_normalized text
    GENERATED ALWAYS AS (NULLIF(lower(btrim(coalesce(email, ''))), '')) STORED,
  ADD COLUMN IF NOT EXISTS phone_normalized text
    GENERATED ALWAYS AS (NULLIF(regexp_replace(coalesce(phone, ''), '\D', '', 'g'), '')) STORED,
  ADD COLUMN IF NOT EXISTS cpf_normalized text
    GENERATED ALWAYS AS (NULLIF(regexp_replace(coalesce(cpf, ''), '\D', '', 'g'), '')) STORED;

CREATE INDEX IF NOT EXISTS idx_customer_profiles_email_norm ON public.customer_profiles (email_normalized);
CREATE INDEX IF NOT EXISTS idx_customer_profiles_phone_norm ON public.customer_profiles (phone_normalized);
CREATE INDEX IF NOT EXISTS idx_customer_profiles_cpf_norm ON public.customer_profiles (cpf_normalized);

-- =========================================================
-- 2. STORE_CUSTOMERS: rastreabilidade, idempotência e motivo de inativação
-- =========================================================
ALTER TABLE public.store_customers
  ADD COLUMN IF NOT EXISTS source_order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_incomplete boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS deactivated_by_system boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS deactivation_reason text,
  ADD COLUMN IF NOT EXISTS deactivated_at timestamptz,
  ADD COLUMN IF NOT EXISTS first_order_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_order_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS uq_store_customers_source_order
  ON public.store_customers (store_owner_id, source_order_id)
  WHERE source_order_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_store_customers_owner_active
  ON public.store_customers (store_owner_id, is_active);

CREATE INDEX IF NOT EXISTS idx_orders_store_customer ON public.orders (store_owner_id, customer_id);

-- =========================================================
-- 3. LIMITE DE CLIENTES DO PLANO EFETIVAMENTE ATIVO
-- =========================================================
CREATE OR REPLACE FUNCTION public.get_store_customer_limit(p_store_id uuid)
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_plan text;
BEGIN
  v_plan := coalesce(public.get_effective_store_plan(p_store_id) ->> 'plan', 'free');
  IF v_plan = 'premium' THEN
    RETURN NULL; -- ilimitado
  ELSIF v_plan = 'pro' THEN
    RETURN 300;
  END IF;
  RETURN 40;
END;
$$;

-- =========================================================
-- 4. ROTINA CENTRAL DE SINCRONIZAÇÃO
-- =========================================================
CREATE OR REPLACE FUNCTION public.sync_customer_from_order(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  o public.orders%ROWTYPE;
  v_store uuid;
  v_name text;
  v_email text;
  v_email_n text;
  v_phone text;
  v_phone_n text;
  v_cpf_n text;
  v_cid uuid;
  v_match_by text := NULL;
  v_conflict boolean := false;
  v_candidate uuid;
  v_limit integer;
  v_active_count integer;
  v_should_activate boolean := true;
  v_action text := 'reused';
  v_incomplete boolean := false;
BEGIN
  SELECT * INTO o FROM public.orders WHERE id = p_order_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'order_not_found', 'order_id', p_order_id);
  END IF;

  v_store := o.store_owner_id;
  v_name := NULLIF(btrim(regexp_replace(coalesce(o.customer_name, ''), '\s+', ' ', 'g')), '');
  v_email := NULLIF(btrim(coalesce(o.customer_email, '')), '');
  v_email_n := NULLIF(lower(coalesce(v_email, '')), '');
  v_phone := NULLIF(btrim(coalesce(o.customer_phone, '')), '');
  v_phone_n := NULLIF(regexp_replace(coalesce(v_phone, ''), '\D', '', 'g'), '');
  IF v_phone_n IS NOT NULL AND length(v_phone_n) < 10 THEN
    v_phone_n := NULL;
  END IF;
  v_cpf_n := NULL; -- pedidos não armazenam CPF hoje

  IF v_name IS NULL AND v_email_n IS NULL AND v_phone_n IS NULL THEN
    RETURN jsonb_build_object('status', 'no_buyer_data', 'order_id', p_order_id);
  END IF;

  -- Serializa por loja (evita race condition no limite do plano)
  PERFORM pg_advisory_xact_lock(hashtext('store_customer_sync:' || v_store::text));

  -- (0) idempotência: pedido já originou um cadastro nesta loja
  SELECT customer_id INTO v_cid
  FROM public.store_customers
  WHERE store_owner_id = v_store AND source_order_id = o.id
  LIMIT 1;
  IF v_cid IS NOT NULL THEN v_match_by := 'source_order'; END IF;

  -- (1) vínculo explícito do pedido, desde que pertença à mesma loja
  IF v_cid IS NULL AND o.customer_id IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM public.store_customers
               WHERE store_owner_id = v_store AND customer_id = o.customer_id) THEN
      v_cid := o.customer_id;
      v_match_by := 'order_customer_id';
    ELSIF EXISTS (SELECT 1 FROM public.customer_profiles WHERE id = o.customer_id) THEN
      v_cid := o.customer_id; -- comprador autenticado ainda não vinculado à loja
      v_match_by := 'authenticated_customer';
    END IF;
  END IF;

  -- (2) e-mail normalizado / (3) telefone normalizado — sempre dentro da loja
  IF v_cid IS NULL AND v_email_n IS NOT NULL THEN
    SELECT cp.id INTO v_cid
    FROM public.store_customers sc
    JOIN public.customer_profiles cp ON cp.id = sc.customer_id
    WHERE sc.store_owner_id = v_store AND cp.email_normalized = v_email_n
    ORDER BY sc.created_at ASC
    LIMIT 1;
    IF v_cid IS NOT NULL THEN v_match_by := 'email'; END IF;
  END IF;

  IF v_phone_n IS NOT NULL THEN
    SELECT cp.id INTO v_candidate
    FROM public.store_customers sc
    JOIN public.customer_profiles cp ON cp.id = sc.customer_id
    WHERE sc.store_owner_id = v_store AND cp.phone_normalized = v_phone_n
    ORDER BY sc.created_at ASC
    LIMIT 1;

    IF v_cid IS NULL AND v_candidate IS NOT NULL THEN
      v_cid := v_candidate;
      v_match_by := 'phone';
    ELSIF v_cid IS NOT NULL AND v_candidate IS NOT NULL AND v_candidate <> v_cid THEN
      v_conflict := true; -- identificadores apontam para cadastros distintos: não mesclar
    END IF;
  END IF;

  IF v_cid IS NULL THEN
    -- Novo cadastro: avalia limite de clientes ativos do plano efetivo
    v_limit := public.get_store_customer_limit(v_store);
    IF v_limit IS NOT NULL THEN
      SELECT count(*) INTO v_active_count
      FROM public.store_customers
      WHERE store_owner_id = v_store AND is_active = true;
      v_should_activate := v_active_count < v_limit;
    END IF;

    v_incomplete := (v_email_n IS NULL AND v_phone_n IS NULL);

    INSERT INTO public.customer_profiles (id, full_name, email, phone, is_guest_record)
    VALUES (
      gen_random_uuid(),
      coalesce(v_name, 'Cliente sem nome'),
      v_email,
      v_phone,
      o.customer_id IS NULL
    )
    RETURNING id INTO v_cid;

    INSERT INTO public.store_customers (
      store_owner_id, customer_id, is_active, origin, source_order_id, is_incomplete,
      deactivated_by_system, deactivation_reason, deactivated_at, first_order_at, last_order_at
    )
    VALUES (
      v_store, v_cid, v_should_activate,
      CASE WHEN o.order_source = 'manual' THEN 'manual' ELSE 'online_store' END,
      o.id, v_incomplete,
      NOT v_should_activate,
      CASE WHEN v_should_activate THEN NULL ELSE 'plan_limit' END,
      CASE WHEN v_should_activate THEN NULL ELSE now() END,
      o.created_at, o.created_at
    );

    v_action := CASE WHEN v_should_activate THEN 'created' ELSE 'created_inactive_plan_limit' END;
  ELSE
    -- Cadastro existente: apenas enriquece campos vazios
    UPDATE public.customer_profiles cp
    SET full_name = CASE WHEN NULLIF(btrim(coalesce(cp.full_name, '')), '') IS NULL
                         THEN coalesce(v_name, cp.full_name) ELSE cp.full_name END,
        email     = coalesce(NULLIF(btrim(coalesce(cp.email, '')), ''), v_email),
        phone     = coalesce(NULLIF(btrim(coalesce(cp.phone, '')), ''), v_phone)
    WHERE cp.id = v_cid;

    INSERT INTO public.store_customers (store_owner_id, customer_id, is_active, origin, first_order_at, last_order_at)
    VALUES (v_store, v_cid, true,
            CASE WHEN o.order_source = 'manual' THEN 'manual' ELSE 'online_store' END,
            o.created_at, o.created_at)
    ON CONFLICT (store_owner_id, customer_id) DO UPDATE
      SET first_order_at = LEAST(coalesce(public.store_customers.first_order_at, EXCLUDED.first_order_at), EXCLUDED.first_order_at),
          last_order_at  = GREATEST(coalesce(public.store_customers.last_order_at, EXCLUDED.last_order_at), EXCLUDED.last_order_at);

    UPDATE public.store_customers
    SET is_incomplete = false
    WHERE store_owner_id = v_store AND customer_id = v_cid
      AND is_incomplete = true
      AND EXISTS (SELECT 1 FROM public.customer_profiles cp
                  WHERE cp.id = v_cid AND (cp.email_normalized IS NOT NULL OR cp.phone_normalized IS NOT NULL));
  END IF;

  -- Vincula o pedido ao cliente (snapshot do pedido permanece inalterado)
  IF o.customer_id IS DISTINCT FROM v_cid THEN
    UPDATE public.orders SET customer_id = v_cid WHERE id = o.id;
  END IF;

  IF v_conflict THEN
    RAISE LOG 'sync_customer_from_order: identity conflict order=% store=%', o.id, v_store;
  END IF;

  RETURN jsonb_build_object(
    'status', 'ok',
    'order_id', o.id,
    'store_id', v_store,
    'customer_id', v_cid,
    'action', v_action,
    'matched_by', v_match_by,
    'conflict', v_conflict
  );
END;
$$;

REVOKE ALL ON FUNCTION public.sync_customer_from_order(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_store_customer_limit(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_customer_from_order(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_store_customer_limit(uuid) TO authenticated, service_role;

-- =========================================================
-- 5. TRIGGER (substitui a regra antiga, sem bloquear o pedido)
-- =========================================================
CREATE OR REPLACE FUNCTION public.handle_new_order_customer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  BEGIN
    PERFORM public.sync_customer_from_order(NEW.id);
  EXCEPTION WHEN OTHERS THEN
    RAISE LOG 'handle_new_order_customer failed order=% store=% sqlstate=%', NEW.id, NEW.store_owner_id, SQLSTATE;
  END;
  RETURN NEW;
END;
$$;

-- =========================================================
-- 6. BACKFILL IDEMPOTENTE (simulação + execução em lotes)
-- =========================================================
CREATE OR REPLACE FUNCTION public.backfill_store_customers(
  p_store_id uuid,
  p_limit integer DEFAULT 200,
  p_dry_run boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  r RECORD;
  v_res jsonb;
  v_analyzed int := 0;
  v_created int := 0;
  v_inactive int := 0;
  v_reused int := 0;
  v_conflicts int := 0;
  v_nodata int := 0;
  v_errors int := 0;
BEGIN
  IF p_store_id IS NULL THEN
    RAISE EXCEPTION 'store_id obrigatório';
  END IF;
  IF auth.uid() IS DISTINCT FROM p_store_id AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Não autorizado';
  END IF;

  IF p_dry_run THEN
    SELECT count(*) INTO v_analyzed FROM public.orders WHERE store_owner_id = p_store_id;
    SELECT count(*) INTO v_reused FROM public.orders o
      WHERE o.store_owner_id = p_store_id AND o.customer_id IS NOT NULL
        AND EXISTS (SELECT 1 FROM public.store_customers sc
                    WHERE sc.store_owner_id = p_store_id AND sc.customer_id = o.customer_id);
    SELECT count(DISTINCT coalesce(
             NULLIF(lower(btrim(coalesce(o.customer_email, ''))), ''),
             NULLIF(regexp_replace(coalesce(o.customer_phone, ''), '\D', '', 'g'), ''),
             o.id::text))
      INTO v_created
    FROM public.orders o
    WHERE o.store_owner_id = p_store_id AND o.customer_id IS NULL;
    SELECT count(*) INTO v_nodata FROM public.orders o
      WHERE o.store_owner_id = p_store_id
        AND NULLIF(btrim(coalesce(o.customer_name, '')), '') IS NULL
        AND NULLIF(btrim(coalesce(o.customer_email, '')), '') IS NULL
        AND NULLIF(btrim(coalesce(o.customer_phone, '')), '') IS NULL;

    RETURN jsonb_build_object(
      'dry_run', true, 'store_id', p_store_id,
      'orders_analyzed', v_analyzed,
      'orders_already_linked', v_reused,
      'estimated_new_customers', v_created,
      'orders_without_buyer_data', v_nodata,
      'customer_limit', public.get_store_customer_limit(p_store_id),
      'active_customers_now', (SELECT count(*) FROM public.store_customers
                               WHERE store_owner_id = p_store_id AND is_active = true)
    );
  END IF;

  FOR r IN
    SELECT o.id FROM public.orders o
    WHERE o.store_owner_id = p_store_id
      AND NOT EXISTS (
        SELECT 1 FROM public.store_customers sc
        WHERE sc.store_owner_id = p_store_id
          AND (sc.source_order_id = o.id
               OR (o.customer_id IS NOT NULL AND sc.customer_id = o.customer_id))
      )
    ORDER BY o.created_at ASC
    LIMIT greatest(coalesce(p_limit, 200), 1)
  LOOP
    v_analyzed := v_analyzed + 1;
    BEGIN
      v_res := public.sync_customer_from_order(r.id);
      IF v_res ->> 'status' = 'no_buyer_data' THEN
        v_nodata := v_nodata + 1;
      ELSIF v_res ->> 'action' = 'created' THEN
        v_created := v_created + 1;
      ELSIF v_res ->> 'action' = 'created_inactive_plan_limit' THEN
        v_created := v_created + 1;
        v_inactive := v_inactive + 1;
      ELSE
        v_reused := v_reused + 1;
      END IF;
      IF coalesce((v_res ->> 'conflict')::boolean, false) THEN
        v_conflicts := v_conflicts + 1;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_errors := v_errors + 1;
      RAISE LOG 'backfill_store_customers error order=% sqlstate=%', r.id, SQLSTATE;
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'dry_run', false, 'store_id', p_store_id,
    'orders_processed', v_analyzed,
    'customers_created', v_created,
    'customers_reused', v_reused,
    'customers_inactive_plan_limit', v_inactive,
    'conflicts', v_conflicts,
    'orders_without_buyer_data', v_nodata,
    'errors', v_errors,
    'remaining', (SELECT count(*) FROM public.orders o
                  WHERE o.store_owner_id = p_store_id
                    AND NOT EXISTS (
                      SELECT 1 FROM public.store_customers sc
                      WHERE sc.store_owner_id = p_store_id
                        AND (sc.source_order_id = o.id
                             OR (o.customer_id IS NOT NULL AND sc.customer_id = o.customer_id))))
  );
END;
$$;

REVOKE ALL ON FUNCTION public.backfill_store_customers(uuid, integer, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.backfill_store_customers(uuid, integer, boolean) TO authenticated, service_role;

-- =========================================================
-- 7. RLS: lojista gerencia cadastros comerciais da própria loja
-- =========================================================
DROP POLICY IF EXISTS "Store owners can insert customer profiles" ON public.customer_profiles;
CREATE POLICY "Store owners can insert customer profiles"
ON public.customer_profiles FOR INSERT TO authenticated
WITH CHECK (auth.uid() <> id);

DROP POLICY IF EXISTS "Store owners can update their customers profiles" ON public.customer_profiles;
CREATE POLICY "Store owners can update their customers profiles"
ON public.customer_profiles FOR UPDATE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.store_customers sc
  WHERE sc.customer_id = customer_profiles.id AND sc.store_owner_id = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.store_customers sc
  WHERE sc.customer_id = customer_profiles.id AND sc.store_owner_id = auth.uid()
));