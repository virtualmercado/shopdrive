
-- ==================== QUOTES TABLE ====================
CREATE TABLE public.quotes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_owner_id UUID NOT NULL,
  quote_number TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'open', 'approved', 'rejected', 'expired', 'converted')),
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  valid_until DATE NOT NULL DEFAULT (CURRENT_DATE + INTERVAL '7 days')::DATE,
  customer_id UUID REFERENCES public.customer_profiles(id),
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  customer_email TEXT,
  delivery_address TEXT,
  notes TEXT,
  subtotal NUMERIC NOT NULL DEFAULT 0,
  discount NUMERIC NOT NULL DEFAULT 0,
  shipping_fee NUMERIC NOT NULL DEFAULT 0,
  total NUMERIC NOT NULL DEFAULT 0,
  payment_method_hint TEXT,
  converted_order_id UUID REFERENCES public.orders(id),
  converted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Quote number generation
CREATE OR REPLACE FUNCTION public.generate_quote_number(p_store_owner_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  next_number INTEGER;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(quote_number FROM 5) AS INTEGER)), 0) + 1
  INTO next_number
  FROM public.quotes
  WHERE store_owner_id = p_store_owner_id
  AND quote_number IS NOT NULL
  AND quote_number ~ '^ORC-\d+$';
  
  RETURN 'ORC-' || LPAD(next_number::TEXT, 6, '0');
END;
$$;

CREATE OR REPLACE FUNCTION public.set_quote_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.quote_number IS NULL OR NEW.quote_number = '' THEN
    NEW.quote_number := public.generate_quote_number(NEW.store_owner_id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_quote_number_trigger
BEFORE INSERT ON public.quotes
FOR EACH ROW EXECUTE FUNCTION public.set_quote_number();

CREATE TRIGGER update_quotes_updated_at
BEFORE UPDATE ON public.quotes
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- RLS for quotes
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Store owners can manage their quotes"
ON public.quotes FOR ALL
USING (auth.uid() = store_owner_id)
WITH CHECK (auth.uid() = store_owner_id);

-- ==================== QUOTE ITEMS TABLE ====================
CREATE TABLE public.quote_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quote_id UUID NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id),
  name TEXT NOT NULL,
  sku TEXT,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  quantity NUMERIC NOT NULL DEFAULT 1,
  line_total NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.quote_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage quote items through quotes"
ON public.quote_items FOR ALL
USING (EXISTS (SELECT 1 FROM public.quotes WHERE id = quote_items.quote_id AND store_owner_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.quotes WHERE id = quote_items.quote_id AND store_owner_id = auth.uid()));

-- ==================== QUOTE PUBLIC LINKS TABLE ====================
CREATE TABLE public.quote_public_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quote_id UUID NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  public_token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.quote_public_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Store owners can manage their quote links"
ON public.quote_public_links FOR ALL
USING (EXISTS (SELECT 1 FROM public.quotes WHERE id = quote_public_links.quote_id AND store_owner_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.quotes WHERE id = quote_public_links.quote_id AND store_owner_id = auth.uid()));

-- Public read policy for valid tokens (anonymous access)
CREATE POLICY "Anyone can read enabled public links"
ON public.quote_public_links FOR SELECT
USING (is_enabled = true AND (expires_at IS NULL OR expires_at > now()));

-- Public read for quote data via valid link
CREATE POLICY "Public can read quotes via valid link"
ON public.quotes FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.quote_public_links
    WHERE quote_id = quotes.id
    AND is_enabled = true
    AND (expires_at IS NULL OR expires_at > now())
  )
);

-- Public read for quote items via valid link
CREATE POLICY "Public can read quote items via valid link"
ON public.quote_items FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.quote_public_links qpl
    JOIN public.quotes q ON q.id = qpl.quote_id
    WHERE q.id = quote_items.quote_id
    AND qpl.is_enabled = true
    AND (qpl.expires_at IS NULL OR qpl.expires_at > now())
  )
);
