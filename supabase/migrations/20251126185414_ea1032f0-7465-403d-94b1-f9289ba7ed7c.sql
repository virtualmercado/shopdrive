-- Add shipping configuration fields to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS pickup_address TEXT,
ADD COLUMN IF NOT EXISTS shipping_fixed_fee NUMERIC DEFAULT 10,
ADD COLUMN IF NOT EXISTS shipping_free_minimum NUMERIC DEFAULT 100;