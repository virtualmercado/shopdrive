
CREATE TABLE public.store_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_owner_id uuid NOT NULL,
  customer_name text NOT NULL,
  customer_city text NOT NULL,
  comment text NOT NULL,
  stars integer NOT NULL DEFAULT 5,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  is_verified boolean NOT NULL DEFAULT false,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.store_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Merchants can manage own reviews"
ON public.store_reviews
FOR ALL
TO authenticated
USING (store_owner_id = auth.uid())
WITH CHECK (store_owner_id = auth.uid());

CREATE POLICY "Public can read store reviews"
ON public.store_reviews
FOR SELECT
TO anon
USING (public.is_public_store(store_owner_id));

CREATE POLICY "Authenticated can read store reviews"
ON public.store_reviews
FOR SELECT
TO authenticated
USING (public.is_public_store(store_owner_id));

CREATE TRIGGER set_store_reviews_updated_at
  BEFORE UPDATE ON public.store_reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();
