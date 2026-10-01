DROP POLICY IF EXISTS "Anyone can view products from public stores" ON public.products;
CREATE POLICY "Anyone can view products from public stores"
ON public.products FOR SELECT
USING (is_active = true AND public.is_public_store(user_id));