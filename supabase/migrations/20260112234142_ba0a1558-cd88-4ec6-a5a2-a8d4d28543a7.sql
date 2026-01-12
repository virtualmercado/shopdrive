-- ================================================================
-- SECURITY FIX 1: Remove overly permissive PIX payment creation policy
-- PIX payments should only be created via authenticated edge functions
-- ================================================================

-- Drop the vulnerable policy that allows anyone to create PIX payments
DROP POLICY IF EXISTS "Anyone can create PIX payments" ON pix_payments;

-- Add a policy that only allows store owners to view their PIX payments (already exists)
-- Add a policy for service role (edge functions) to manage PIX payments
-- Note: Service role bypasses RLS by default, so no explicit policy needed

-- ================================================================
-- SECURITY FIX 2: Protect profiles PII exposure
-- Create a secure public view with only safe fields for public stores
-- ================================================================

-- Create a secure public view that exposes only safe fields for public stores
CREATE OR REPLACE VIEW public_store_profiles AS
SELECT 
  id,
  store_name,
  store_slug,
  store_description,
  store_logo_url,
  display_name,
  primary_color,
  secondary_color,
  footer_bg_color,
  footer_text_color,
  font_family,
  font_weight,
  product_image_format,
  product_border_style,
  product_text_alignment,
  product_button_display,
  button_border_style,
  button_bg_color,
  button_text_color,
  instagram_url,
  facebook_url,
  x_url,
  youtube_url,
  whatsapp_number, -- Public business WhatsApp only
  delivery_option,
  minimum_order_value,
  free_shipping_minimum,
  free_shipping_scope,
  shipping_fixed_fee,
  banner_desktop_url,
  banner_desktop_urls,
  banner_mobile_url,
  banner_mobile_urls,
  banner_rect_1_url,
  banner_rect_2_url,
  return_policy_text,
  about_us_text,
  is_maintenance_mode,
  checkout_require_address,
  checkout_require_cpf,
  checkout_require_email,
  checkout_require_payment_method,
  checkout_require_personal_info,
  -- Conditional pickup info only if pickup is enabled
  CASE WHEN delivery_option IN ('pickup_only', 'delivery_and_pickup') 
    THEN pickup_address ELSE NULL END as pickup_address,
  CASE WHEN delivery_option IN ('pickup_only', 'delivery_and_pickup') 
    THEN use_account_address_for_pickup ELSE NULL END as use_account_address_for_pickup,
  CASE WHEN delivery_option IN ('pickup_only', 'delivery_and_pickup') 
    THEN pickup_hours_weekday_start ELSE NULL END as pickup_hours_weekday_start,
  CASE WHEN delivery_option IN ('pickup_only', 'delivery_and_pickup') 
    THEN pickup_hours_weekday_end ELSE NULL END as pickup_hours_weekday_end,
  CASE WHEN delivery_option IN ('pickup_only', 'delivery_and_pickup') 
    THEN pickup_hours_saturday_start ELSE NULL END as pickup_hours_saturday_start,
  CASE WHEN delivery_option IN ('pickup_only', 'delivery_and_pickup') 
    THEN pickup_hours_saturday_end ELSE NULL END as pickup_hours_saturday_end,
  merchant_city,
  merchant_state,
  merchant_reference_cep
FROM profiles
WHERE store_slug IS NOT NULL; -- Only stores with public URLs

-- Grant access to the view for anon and authenticated users
GRANT SELECT ON public_store_profiles TO anon, authenticated;

-- Drop the overly permissive policy that exposes all profile data
DROP POLICY IF EXISTS "Anyone can view public store profiles" ON profiles;