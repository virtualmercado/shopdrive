-- Add CPF and phone fields to customer_profiles if they don't exist
ALTER TABLE public.customer_profiles 
ADD COLUMN IF NOT EXISTS cpf TEXT,
ADD COLUMN IF NOT EXISTS receive_promotions BOOLEAN DEFAULT false;