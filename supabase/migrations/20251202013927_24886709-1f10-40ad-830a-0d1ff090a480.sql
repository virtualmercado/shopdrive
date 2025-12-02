-- Add product_text_alignment column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN product_text_alignment TEXT DEFAULT 'left' CHECK (product_text_alignment IN ('left', 'center'));