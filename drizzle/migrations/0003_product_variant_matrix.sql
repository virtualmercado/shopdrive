-- ============ Matriz de variantes com estoque por combinação ============
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS inventory_mode text NOT NULL DEFAULT 'simple',
  ADD COLUMN IF NOT EXISTS variant_seq integer NOT NULL DEFAULT 0;
DO $$ BEGIN
  ALTER TABLE public.products ADD CONSTRAINT products_inventory_mode_chk CHECK (inventory_mode IN ('simple','variant'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.product_option_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  name text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.product_option_groups TO anon, authenticated;
GRANT ALL ON public.product_option_groups TO service_role;
ALTER TABLE public.product_option_groups ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.product_option_values (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  option_group_id uuid NOT NULL REFERENCES public.product_option_groups(id) ON DELETE CASCADE,
  value text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.product_option_values TO anon, authenticated;
GRANT ALL ON public.product_option_values TO service_role;
ALTER TABLE public.product_option_values ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.product_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  sku text NOT NULL UNIQUE,
  seq integer NOT NULL,
  option_value_ids uuid[] NOT NULL,
  stock_quantity integer NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
  active boolean NOT NULL DEFAULT true,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, option_value_ids)
);
GRANT SELECT ON public.product_variants TO anon, authenticated;
GRANT ALL ON public.product_variants TO service_role;
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.product_variant_values (
  variant_id uuid NOT NULL REFERENCES public.product_variants(id) ON DELETE CASCADE,
  option_group_id uuid NOT NULL REFERENCES public.product_option_groups(id) ON DELETE CASCADE,
  option_value_id uuid NOT NULL REFERENCES public.product_option_values(id) ON DELETE CASCADE,
  store_id uuid NOT NULL,
  PRIMARY KEY (variant_id, option_group_id)
);
GRANT SELECT ON public.product_variant_values TO anon, authenticated;
GRANT ALL ON public.product_variant_values TO service_role;
ALTER TABLE public.product_variant_values ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_pog_store_product ON public.product_option_groups(store_id, product_id);
CREATE INDEX IF NOT EXISTS idx_pov_group ON public.product_option_values(option_group_id);
CREATE INDEX IF NOT EXISTS idx_pov_product ON public.product_option_values(product_id);
CREATE INDEX IF NOT EXISTS idx_pv_store_product ON public.product_variants(store_id, product_id);
CREATE INDEX IF NOT EXISTS idx_pvv_value ON public.product_variant_values(option_value_id);

-- RLS: leitura do dono, admin e loja pública (somente produtos ativos). Escrita apenas via RPC.
CREATE POLICY "Owner reads option groups" ON public.product_option_groups FOR SELECT TO authenticated USING (store_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Public reads option groups" ON public.product_option_groups FOR SELECT TO anon, authenticated
  USING (archived_at IS NULL AND public.is_public_store(store_id) AND EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_id AND p.user_id = store_id AND p.is_active = true));
CREATE POLICY "Owner reads option values" ON public.product_option_values FOR SELECT TO authenticated USING (store_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Public reads option values" ON public.product_option_values FOR SELECT TO anon, authenticated
  USING (archived_at IS NULL AND public.is_public_store(store_id) AND EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_id AND p.user_id = store_id AND p.is_active = true));
CREATE POLICY "Owner reads variants" ON public.product_variants FOR SELECT TO authenticated USING (store_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Public reads variants" ON public.product_variants FOR SELECT TO anon, authenticated
  USING (archived_at IS NULL AND public.is_public_store(store_id) AND EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_id AND p.user_id = store_id AND p.is_active = true));
CREATE POLICY "Owner reads variant values" ON public.product_variant_values FOR SELECT TO authenticated USING (store_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Public reads variant values" ON public.product_variant_values FOR SELECT TO anon, authenticated
  USING (public.is_public_store(store_id));

-- Pedidos: referência à variante + SKU
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS variant_id uuid REFERENCES public.product_variants(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS variant_sku text;
CREATE INDEX IF NOT EXISTS idx_order_items_variant ON public.order_items(variant_id);

-- Livro de movimentações (idempotência de baixa/estorno)
CREATE TABLE IF NOT EXISTS public.order_stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  order_item_id uuid NOT NULL REFERENCES public.order_items(id) ON DELETE CASCADE,
  variant_id uuid REFERENCES public.product_variants(id) ON DELETE SET NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  kind text NOT NULL CHECK (kind IN ('reserve','restore')),
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (order_item_id, kind)
);
GRANT SELECT ON public.order_stock_movements TO authenticated;
GRANT ALL ON public.order_stock_movements TO service_role;
ALTER TABLE public.order_stock_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner reads stock movements" ON public.order_stock_movements FOR SELECT TO authenticated USING (store_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE INDEX IF NOT EXISTS idx_osm_order ON public.order_stock_movements(order_id);

-- Estoque total derivado
CREATE OR REPLACE FUNCTION public.recompute_product_variant_stock(p_product_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.products p
     SET stock = COALESCE((SELECT SUM(v.stock_quantity) FROM public.product_variants v
                            WHERE v.product_id = p.id AND v.active AND v.archived_at IS NULL), 0)
   WHERE p.id = p_product_id AND p.inventory_mode = 'variant';
END $$;
REVOKE ALL ON FUNCTION public.recompute_product_variant_stock(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.trg_product_variants_sync_stock()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.recompute_product_variant_stock(COALESCE(NEW.product_id, OLD.product_id));
  IF TG_OP = 'UPDATE' THEN NEW.updated_at := now(); END IF;
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS product_variants_sync_stock ON public.product_variants;
CREATE TRIGGER product_variants_sync_stock AFTER INSERT OR UPDATE OF stock_quantity, active, archived_at OR DELETE
  ON public.product_variants FOR EACH ROW EXECUTE FUNCTION public.trg_product_variants_sync_stock();

-- Limites técnicos centralizados
CREATE OR REPLACE FUNCTION public.get_variant_limits()
RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT jsonb_build_object('max_groups', 4, 'max_values_per_group', 30, 'max_variants', 200)
$$;
GRANT EXECUTE ON FUNCTION public.get_variant_limits() TO anon, authenticated;

-- Salvamento não destrutivo da matriz
CREATE OR REPLACE FUNCTION public.save_product_variant_matrix(
  p_product_id uuid, p_enabled boolean, p_groups jsonb DEFAULT '[]'::jsonb,
  p_variants jsonb DEFAULT '[]'::jsonb, p_simple_stock integer DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_prod public.products%ROWTYPE;
  v_limits jsonb := public.get_variant_limits();
  g jsonb; val jsonb; v jsonb;
  v_group_ids uuid[] := '{}'; v_value_ids uuid[] := '{}'; v_kept uuid[] := '{}';
  v_ids uuid[]; v_existing public.product_variants%ROWTYPE;
  v_active_groups int; v_seq int; v_new_id uuid; v_stock int;
  v_created int := 0; v_preserved int := 0; v_archived int := 0; v_gpos int := 0; v_vpos int;
BEGIN
  SELECT * INTO v_prod FROM public.products WHERE id = p_product_id FOR UPDATE;
  IF NOT FOUND OR v_prod.user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Produto não encontrado para esta loja';
  END IF;

  IF NOT COALESCE(p_enabled, false) THEN
    IF v_prod.inventory_mode = 'variant' THEN
      UPDATE public.product_variants SET active = false WHERE product_id = p_product_id AND active;
      UPDATE public.products SET inventory_mode = 'simple', stock = GREATEST(COALESCE(p_simple_stock, stock), 0) WHERE id = p_product_id;
    END IF;
    RETURN jsonb_build_object('mode', 'simple');
  END IF;

  IF jsonb_typeof(p_groups) <> 'array' OR jsonb_array_length(p_groups) = 0 THEN
    RAISE EXCEPTION 'Informe ao menos uma variação';
  END IF;
  IF jsonb_array_length(p_groups) > (v_limits->>'max_groups')::int THEN
    RAISE EXCEPTION 'Limite de % variações por produto', v_limits->>'max_groups';
  END IF;
  IF jsonb_array_length(p_variants) > (v_limits->>'max_variants')::int THEN
    RAISE EXCEPTION 'Limite de % combinações por produto', v_limits->>'max_variants';
  END IF;

  FOR g IN SELECT * FROM jsonb_array_elements(p_groups) LOOP
    IF EXISTS (SELECT 1 FROM public.product_option_groups WHERE id = (g->>'id')::uuid AND product_id <> p_product_id) THEN
      RAISE EXCEPTION 'Variação inválida';
    END IF;
    IF jsonb_array_length(g->'values') = 0 OR jsonb_array_length(g->'values') > (v_limits->>'max_values_per_group')::int THEN
      RAISE EXCEPTION 'Quantidade de valores inválida em %', g->>'name';
    END IF;
    INSERT INTO public.product_option_groups (id, store_id, product_id, name, position)
    VALUES ((g->>'id')::uuid, v_prod.user_id, p_product_id, trim(g->>'name'), v_gpos)
    ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, position = EXCLUDED.position, archived_at = NULL, updated_at = now();
    v_group_ids := v_group_ids || (g->>'id')::uuid;
    v_vpos := 0;
    FOR val IN SELECT * FROM jsonb_array_elements(g->'values') LOOP
      IF EXISTS (SELECT 1 FROM public.product_option_values WHERE id = (val->>'id')::uuid AND (product_id <> p_product_id OR option_group_id <> (g->>'id')::uuid)) THEN
        RAISE EXCEPTION 'Valor de variação inválido';
      END IF;
      INSERT INTO public.product_option_values (id, store_id, product_id, option_group_id, value, position)
      VALUES ((val->>'id')::uuid, v_prod.user_id, p_product_id, (g->>'id')::uuid, trim(val->>'value'), v_vpos)
      ON CONFLICT (id) DO UPDATE SET value = EXCLUDED.value, position = EXCLUDED.position, archived_at = NULL, updated_at = now();
      v_value_ids := v_value_ids || (val->>'id')::uuid;
      v_vpos := v_vpos + 1;
    END LOOP;
    v_gpos := v_gpos + 1;
  END LOOP;

  UPDATE public.product_option_groups SET archived_at = now() WHERE product_id = p_product_id AND archived_at IS NULL AND NOT (id = ANY(v_group_ids));
  UPDATE public.product_option_values SET archived_at = now() WHERE product_id = p_product_id AND archived_at IS NULL AND NOT (id = ANY(v_value_ids));
  v_active_groups := array_length(v_group_ids, 1);
  v_seq := v_prod.variant_seq;

  FOR v IN SELECT * FROM jsonb_array_elements(p_variants) LOOP
    SELECT array_agg(x ORDER BY x) INTO v_ids FROM (SELECT DISTINCT (jsonb_array_elements_text(v->'value_ids'))::uuid x) s;
    IF v_ids IS NULL OR array_length(v_ids,1) <> v_active_groups
       OR NOT (v_ids <@ v_value_ids)
       OR (SELECT count(DISTINCT option_group_id) FROM public.product_option_values WHERE id = ANY(v_ids)) <> v_active_groups THEN
      RAISE EXCEPTION 'Combinação inválida';
    END IF;
    v_stock := GREATEST(COALESCE((v->>'stock')::int, 0), 0);
    SELECT * INTO v_existing FROM public.product_variants WHERE product_id = p_product_id AND option_value_ids = v_ids;
    IF FOUND THEN
      UPDATE public.product_variants SET stock_quantity = v_stock, active = COALESCE((v->>'active')::boolean, true), archived_at = NULL, updated_at = now()
       WHERE id = v_existing.id;
      v_kept := v_kept || v_existing.id; v_preserved := v_preserved + 1;
    ELSE
      v_seq := v_seq + 1;
      INSERT INTO public.product_variants (store_id, product_id, sku, seq, option_value_ids, stock_quantity, active)
      VALUES (v_prod.user_id, p_product_id, 'SD-' || upper(left(p_product_id::text, 8)) || '-V' || lpad(v_seq::text, 3, '0'),
              v_seq, v_ids, v_stock, COALESCE((v->>'active')::boolean, true))
      RETURNING id INTO v_new_id;
      INSERT INTO public.product_variant_values (variant_id, option_group_id, option_value_id, store_id)
      SELECT v_new_id, ov.option_group_id, ov.id, v_prod.user_id FROM public.product_option_values ov WHERE ov.id = ANY(v_ids);
      v_kept := v_kept || v_new_id; v_created := v_created + 1;
    END IF;
  END LOOP;

  WITH a AS (
    UPDATE public.product_variants SET active = false, archived_at = COALESCE(archived_at, now())
     WHERE product_id = p_product_id AND archived_at IS NULL AND NOT (id = ANY(v_kept)) RETURNING 1)
  SELECT count(*) INTO v_archived FROM a;

  UPDATE public.products SET inventory_mode = 'variant', variant_seq = v_seq WHERE id = p_product_id;
  PERFORM public.recompute_product_variant_stock(p_product_id);

  RETURN jsonb_build_object('mode','variant','groups', v_active_groups, 'created', v_created, 'preserved', v_preserved, 'archived', v_archived);
END $$;
REVOKE ALL ON FUNCTION public.save_product_variant_matrix(uuid, boolean, jsonb, jsonb, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_product_variant_matrix(uuid, boolean, jsonb, jsonb, integer) TO authenticated;

-- Baixa atômica de um item de pedido com variante
CREATE OR REPLACE FUNCTION public.reserve_order_item_variant(
  p_store_owner_id uuid, p_order_id uuid, p_product_id uuid, p_variant_id uuid, p_qty integer,
  OUT o_sku text, OUT o_snapshot jsonb)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_variant_id IS NULL THEN
    RAISE EXCEPTION 'Selecione as opções do produto antes de finalizar';
  END IF;
  IF COALESCE(p_qty, 0) <= 0 THEN RAISE EXCEPTION 'Quantidade inválida'; END IF;
  UPDATE public.product_variants
     SET stock_quantity = stock_quantity - p_qty
   WHERE id = p_variant_id AND product_id = p_product_id AND store_id = p_store_owner_id
     AND active AND archived_at IS NULL AND stock_quantity >= p_qty
  RETURNING sku INTO o_sku;
  IF o_sku IS NULL THEN
    RAISE EXCEPTION 'Combinação indisponível no momento.';
  END IF;
  SELECT jsonb_object_agg(g.name, ov.value ORDER BY g.position) INTO o_snapshot
    FROM public.product_variant_values pvv
    JOIN public.product_option_groups g ON g.id = pvv.option_group_id
    JOIN public.product_option_values ov ON ov.id = pvv.option_value_id
   WHERE pvv.variant_id = p_variant_id;
END $$;
REVOKE ALL ON FUNCTION public.reserve_order_item_variant(uuid, uuid, uuid, uuid, integer) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.create_checkout_order(p_store_owner_id uuid, p_customer_id uuid DEFAULT NULL::uuid, p_customer_name text DEFAULT ''::text, p_customer_email text DEFAULT ''::text, p_customer_phone text DEFAULT ''::text, p_customer_address text DEFAULT NULL::text, p_delivery_method text DEFAULT NULL::text, p_payment_method text DEFAULT NULL::text, p_subtotal numeric DEFAULT 0, p_delivery_fee numeric DEFAULT 0, p_total_amount numeric DEFAULT 0, p_status text DEFAULT 'pending'::text, p_payment_status text DEFAULT 'pending'::text, p_notes text DEFAULT NULL::text, p_order_source text DEFAULT 'store'::text, p_checkout_origin text DEFAULT 'checkout_guest'::text, p_is_guest_order boolean DEFAULT true, p_items jsonb DEFAULT '[]'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_order public.orders%ROWTYPE;
  v_item jsonb;
  v_variations jsonb;
  v_auth_uid uuid := auth.uid();
  v_order_source text := COALESCE(NULLIF(trim(p_order_source), ''), 'store');
  v_payment_status text := COALESCE(NULLIF(trim(p_payment_status), ''), 'pending');
  v_checkout_origin text := COALESCE(NULLIF(trim(p_checkout_origin), ''), CASE WHEN COALESCE(p_is_guest_order, true) THEN 'checkout_guest' ELSE 'checkout_customer' END);
  v_mode text;
  v_variant_id uuid;
  v_sku text;
  v_snapshot jsonb;
  v_item_id uuid;
  v_qty integer;
BEGIN
  IF p_store_owner_id IS NULL OR NOT public.is_active_store(p_store_owner_id) THEN
    RAISE EXCEPTION 'Loja indisponível para receber pedidos';
  END IF;
  IF trim(COALESCE(p_customer_name, '')) = '' OR length(trim(COALESCE(p_customer_name, ''))) < 3 THEN
    RAISE EXCEPTION 'Nome do cliente é obrigatório';
  END IF;
  IF trim(COALESCE(p_customer_phone, '')) = '' OR length(regexp_replace(COALESCE(p_customer_phone, ''), '\D', '', 'g')) < 10 THEN
    RAISE EXCEPTION 'Telefone do cliente é obrigatório';
  END IF;
  IF p_customer_id IS NOT NULL AND v_auth_uid IS DISTINCT FROM p_customer_id THEN
    RAISE EXCEPTION 'Cliente autenticado inválido para o pedido';
  END IF;
  IF v_order_source NOT IN ('store', 'catalog', 'manual') THEN
    v_order_source := 'store';
  END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Itens do pedido são obrigatórios';
  END IF;
  IF COALESCE(p_subtotal, 0) < 0 OR COALESCE(p_delivery_fee, 0) < 0 OR COALESCE(p_total_amount, 0) < 0 THEN
    RAISE EXCEPTION 'Valores do pedido inválidos';
  END IF;

  INSERT INTO public.orders (
    store_owner_id, customer_id, customer_name, customer_email, customer_phone, customer_address,
    delivery_method, payment_method, subtotal, delivery_fee, total_amount, status, payment_status,
    notes, order_source, checkout_origin, is_guest_order
  ) VALUES (
    p_store_owner_id, p_customer_id, trim(p_customer_name), COALESCE(trim(p_customer_email), ''),
    trim(p_customer_phone), p_customer_address, p_delivery_method, p_payment_method,
    COALESCE(p_subtotal, 0), COALESCE(p_delivery_fee, 0), COALESCE(p_total_amount, 0),
    COALESCE(NULLIF(trim(p_status), ''), 'pending'), v_payment_status,
    NULLIF(trim(COALESCE(p_notes, '')), ''), v_order_source, v_checkout_origin,
    COALESCE(p_is_guest_order, p_customer_id IS NULL)
  )
  RETURNING * INTO v_order;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_variations := NULL; v_sku := NULL; v_variant_id := NULL; v_mode := NULL;
    IF v_item ? 'variations'
       AND v_item->'variations' IS NOT NULL
       AND jsonb_typeof(v_item->'variations') = 'object'
       AND v_item->'variations' <> '{}'::jsonb THEN
      v_variations := v_item->'variations';
    END IF;

    SELECT p.inventory_mode INTO v_mode
      FROM public.products p
     WHERE p.id = (v_item->>'product_id')::uuid
       AND p.user_id = p_store_owner_id
       AND p.is_active = true;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Produto inválido para esta loja: %', v_item->>'product_id';
    END IF;

    v_qty := (v_item->>'quantity')::integer;
    IF v_mode = 'variant' THEN
      v_variant_id := NULLIF(v_item->>'variant_id', '')::uuid;
      SELECT o_sku, o_snapshot INTO v_sku, v_snapshot
        FROM public.reserve_order_item_variant(p_store_owner_id, v_order.id, (v_item->>'product_id')::uuid, v_variant_id, v_qty);
      v_variations := COALESCE(v_snapshot, v_variations);
    END IF;

    INSERT INTO public.order_items (
      order_id, product_id, product_name, product_price, quantity, subtotal, variations, variant_id, variant_sku
    ) VALUES (
      v_order.id, (v_item->>'product_id')::uuid, v_item->>'product_name',
      (v_item->>'product_price')::numeric, v_qty, (v_item->>'subtotal')::numeric,
      v_variations, v_variant_id, v_sku
    ) RETURNING id INTO v_item_id;

    IF v_variant_id IS NOT NULL THEN
      INSERT INTO public.order_stock_movements (store_id, order_id, order_item_id, variant_id, quantity, kind, reason)
      VALUES (p_store_owner_id, v_order.id, v_item_id, v_variant_id, v_qty, 'reserve', 'order_created');
    END IF;
  END LOOP;

  RETURN to_jsonb(v_order);
END;
$function$;

CREATE OR REPLACE FUNCTION public.insert_order_items_secure(p_order_id uuid, p_items jsonb)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_order RECORD; v_item jsonb; v_variations jsonb; v_mode text;
  v_variant_id uuid; v_sku text; v_snapshot jsonb; v_item_id uuid; v_qty integer;
BEGIN
  IF p_order_id IS NULL THEN RAISE EXCEPTION 'order_id is required'; END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'items must be a non-empty array';
  END IF;
  SELECT id, store_owner_id, status, created_at INTO v_order FROM public.orders WHERE id = p_order_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found: %', p_order_id; END IF;
  IF EXISTS (SELECT 1 FROM public.order_items WHERE order_id = p_order_id) THEN
    RAISE EXCEPTION 'Order already has items';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_variations := NULL; v_sku := NULL; v_variant_id := NULL; v_mode := NULL;
    IF v_item ? 'variations' AND v_item->'variations' IS NOT NULL
       AND jsonb_typeof(v_item->'variations') = 'object' AND v_item->'variations' <> '{}'::jsonb THEN
      v_variations := v_item->'variations';
    END IF;
    v_qty := (v_item->>'quantity')::integer;
    SELECT inventory_mode INTO v_mode FROM public.products
     WHERE id = (v_item->>'product_id')::uuid AND user_id = v_order.store_owner_id;
    IF v_mode = 'variant' THEN
      v_variant_id := NULLIF(v_item->>'variant_id', '')::uuid;
      SELECT o_sku, o_snapshot INTO v_sku, v_snapshot
        FROM public.reserve_order_item_variant(v_order.store_owner_id, p_order_id, (v_item->>'product_id')::uuid, v_variant_id, v_qty);
      v_variations := COALESCE(v_snapshot, v_variations);
    END IF;
    INSERT INTO public.order_items (order_id, product_id, product_name, product_price, quantity, subtotal, variations, variant_id, variant_sku)
    VALUES (p_order_id, (v_item->>'product_id')::uuid, v_item->>'product_name', (v_item->>'product_price')::numeric,
            v_qty, (v_item->>'subtotal')::numeric, v_variations, v_variant_id, v_sku)
    RETURNING id INTO v_item_id;
    IF v_variant_id IS NOT NULL THEN
      INSERT INTO public.order_stock_movements (store_id, order_id, order_item_id, variant_id, quantity, kind, reason)
      VALUES (v_order.store_owner_id, p_order_id, v_item_id, v_variant_id, v_qty, 'reserve', 'order_created');
    END IF;
  END LOOP;
END;
$function$;

-- Estorno automático e idempotente
CREATE OR REPLACE FUNCTION public.restore_order_variant_stock(p_order_id uuid, p_reason text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE m record; v_ins uuid; v_count int := 0;
BEGIN
  FOR m IN SELECT r.* FROM public.order_stock_movements r
            WHERE r.order_id = p_order_id AND r.kind = 'reserve'
              AND NOT EXISTS (SELECT 1 FROM public.order_stock_movements x WHERE x.order_item_id = r.order_item_id AND x.kind = 'restore')
            FOR UPDATE
  LOOP
    v_ins := NULL;
    INSERT INTO public.order_stock_movements (store_id, order_id, order_item_id, variant_id, quantity, kind, reason)
    VALUES (m.store_id, m.order_id, m.order_item_id, m.variant_id, m.quantity, 'restore', p_reason)
    ON CONFLICT (order_item_id, kind) DO NOTHING RETURNING id INTO v_ins;
    IF v_ins IS NOT NULL AND m.variant_id IS NOT NULL THEN
      UPDATE public.product_variants SET stock_quantity = stock_quantity + m.quantity WHERE id = m.variant_id AND store_id = m.store_id;
      v_count := v_count + 1;
    END IF;
  END LOOP;
  RETURN v_count;
END $$;
REVOKE ALL ON FUNCTION public.restore_order_variant_stock(uuid, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.trg_orders_restore_variant_stock()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_bad_status text[] := ARRAY['cancelled','canceled','cancelado','expired','expirado','refused','rejected','recusado','invalid','invalidated','invalido'];
  v_bad_pay text[] := ARRAY['cancelled','canceled','expired','refused','rejected','refunded','chargeback','invalid'];
BEGIN
  IF (lower(COALESCE(NEW.status,'')) = ANY(v_bad_status) AND lower(COALESCE(OLD.status,'')) IS DISTINCT FROM lower(COALESCE(NEW.status,'')))
     OR (lower(COALESCE(NEW.payment_status,'')) = ANY(v_bad_pay) AND lower(COALESCE(OLD.payment_status,'')) IS DISTINCT FROM lower(COALESCE(NEW.payment_status,''))) THEN
    PERFORM public.restore_order_variant_stock(NEW.id, 'status:' || COALESCE(NEW.status,'') || '/' || COALESCE(NEW.payment_status,''));
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS orders_restore_variant_stock ON public.orders;
CREATE TRIGGER orders_restore_variant_stock AFTER UPDATE OF status, payment_status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.trg_orders_restore_variant_stock();

-- Clonagem (loja/template): novos IDs e SKUs
CREATE OR REPLACE FUNCTION public.clone_product_variants(p_source_product_id uuid, p_target_product_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_src public.products%ROWTYPE; v_tgt public.products%ROWTYPE;
  v_gmap jsonb := '{}'; v_vmap jsonb := '{}'; r record; v_new uuid; v_ids uuid[]; v_seq int := 0; v_count int := 0;
BEGIN
  SELECT * INTO v_src FROM public.products WHERE id = p_source_product_id;
  SELECT * INTO v_tgt FROM public.products WHERE id = p_target_product_id FOR UPDATE;
  IF v_src.id IS NULL OR v_tgt.id IS NULL THEN RETURN 0; END IF;
  IF EXISTS (SELECT 1 FROM public.product_option_groups WHERE product_id = p_target_product_id) THEN RETURN 0; END IF;
  IF v_src.inventory_mode <> 'variant' OR NOT EXISTS (SELECT 1 FROM public.product_variants WHERE product_id = p_source_product_id AND archived_at IS NULL) THEN
    UPDATE public.products SET inventory_mode = 'simple', variant_seq = 0 WHERE id = p_target_product_id;
    RETURN 0;
  END IF;
  FOR r IN SELECT * FROM public.product_option_groups WHERE product_id = p_source_product_id AND archived_at IS NULL LOOP
    INSERT INTO public.product_option_groups (store_id, product_id, name, position) VALUES (v_tgt.user_id, p_target_product_id, r.name, r.position) RETURNING id INTO v_new;
    v_gmap := v_gmap || jsonb_build_object(r.id::text, v_new);
  END LOOP;
  FOR r IN SELECT * FROM public.product_option_values WHERE product_id = p_source_product_id AND archived_at IS NULL AND v_gmap ? option_group_id::text LOOP
    INSERT INTO public.product_option_values (store_id, product_id, option_group_id, value, position)
    VALUES (v_tgt.user_id, p_target_product_id, (v_gmap->>r.option_group_id::text)::uuid, r.value, r.position) RETURNING id INTO v_new;
    v_vmap := v_vmap || jsonb_build_object(r.id::text, v_new);
  END LOOP;
  UPDATE public.products SET inventory_mode = 'variant', variant_seq = 0 WHERE id = p_target_product_id;
  FOR r IN SELECT * FROM public.product_variants WHERE product_id = p_source_product_id AND archived_at IS NULL ORDER BY seq LOOP
    IF EXISTS (SELECT 1 FROM unnest(r.option_value_ids) x WHERE NOT (v_vmap ? x::text)) THEN CONTINUE; END IF;
    SELECT array_agg((v_vmap->>x::text)::uuid ORDER BY (v_vmap->>x::text)::uuid) INTO v_ids FROM unnest(r.option_value_ids) x;
    v_seq := v_seq + 1;
    INSERT INTO public.product_variants (store_id, product_id, sku, seq, option_value_ids, stock_quantity, active)
    VALUES (v_tgt.user_id, p_target_product_id, 'SD-' || upper(left(p_target_product_id::text, 8)) || '-V' || lpad(v_seq::text,3,'0'), v_seq, v_ids, r.stock_quantity, r.active)
    RETURNING id INTO v_new;
    INSERT INTO public.product_variant_values (variant_id, option_group_id, option_value_id, store_id)
    SELECT v_new, ov.option_group_id, ov.id, v_tgt.user_id FROM public.product_option_values ov WHERE ov.id = ANY(v_ids);
    v_count := v_count + 1;
  END LOOP;
  UPDATE public.products SET variant_seq = v_seq WHERE id = p_target_product_id;
  PERFORM public.recompute_product_variant_stock(p_target_product_id);
  RETURN v_count;
END $$;
REVOKE ALL ON FUNCTION public.clone_product_variants(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.clone_product_variants(uuid, uuid) TO service_role;
