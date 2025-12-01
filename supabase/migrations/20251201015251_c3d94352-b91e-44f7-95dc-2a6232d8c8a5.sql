-- Add product design customization columns to profiles table
ALTER TABLE profiles 
ADD COLUMN product_image_format text DEFAULT 'square',
ADD COLUMN product_border_style text DEFAULT 'rounded';