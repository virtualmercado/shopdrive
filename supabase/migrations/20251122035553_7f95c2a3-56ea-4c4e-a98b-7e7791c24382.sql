-- Add new fields to profiles table for subscriber management
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS cpf_cnpj TEXT,
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS address TEXT,
ADD COLUMN IF NOT EXISTS last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_cpf_cnpj ON public.profiles(cpf_cnpj);
CREATE INDEX IF NOT EXISTS idx_profiles_phone ON public.profiles(phone);
CREATE INDEX IF NOT EXISTS idx_profiles_last_activity ON public.profiles(last_activity);

-- Add payment_link field to invoices for easier payment recovery
ALTER TABLE public.invoices
ADD COLUMN IF NOT EXISTS payment_link TEXT;

-- Add internal_notes to subscriptions for admin notes
ALTER TABLE public.subscriptions
ADD COLUMN IF NOT EXISTS internal_notes TEXT;