-- Add store_layout column to profiles table
-- This column stores the selected layout option for the merchant's online store
-- Default is 'layout_01' (Classic layout)
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS store_layout TEXT DEFAULT 'layout_01';

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.store_layout IS 'Selected layout for the online store: layout_01 (Classic), layout_02 (Conversion), layout_03 (Brand & Content)';