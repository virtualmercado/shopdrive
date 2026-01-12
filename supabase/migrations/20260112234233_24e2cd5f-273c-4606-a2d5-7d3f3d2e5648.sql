-- Fix the SECURITY DEFINER view issue by recreating with SECURITY INVOKER
-- This ensures the view uses the querying user's permissions

DROP VIEW IF EXISTS public_store_profiles;

CREATE VIEW public_store_profiles 
WITH (security_invoker = true)
AS
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
  whatsapp_number,
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
WHERE store_slug IS NOT NULL;

-- Grant access to the view for anon and authenticated users
GRANT SELECT ON public_store_profiles TO anon, authenticated;

-- Add a policy to allow anyone to read from public stores for the public view to work
-- This is needed because SECURITY INVOKER uses the caller's permissions
CREATE POLICY "Anyone can view public store data for stores with slugs"
  ON profiles FOR SELECT
  USING (store_slug IS NOT NULL);