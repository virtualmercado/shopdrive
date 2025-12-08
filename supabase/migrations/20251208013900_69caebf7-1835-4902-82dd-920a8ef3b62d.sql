-- Create customer_favorites table for storing customer favorite products
CREATE TABLE public.customer_favorites (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  store_owner_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(customer_id, product_id)
);

-- Enable Row Level Security
ALTER TABLE public.customer_favorites ENABLE ROW LEVEL SECURITY;

-- Customers can view their own favorites
CREATE POLICY "Customers can view their own favorites"
ON public.customer_favorites
FOR SELECT
USING (auth.uid() = customer_id);

-- Customers can add their own favorites
CREATE POLICY "Customers can add their own favorites"
ON public.customer_favorites
FOR INSERT
WITH CHECK (auth.uid() = customer_id);

-- Customers can remove their own favorites
CREATE POLICY "Customers can delete their own favorites"
ON public.customer_favorites
FOR DELETE
USING (auth.uid() = customer_id);

-- Index for faster lookups
CREATE INDEX idx_customer_favorites_customer_id ON public.customer_favorites(customer_id);
CREATE INDEX idx_customer_favorites_store_owner_id ON public.customer_favorites(store_owner_id);