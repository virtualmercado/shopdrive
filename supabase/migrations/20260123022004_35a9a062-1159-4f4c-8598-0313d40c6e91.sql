
-- Create enum for brand template status
CREATE TYPE brand_template_status AS ENUM ('draft', 'active', 'inactive');

-- Create brand_templates table
CREATE TABLE public.brand_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  logo_url TEXT,
  status brand_template_status NOT NULL DEFAULT 'draft',
  description TEXT,
  products_count INTEGER NOT NULL DEFAULT 0,
  stores_created INTEGER NOT NULL DEFAULT 0,
  max_products INTEGER NOT NULL DEFAULT 20,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.brand_templates ENABLE ROW LEVEL SECURITY;

-- RLS policies - Only admins can manage brand templates
CREATE POLICY "Admins can manage brand templates"
ON public.brand_templates
FOR ALL
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Create trigger for updated_at
CREATE TRIGGER update_brand_templates_updated_at
BEFORE UPDATE ON public.brand_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add comments
COMMENT ON TABLE public.brand_templates IS 'Stores brand templates for quick store onboarding';
COMMENT ON COLUMN public.brand_templates.name IS 'Brand name';
COMMENT ON COLUMN public.brand_templates.logo_url IS 'URL to brand logo image';
COMMENT ON COLUMN public.brand_templates.status IS 'Template status: draft, active, or inactive';
COMMENT ON COLUMN public.brand_templates.description IS 'Internal description for admin use';
COMMENT ON COLUMN public.brand_templates.products_count IS 'Current number of products in template';
COMMENT ON COLUMN public.brand_templates.stores_created IS 'Number of stores created from this template';
COMMENT ON COLUMN public.brand_templates.max_products IS 'Maximum products allowed (default 20 for free plan)';
