-- Create table for template products (catalog base)
CREATE TABLE public.brand_template_products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id UUID NOT NULL REFERENCES public.brand_templates(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  price DECIMAL(10,2) NOT NULL DEFAULT 0,
  sku TEXT,
  images TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.brand_template_products ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (admin only)
CREATE POLICY "Admins can manage template products"
  ON public.brand_template_products
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Create trigger for updated_at
CREATE TRIGGER update_brand_template_products_updated_at
  BEFORE UPDATE ON public.brand_template_products
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Create index for faster queries
CREATE INDEX idx_brand_template_products_template_id ON public.brand_template_products(template_id);

-- Add trigger to update products_count on brand_templates
CREATE OR REPLACE FUNCTION public.update_template_products_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.brand_templates 
    SET products_count = (
      SELECT COUNT(*) FROM public.brand_template_products 
      WHERE template_id = NEW.template_id
    )
    WHERE id = NEW.template_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.brand_templates 
    SET products_count = (
      SELECT COUNT(*) FROM public.brand_template_products 
      WHERE template_id = OLD.template_id
    )
    WHERE id = OLD.template_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trigger_update_template_products_count
  AFTER INSERT OR DELETE ON public.brand_template_products
  FOR EACH ROW
  EXECUTE FUNCTION public.update_template_products_count();