-- Add typography columns to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS font_family TEXT DEFAULT 'Inter',
ADD COLUMN IF NOT EXISTS font_weight INTEGER DEFAULT 400;