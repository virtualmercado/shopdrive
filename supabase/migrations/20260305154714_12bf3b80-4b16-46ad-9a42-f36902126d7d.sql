
CREATE TABLE public.catalog_pdf_clicks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  origin TEXT NOT NULL DEFAULT 'catalogo_pdf',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.catalog_pdf_clicks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Merchants can read own catalog clicks"
  ON public.catalog_pdf_clicks
  FOR SELECT
  TO authenticated
  USING (store_id = auth.uid());

CREATE POLICY "Anyone can insert catalog clicks"
  ON public.catalog_pdf_clicks
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE INDEX idx_catalog_pdf_clicks_store_id ON public.catalog_pdf_clicks(store_id);
CREATE INDEX idx_catalog_pdf_clicks_created_at ON public.catalog_pdf_clicks(created_at);
CREATE INDEX idx_catalog_pdf_clicks_product_id ON public.catalog_pdf_clicks(product_id);
