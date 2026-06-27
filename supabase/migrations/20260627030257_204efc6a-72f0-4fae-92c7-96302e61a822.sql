-- =========================================================
-- FASE 1 — Fundação para duplicação de lojas (Aroma Varejo etc.)
-- Sem alterar RLS existente nem a regra 1 usuário = 1 loja.
-- =========================================================

-- 1) Rastreabilidade em profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS parent_account_id uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_cloned_store boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cloned_from_profile_id uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS clone_type text NULL,
  ADD COLUMN IF NOT EXISTS is_addon_store boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS addon_status text NULL,
  ADD COLUMN IF NOT EXISTS cloned_at timestamptz NULL;

-- Validações leves (sem CHECK em now())
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_clone_type_check'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_clone_type_check
      CHECK (clone_type IS NULL OR clone_type IN ('varejo','atacado','outro'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_addon_status_check'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_addon_status_check
      CHECK (addon_status IS NULL OR addon_status IN ('active','pending_payment','inactive'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_profiles_parent_account_id ON public.profiles(parent_account_id);
CREATE INDEX IF NOT EXISTS idx_profiles_cloned_from ON public.profiles(cloned_from_profile_id);

-- 2) Rastreabilidade em products
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS cloned_from_product_id uuid NULL REFERENCES public.products(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_products_cloned_from ON public.products(cloned_from_product_id);

-- 3) Unicidade de slug — normalizar duplicidades antes do índice único
DO $$
DECLARE
  dup RECORD;
  v_counter INTEGER;
  v_new_slug TEXT;
BEGIN
  FOR dup IN
    SELECT store_slug
    FROM public.profiles
    WHERE store_slug IS NOT NULL
    GROUP BY store_slug
    HAVING COUNT(*) > 1
  LOOP
    v_counter := 0;
    -- Mantém o registro mais antigo com o slug original; renomeia os demais.
    FOR dup IN
      SELECT id
      FROM public.profiles
      WHERE store_slug = dup.store_slug
      ORDER BY created_at NULLS LAST, id
      OFFSET 1
    LOOP
      LOOP
        v_counter := v_counter + 1;
        v_new_slug := (SELECT store_slug FROM public.profiles WHERE id = dup.id) || '-' || v_counter;
        EXIT WHEN NOT EXISTS (SELECT 1 FROM public.profiles WHERE store_slug = v_new_slug);
      END LOOP;
      UPDATE public.profiles SET store_slug = v_new_slug WHERE id = dup.id;
    END LOOP;
  END LOOP;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_store_slug_unique
  ON public.profiles(store_slug)
  WHERE store_slug IS NOT NULL;

-- 4) Log de clonagem (usado pelo painel master)
CREATE TABLE IF NOT EXISTS public.store_clone_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid NULL,
  source_profile_id uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  cloned_profile_id uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  source_store_name text NULL,
  cloned_store_name text NULL,
  cloned_store_slug text NULL,
  cloned_email text NULL,
  clone_type text NULL,
  options jsonb NOT NULL DEFAULT '{}'::jsonb,
  products_copied integer NOT NULL DEFAULT 0,
  categories_copied integer NOT NULL DEFAULT 0,
  brands_copied integer NOT NULL DEFAULT 0,
  images_copied integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  error_message text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.store_clone_logs TO authenticated;
GRANT ALL ON public.store_clone_logs TO service_role;

ALTER TABLE public.store_clone_logs ENABLE ROW LEVEL SECURITY;

-- Apenas admins podem visualizar logs de clonagem
DROP POLICY IF EXISTS "Admins can view store clone logs" ON public.store_clone_logs;
CREATE POLICY "Admins can view store clone logs"
  ON public.store_clone_logs
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Insert/update somente via service_role (edge function clone-store)
-- — nenhuma policy de INSERT/UPDATE para authenticated.

CREATE TRIGGER trg_store_clone_logs_updated_at
  BEFORE UPDATE ON public.store_clone_logs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_store_clone_logs_source ON public.store_clone_logs(source_profile_id);
CREATE INDEX IF NOT EXISTS idx_store_clone_logs_cloned ON public.store_clone_logs(cloned_profile_id);
CREATE INDEX IF NOT EXISTS idx_store_clone_logs_created ON public.store_clone_logs(created_at DESC);