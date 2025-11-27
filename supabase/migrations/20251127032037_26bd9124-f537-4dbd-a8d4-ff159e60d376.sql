-- Adicionar novos campos de endereço detalhado na tabela profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS address_number TEXT,
ADD COLUMN IF NOT EXISTS address_complement TEXT,
ADD COLUMN IF NOT EXISTS address_neighborhood TEXT,
ADD COLUMN IF NOT EXISTS address_city TEXT,
ADD COLUMN IF NOT EXISTS address_state TEXT,
ADD COLUMN IF NOT EXISTS banner_desktop_urls JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS banner_mobile_urls JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.profiles.address_number IS 'Número do endereço';
COMMENT ON COLUMN public.profiles.address_complement IS 'Complemento do endereço (opcional)';
COMMENT ON COLUMN public.profiles.address_neighborhood IS 'Bairro';
COMMENT ON COLUMN public.profiles.address_city IS 'Cidade';
COMMENT ON COLUMN public.profiles.address_state IS 'Estado';
COMMENT ON COLUMN public.profiles.banner_desktop_urls IS 'Array de até 3 URLs de banners para desktop/tablet';
COMMENT ON COLUMN public.profiles.banner_mobile_urls IS 'Array de até 3 URLs de banners para mobile';