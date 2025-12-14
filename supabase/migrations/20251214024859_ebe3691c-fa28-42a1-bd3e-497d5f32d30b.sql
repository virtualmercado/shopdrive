-- Add free shipping scope fields to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS free_shipping_scope TEXT DEFAULT 'ALL' CHECK (free_shipping_scope IN ('ALL', 'CITY', 'STATE')),
ADD COLUMN IF NOT EXISTS merchant_reference_cep TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS merchant_city TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS merchant_state TEXT DEFAULT NULL;