-- Add button_border_style column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS button_border_style text DEFAULT 'rounded';