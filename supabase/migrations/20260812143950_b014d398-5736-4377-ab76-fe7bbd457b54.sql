DROP POLICY IF EXISTS "Store owners can insert customer profiles" ON public.customer_profiles;

CREATE OR REPLACE FUNCTION public.create_manual_store_customer(
  p_full_name text,
  p_email text,
  p_phone text DEFAULT NULL,
  p_cpf text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner uuid := auth.uid();
  v_id uuid;
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_name text := btrim(coalesce(p_full_name, ''));
BEGIN
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  IF v_name = '' OR v_email = '' THEN
    RAISE EXCEPTION 'Nome e e-mail são obrigatórios' USING ERRCODE = '22023';
  END IF;

  IF v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' THEN
    RAISE EXCEPTION 'E-mail inválido' USING ERRCODE = '22023';
  END IF;

  -- Reuse an existing profile with the same email when present, otherwise create one
  SELECT id INTO v_id FROM public.customer_profiles WHERE lower(email) = v_email LIMIT 1;

  IF v_id IS NULL THEN
    v_id := gen_random_uuid();
    INSERT INTO public.customer_profiles (id, full_name, email, phone, cpf)
    VALUES (
      v_id,
      left(v_name, 200),
      v_email,
      nullif(btrim(coalesce(p_phone, '')), ''),
      nullif(regexp_replace(coalesce(p_cpf, ''), '\D', '', 'g'), '')
    );
  END IF;

  INSERT INTO public.store_customers (store_owner_id, customer_id, is_active, origin)
  VALUES (v_owner, v_id, true, 'manual')
  ON CONFLICT DO NOTHING;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_manual_store_customer(text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_manual_store_customer(text, text, text, text) TO authenticated;