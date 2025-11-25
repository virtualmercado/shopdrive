-- Criar tabela de categorias
CREATE TABLE IF NOT EXISTS public.product_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, name)
);

-- Habilitar RLS
ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para categorias
CREATE POLICY "Users can view their own categories"
  ON public.product_categories
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own categories"
  ON public.product_categories
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own categories"
  ON public.product_categories
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own categories"
  ON public.product_categories
  FOR DELETE
  USING (auth.uid() = user_id);

-- Adicionar campos na tabela products
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS promotional_price NUMERIC,
  ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.product_categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS images JSONB DEFAULT '[]'::jsonb;

-- Trigger para updated_at em categorias
CREATE TRIGGER update_product_categories_updated_at
  BEFORE UPDATE ON public.product_categories
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Atualizar view public_store_products para incluir novos campos
DROP VIEW IF EXISTS public.public_store_products;

CREATE VIEW public.public_store_products
WITH (security_invoker=true) AS
SELECT 
  p.id,
  p.name,
  p.description,
  p.price,
  p.promotional_price,
  p.stock,
  p.image_url,
  p.images,
  p.category_id,
  p.created_at,
  p.updated_at,
  pr.store_slug
FROM public.products p
JOIN public.profiles pr ON p.user_id = pr.id
WHERE pr.store_slug IS NOT NULL;