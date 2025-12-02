-- Add button color columns to profiles table
ALTER TABLE public.profiles
ADD COLUMN button_bg_color TEXT DEFAULT '#6a1b9a',
ADD COLUMN button_text_color TEXT DEFAULT '#FFFFFF';