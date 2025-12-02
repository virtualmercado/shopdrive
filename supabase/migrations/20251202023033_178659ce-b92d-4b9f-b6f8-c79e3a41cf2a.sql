-- Add product_button_display column to profiles table
ALTER TABLE profiles 
ADD COLUMN product_button_display TEXT DEFAULT 'below' 
CHECK (product_button_display IN ('below', 'none'));