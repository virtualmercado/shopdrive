-- Create function to check if a user has a public store
CREATE OR REPLACE FUNCTION public.is_public_store(store_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = store_user_id
      AND store_slug IS NOT NULL
  )
$$;

-- Add RLS policy to allow public access to products from public stores
CREATE POLICY "Anyone can view products from public stores"
  ON public.products
  FOR SELECT
  USING (public.is_public_store(user_id));

-- Add RLS policy to allow public access to categories from public stores
CREATE POLICY "Anyone can view categories from public stores"
  ON public.product_categories
  FOR SELECT
  USING (public.is_public_store(user_id));