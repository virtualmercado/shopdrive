-- Add store_model column to profiles table
-- Values: 'loja_virtual' (default) or 'catalogo_digital'
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS store_model TEXT NOT NULL DEFAULT 'loja_virtual';

-- Add check constraint for valid values
ALTER TABLE public.profiles 
ADD CONSTRAINT profiles_store_model_check 
CHECK (store_model IN ('loja_virtual', 'catalogo_digital'));