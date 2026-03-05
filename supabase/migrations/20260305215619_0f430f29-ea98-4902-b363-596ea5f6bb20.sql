
CREATE TABLE public.store_product_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL DEFAULT 'product_view',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.store_product_views ENABLE ROW LEVEL SECURITY;

-- Anyone can insert views (public store visitors)
CREATE POLICY "Anyone can insert product views"
  ON public.store_product_views
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Store owners can read their own views
CREATE POLICY "Store owners can read own views"
  ON public.store_product_views
  FOR SELECT
  TO authenticated
  USING (store_id = auth.uid());

CREATE INDEX idx_store_product_views_store_id ON public.store_product_views(store_id);
CREATE INDEX idx_store_product_views_created_at ON public.store_product_views(created_at);
