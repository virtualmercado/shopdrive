-- Add order configuration fields to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS minimum_order_value numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS checkout_require_address boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS checkout_require_personal_info boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS checkout_require_email boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS checkout_require_payment_method boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS checkout_require_cpf boolean DEFAULT false;