-- Create product_brands table
CREATE TABLE public.product_brands (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  logo_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add unique constraint for brand name per user
ALTER TABLE public.product_brands ADD CONSTRAINT product_brands_user_name_unique UNIQUE (user_id, name);

-- Enable Row Level Security
ALTER TABLE public.product_brands ENABLE ROW LEVEL SECURITY;

-- Create policies for product_brands
CREATE POLICY "Users can view their own brands" 
ON public.product_brands 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own brands" 
ON public.product_brands 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own brands" 
ON public.product_brands 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own brands" 
ON public.product_brands 
FOR DELETE 
USING (auth.uid() = user_id);

-- Public can view active brands (for store display)
CREATE POLICY "Public can view active brands"
ON public.product_brands
FOR SELECT
USING (is_active = true);

-- Add brand_id column to products table
ALTER TABLE public.products ADD COLUMN brand_id UUID REFERENCES public.product_brands(id) ON DELETE SET NULL;

-- Create index for faster brand lookups
CREATE INDEX idx_products_brand_id ON public.products(brand_id);
CREATE INDEX idx_product_brands_user_id ON public.product_brands(user_id);

-- Create trigger for updated_at
CREATE TRIGGER update_product_brands_updated_at
BEFORE UPDATE ON public.product_brands
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();