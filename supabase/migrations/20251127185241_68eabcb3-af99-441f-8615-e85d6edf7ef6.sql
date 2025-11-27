-- Adicionar campo CEP na tabela profiles
ALTER TABLE public.profiles 
ADD COLUMN address_zip_code TEXT;

COMMENT ON COLUMN public.profiles.address_zip_code IS 'CEP do endereço da loja';