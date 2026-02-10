-- Fix infinite recursion in RLS policies for quotes/quote_public_links/quote_items

-- 1) Drop the problematic policies
DROP POLICY IF EXISTS "Public can read quotes via valid link" ON public.quotes;
DROP POLICY IF EXISTS "Public can read quote items via valid link" ON public.quote_items;
DROP POLICY IF EXISTS "Store owners can manage their quote links" ON public.quote_public_links;

-- 2) Recreate public read policy on quotes using a direct subquery (no join to quote_public_links policies)
CREATE POLICY "Public can read quotes via valid link"
ON public.quotes FOR SELECT
USING (
  auth.uid() = store_owner_id
  OR id IN (
    SELECT quote_id FROM public.quote_public_links
    WHERE is_enabled = true AND (expires_at IS NULL OR expires_at > now())
  )
);

-- 3) Recreate quote_items public read - reference quote_public_links directly, not quotes
CREATE POLICY "Public can read quote items via valid link"
ON public.quote_items FOR SELECT
USING (
  quote_id IN (
    SELECT quote_id FROM public.quote_public_links
    WHERE is_enabled = true AND (expires_at IS NULL OR expires_at > now())
  )
  OR quote_id IN (
    SELECT id FROM public.quotes WHERE store_owner_id = auth.uid()
  )
);

-- 4) Recreate quote_public_links owner policy using store_owner_id directly
CREATE POLICY "Store owners can manage their quote links"
ON public.quote_public_links FOR ALL
USING (
  quote_id IN (SELECT id FROM public.quotes WHERE store_owner_id = auth.uid())
)
WITH CHECK (
  quote_id IN (SELECT id FROM public.quotes WHERE store_owner_id = auth.uid())
);