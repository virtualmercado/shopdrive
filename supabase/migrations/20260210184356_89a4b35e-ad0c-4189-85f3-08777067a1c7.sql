
-- Fix infinite recursion: quotes ↔ quote_public_links cross-reference

-- 1) Security definer function to check quote ownership (bypasses RLS on quotes)
CREATE OR REPLACE FUNCTION public.is_quote_owner(p_quote_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.quotes
    WHERE id = p_quote_id AND store_owner_id = auth.uid()
  )
$$;

-- 2) Security definer function to check if quote has valid public link (bypasses RLS on quote_public_links)
CREATE OR REPLACE FUNCTION public.is_quote_publicly_accessible(p_quote_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.quote_public_links
    WHERE quote_id = p_quote_id
      AND is_enabled = true
      AND (expires_at IS NULL OR expires_at > now())
  )
$$;

-- 3) Drop ALL existing policies on all 3 tables
DROP POLICY IF EXISTS "Public can read quotes via valid link" ON public.quotes;
DROP POLICY IF EXISTS "Store owners can manage their quotes" ON public.quotes;

DROP POLICY IF EXISTS "Public can read quote items via valid link" ON public.quote_items;
DROP POLICY IF EXISTS "Users can manage quote items through quotes" ON public.quote_items;

DROP POLICY IF EXISTS "Store owners can manage their quote links" ON public.quote_public_links;
DROP POLICY IF EXISTS "Anyone can read enabled public links" ON public.quote_public_links;

-- 4) quotes policies — NEVER reference quotes itself
CREATE POLICY "Owner manages quotes"
ON public.quotes FOR ALL
USING (store_owner_id = auth.uid())
WITH CHECK (store_owner_id = auth.uid());

CREATE POLICY "Public reads quotes via link"
ON public.quotes FOR SELECT
USING (public.is_quote_publicly_accessible(id));

-- 5) quote_items policies — use security definer to check ownership
CREATE POLICY "Owner manages quote items"
ON public.quote_items FOR ALL
USING (public.is_quote_owner(quote_id))
WITH CHECK (public.is_quote_owner(quote_id));

CREATE POLICY "Public reads quote items via link"
ON public.quote_items FOR SELECT
USING (public.is_quote_publicly_accessible(quote_id));

-- 6) quote_public_links policies — use security definer to check ownership
CREATE POLICY "Owner manages quote links"
ON public.quote_public_links FOR ALL
USING (public.is_quote_owner(quote_id))
WITH CHECK (public.is_quote_owner(quote_id));

CREATE POLICY "Public reads enabled links"
ON public.quote_public_links FOR SELECT
USING (is_enabled = true AND (expires_at IS NULL OR expires_at > now()));
