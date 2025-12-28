-- Add about_us field to profiles table for store About Us page content
ALTER TABLE public.profiles 
ADD COLUMN about_us_text TEXT NULL;