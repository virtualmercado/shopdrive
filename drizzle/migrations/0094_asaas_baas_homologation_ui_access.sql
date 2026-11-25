CREATE TABLE public.asaas_baas_ui_access (
  store_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  notes text,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.asaas_baas_ui_access IS
  'Controls UI-only visibility of the Asaas BaaS Phase 2.5 compliance/homologation screen per authorized store. Does not enable API calls or subaccount creation.';

GRANT SELECT ON public.asaas_baas_ui_access TO authenticated;
GRANT ALL ON public.asaas_baas_ui_access TO service_role;

ALTER TABLE public.asaas_baas_ui_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read asaas baas ui access"
  ON public.asaas_baas_ui_access
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.get_my_asaas_homologation_ui_access(
  p_store_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_store_id uuid;
  v_enabled boolean := false;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('enabled', false, 'mode', 'homologation_only');
  END IF;

  v_store_id := COALESCE(p_store_id, v_uid);

  IF v_store_id <> v_uid AND NOT public.can_actor_manage_marca_store(v_uid, v_store_id) THEN
    RETURN jsonb_build_object('enabled', false, 'mode', 'homologation_only');
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.asaas_baas_ui_access a
    JOIN public.profiles p ON p.id = a.store_id
    WHERE a.store_id = v_store_id
      AND a.enabled = true
      AND p.account_status = 'active'
  ) INTO v_enabled;

  RETURN jsonb_build_object(
    'enabled', v_enabled,
    'mode', 'homologation_only',
    'storeId', v_store_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_asaas_homologation_ui_access(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_asaas_homologation_ui_access(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.admin_set_asaas_homologation_ui_access(
  p_store_id uuid,
  p_enabled boolean,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL OR NOT public.has_role(v_uid, 'admin') THEN
    RAISE EXCEPTION 'Acesso negado.' USING ERRCODE = '42501';
  END IF;

  IF p_store_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_store_id) THEN
    RAISE EXCEPTION 'Loja não encontrada.' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.asaas_baas_ui_access (store_id, enabled, notes, updated_by, updated_at)
  VALUES (p_store_id, COALESCE(p_enabled, false), p_notes, v_uid, now())
  ON CONFLICT (store_id) DO UPDATE SET
    enabled = EXCLUDED.enabled,
    notes = COALESCE(EXCLUDED.notes, public.asaas_baas_ui_access.notes),
    updated_by = v_uid,
    updated_at = now();

  RETURN jsonb_build_object(
    'ok', true,
    'storeId', p_store_id,
    'enabled', COALESCE(p_enabled, false)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_asaas_homologation_ui_access(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_asaas_homologation_ui_access(uuid, boolean, text) TO authenticated, service_role;