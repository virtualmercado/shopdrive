-- Create CMS banners table to store references to media files
CREATE TABLE public.cms_banners (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  banner_key TEXT NOT NULL UNIQUE, -- 'banner_01', 'banner_02', 'banner_03'
  name TEXT NOT NULL,
  description TEXT,
  media_id UUID REFERENCES public.media_files(id) ON DELETE SET NULL,
  media_url TEXT,
  media_type TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.cms_banners ENABLE ROW LEVEL SECURITY;

-- Create policies - only admins can manage banners
CREATE POLICY "Admins can view banners"
ON public.cms_banners
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
);

CREATE POLICY "Admins can insert banners"
ON public.cms_banners
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
);

CREATE POLICY "Admins can update banners"
ON public.cms_banners
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
);

CREATE POLICY "Admins can delete banners"
ON public.cms_banners
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
);

-- Public read access for landing page to fetch active banners
CREATE POLICY "Public can view active banners"
ON public.cms_banners
FOR SELECT
USING (is_active = true);

-- Insert default banners
INSERT INTO public.cms_banners (banner_key, name, description, display_order, is_active) VALUES
('banner_01', 'Banner 01', 'Banner principal da seção Hero (topo da landing page)', 1, true),
('banner_02', 'Banner 02', 'Imagem da seção "Seus produtos disponíveis em todos os lugares"', 2, true),
('banner_03', 'Banner 03', 'Imagem da seção "Venda através do WhatsApp ou aceite pagamentos"', 3, true);

-- Create updated_at trigger
CREATE TRIGGER update_cms_banners_updated_at
  BEFORE UPDATE ON public.cms_banners
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add column to media_files to track usage count
ALTER TABLE public.media_files ADD COLUMN IF NOT EXISTS usage_count INTEGER NOT NULL DEFAULT 0;

-- Create function to check if media file is in use
CREATE OR REPLACE FUNCTION public.check_media_file_usage(file_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_in_use BOOLEAN := FALSE;
BEGIN
  -- Check if file is used in CMS banners
  SELECT EXISTS (
    SELECT 1 FROM public.cms_banners WHERE media_id = file_id
  ) INTO is_in_use;
  
  RETURN is_in_use;
END;
$$;

-- Create function to prevent deletion of files in use
CREATE OR REPLACE FUNCTION public.prevent_media_deletion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.check_media_file_usage(OLD.id) THEN
    RAISE EXCEPTION 'Este arquivo está sendo usado em conteúdos ativos da plataforma e não pode ser excluído.';
  END IF;
  RETURN OLD;
END;
$$;

-- Create trigger to prevent deletion of files in use
CREATE TRIGGER prevent_media_file_deletion
  BEFORE DELETE ON public.media_files
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_media_deletion();