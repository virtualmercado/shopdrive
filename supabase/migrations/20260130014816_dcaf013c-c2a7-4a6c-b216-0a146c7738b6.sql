-- Add about_us_title column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS about_us_title TEXT;