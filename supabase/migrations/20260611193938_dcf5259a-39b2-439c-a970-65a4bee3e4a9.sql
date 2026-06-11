CREATE OR REPLACE VIEW public.public_store_profiles AS
SELECT
  id, store_name, store_slug, store_description, store_logo_url, display_name,
  primary_color, secondary_color, footer_bg_color, footer_text_color, font_family, font_weight,
  product_image_format, product_border_style, product_text_alignment, product_button_display,
  button_border_style, button_bg_color, button_text_color,
  instagram_url, facebook_url, x_url, youtube_url, whatsapp_number,
  delivery_option, minimum_order_value, free_shipping_minimum, free_shipping_scope, shipping_fixed_fee,
  banner_desktop_url, banner_desktop_urls, banner_mobile_url, banner_mobile_urls,
  banner_rect_1_url, banner_rect_2_url,
  return_policy_text, about_us_text, is_maintenance_mode,
  checkout_require_address, checkout_require_cpf, checkout_require_email,
  checkout_require_payment_method, checkout_require_personal_info,
  CASE WHEN delivery_option = ANY (ARRAY['pickup_only'::text,'delivery_and_pickup'::text]) THEN pickup_address ELSE NULL::text END AS pickup_address,
  CASE WHEN delivery_option = ANY (ARRAY['pickup_only'::text,'delivery_and_pickup'::text]) THEN use_account_address_for_pickup ELSE NULL::boolean END AS use_account_address_for_pickup,
  CASE WHEN delivery_option = ANY (ARRAY['pickup_only'::text,'delivery_and_pickup'::text]) THEN pickup_hours_weekday_start ELSE NULL::text END AS pickup_hours_weekday_start,
  CASE WHEN delivery_option = ANY (ARRAY['pickup_only'::text,'delivery_and_pickup'::text]) THEN pickup_hours_weekday_end ELSE NULL::text END AS pickup_hours_weekday_end,
  CASE WHEN delivery_option = ANY (ARRAY['pickup_only'::text,'delivery_and_pickup'::text]) THEN pickup_hours_saturday_start ELSE NULL::text END AS pickup_hours_saturday_start,
  CASE WHEN delivery_option = ANY (ARRAY['pickup_only'::text,'delivery_and_pickup'::text]) THEN pickup_hours_saturday_end ELSE NULL::text END AS pickup_hours_saturday_end,
  merchant_city, merchant_state, merchant_reference_cep,
  store_model, store_layout, header_logo_position,
  topbar_enabled, topbar_bg_color, topbar_text_color, topbar_text, topbar_link_type, topbar_link_target,
  home_video_enabled, home_video_id, home_video_title, home_video_description,
  selected_benefit_banners, minibanner_1_img2_url, minibanner_2_img2_url, content_banners,
  price_color, title_color,
  address, address_number, address_complement, address_neighborhood, address_city, address_state
FROM public.profiles
WHERE store_slug IS NOT NULL;

ALTER VIEW public.public_store_profiles SET (security_invoker = on);
GRANT SELECT ON public.public_store_profiles TO anon, authenticated;