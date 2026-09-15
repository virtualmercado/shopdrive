ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS main_banner_content jsonb;

COMMENT ON COLUMN public.profiles.main_banner_content IS
'Optional structured overlay content for main banner slides, associated by array index with desktop/mobile banner images.';

CREATE OR REPLACE FUNCTION public.validate_main_banner_content()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  item jsonb;
  item_url text;
BEGIN
  IF NEW.main_banner_content IS NULL THEN
    RETURN NEW;
  END IF;

  IF jsonb_typeof(NEW.main_banner_content) <> 'array'
     OR jsonb_array_length(NEW.main_banner_content) > 4 THEN
    RAISE EXCEPTION 'main_banner_content must be an array with at most 4 items';
  END IF;

  FOR item IN SELECT value FROM jsonb_array_elements(NEW.main_banner_content)
  LOOP
    IF jsonb_typeof(item) <> 'object' THEN
      RAISE EXCEPTION 'Each main banner content item must be an object';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM jsonb_object_keys(item) AS key
      WHERE key NOT IN ('title', 'subtitle', 'ctaText', 'ctaUrl', 'contentPosition', 'textColor', 'buttonColor')
    ) THEN
      RAISE EXCEPTION 'Unsupported main banner content field';
    END IF;

    IF length(COALESCE(item->>'title', '')) > 60
       OR length(COALESCE(item->>'subtitle', '')) > 120
       OR length(COALESCE(item->>'ctaText', '')) > 30
       OR length(COALESCE(item->>'ctaUrl', '')) > 2048 THEN
      RAISE EXCEPTION 'Main banner content exceeds allowed length';
    END IF;

    IF COALESCE(item->>'contentPosition', 'left') NOT IN ('left', 'center', 'right') THEN
      RAISE EXCEPTION 'Invalid main banner content position';
    END IF;

    IF item ? 'textColor' AND COALESCE(item->>'textColor', '') !~ '^#[0-9A-Fa-f]{6}$' THEN
      RAISE EXCEPTION 'Invalid main banner text color';
    END IF;

    IF item ? 'buttonColor' AND COALESCE(item->>'buttonColor', '') !~ '^#[0-9A-Fa-f]{6}$' THEN
      RAISE EXCEPTION 'Invalid main banner button color';
    END IF;

    item_url := btrim(COALESCE(item->>'ctaUrl', ''));
    IF item_url <> ''
       AND item_url !~ '^/(?!/)[^[:cntrl:]]*$'
       AND item_url !~* '^https?://[^[:space:][:cntrl:]]+$' THEN
      RAISE EXCEPTION 'Invalid main banner CTA URL';
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_main_banner_content_trigger ON public.profiles;
CREATE TRIGGER validate_main_banner_content_trigger
BEFORE INSERT OR UPDATE OF main_banner_content ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.validate_main_banner_content();

CREATE OR REPLACE VIEW public.public_store_profiles
WITH (security_invoker = true)
AS
SELECT id,
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
    CASE WHEN delivery_option = ANY (ARRAY['pickup_only'::text, 'delivery_and_pickup'::text]) THEN pickup_address ELSE NULL::text END AS pickup_address,
    CASE WHEN delivery_option = ANY (ARRAY['pickup_only'::text, 'delivery_and_pickup'::text]) THEN use_account_address_for_pickup ELSE NULL::boolean END AS use_account_address_for_pickup,
    CASE WHEN delivery_option = ANY (ARRAY['pickup_only'::text, 'delivery_and_pickup'::text]) THEN pickup_hours_weekday_start ELSE NULL::text END AS pickup_hours_weekday_start,
    CASE WHEN delivery_option = ANY (ARRAY['pickup_only'::text, 'delivery_and_pickup'::text]) THEN pickup_hours_weekday_end ELSE NULL::text END AS pickup_hours_weekday_end,
    CASE WHEN delivery_option = ANY (ARRAY['pickup_only'::text, 'delivery_and_pickup'::text]) THEN pickup_hours_saturday_start ELSE NULL::text END AS pickup_hours_saturday_start,
    CASE WHEN delivery_option = ANY (ARRAY['pickup_only'::text, 'delivery_and_pickup'::text]) THEN pickup_hours_saturday_end ELSE NULL::text END AS pickup_hours_saturday_end,
    merchant_city,
    merchant_state,
    merchant_reference_cep,
    store_model,
    store_layout,
    header_logo_position,
    topbar_enabled,
    topbar_bg_color,
    topbar_text_color,
    topbar_text,
    topbar_link_type,
    topbar_link_target,
    home_video_enabled,
    home_video_id,
    home_video_title,
    home_video_description,
    selected_benefit_banners,
    minibanner_1_img2_url,
    minibanner_2_img2_url,
    content_banners,
    price_color,
    title_color,
    address,
    address_number,
    address_complement,
    address_neighborhood,
    address_city,
    address_state,
    main_banner_content
FROM public.profiles
WHERE store_slug IS NOT NULL;

GRANT SELECT ON public.public_store_profiles TO anon, authenticated;
GRANT ALL ON public.public_store_profiles TO service_role;