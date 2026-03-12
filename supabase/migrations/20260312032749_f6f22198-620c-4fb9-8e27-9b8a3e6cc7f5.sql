
-- Fix SECURITY DEFINER functions missing SET search_path

CREATE OR REPLACE FUNCTION public.update_master_subscription_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.check_order_rate_limit(client_ip text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE
  current_count INTEGER;
  window_start_time TIMESTAMP WITH TIME ZONE;
BEGIN
  DELETE FROM public.order_rate_limit 
  WHERE window_start < (NOW() - INTERVAL '1 hour');
  
  SELECT order_count, window_start INTO current_count, window_start_time
  FROM public.order_rate_limit
  WHERE ip_address = client_ip
  AND window_start > (NOW() - INTERVAL '1 hour')
  ORDER BY window_start DESC
  LIMIT 1;
  
  IF current_count IS NULL THEN
    INSERT INTO public.order_rate_limit (ip_address, order_count, window_start)
    VALUES (client_ip, 1, NOW());
    RETURN TRUE;
  END IF;
  
  IF current_count < 3 THEN
    UPDATE public.order_rate_limit
    SET order_count = order_count + 1
    WHERE ip_address = client_ip
    AND window_start = window_start_time;
    RETURN TRUE;
  END IF;
  
  RETURN FALSE;
END;
$function$;

CREATE OR REPLACE FUNCTION public.generate_ticket_number()
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE
  next_number INTEGER;
  ticket_num TEXT;
BEGIN
  SELECT COALESCE(MAX(SUBSTRING(ticket_number FROM 2)::INTEGER), 0) + 1
  INTO next_number
  FROM public.support_tickets;
  
  ticket_num := '#' || LPAD(next_number::TEXT, 5, '0');
  RETURN ticket_num;
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_ticket_number()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
BEGIN
  IF NEW.ticket_number IS NULL OR NEW.ticket_number = '' THEN
    NEW.ticket_number := public.generate_ticket_number();
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_new_order_customer()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
BEGIN
  IF NEW.customer_id IS NOT NULL THEN
    INSERT INTO public.store_customers (store_owner_id, customer_id, is_active, origin)
    VALUES (NEW.store_owner_id, NEW.customer_id, true, 'online_store')
    ON CONFLICT (store_owner_id, customer_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.check_media_file_usage(file_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE
  is_in_use BOOLEAN := FALSE;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.cms_banners WHERE media_id = file_id
  ) INTO is_in_use;
  
  RETURN is_in_use;
END;
$function$;

CREATE OR REPLACE FUNCTION public.prevent_media_deletion()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
BEGIN
  IF public.check_media_file_usage(OLD.id) THEN
    RAISE EXCEPTION 'Este arquivo está sendo usado em conteúdos ativos da plataforma e não pode ser excluído.';
  END IF;
  RETURN OLD;
END;
$function$;

CREATE OR REPLACE FUNCTION public.link_template_to_profile(p_template_id uuid, p_profile_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
BEGIN
  UPDATE public.brand_templates 
  SET source_profile_id = p_profile_id
  WHERE id = p_template_id;
  
  UPDATE public.profiles
  SET is_template_profile = true
  WHERE id = p_profile_id;
  
  RETURN TRUE;
END;
$function$;

CREATE OR REPLACE FUNCTION public.log_audit_event(p_action text, p_entity_type text, p_entity_id uuid DEFAULT NULL::uuid, p_metadata jsonb DEFAULT '{}'::jsonb, p_ip_address text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, metadata, ip_address)
  VALUES (auth.uid(), p_action, p_entity_type, p_entity_id, p_metadata, p_ip_address)
  RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_account_deletion_requests_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.generate_landing_ticket_protocol()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = public
AS $function$
DECLARE
  today_date TEXT;
  ticket_count INTEGER;
  new_protocol TEXT;
BEGIN
  today_date := to_char(now(), 'YYYYMMDD');
  
  SELECT COUNT(*) + 1 INTO ticket_count
  FROM public.tickets_landing_page
  WHERE protocolo LIKE 'VM-LP-' || today_date || '%';
  
  new_protocol := 'VM-LP-' || today_date || '-' || lpad(ticket_count::TEXT, 4, '0');
  NEW.protocolo := new_protocol;
  
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_template_products_count()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.brand_templates 
    SET products_count = (
      SELECT COUNT(*) FROM public.brand_template_products 
      WHERE template_id = NEW.template_id
    )
    WHERE id = NEW.template_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.brand_templates 
    SET products_count = (
      SELECT COUNT(*) FROM public.brand_template_products 
      WHERE template_id = OLD.template_id
    )
    WHERE id = OLD.template_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.sync_template_from_profile(p_template_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE
  v_profile RECORD;
  v_source_profile_id UUID;
BEGIN
  SELECT source_profile_id INTO v_source_profile_id
  FROM brand_templates
  WHERE id = p_template_id;
  
  IF v_source_profile_id IS NULL THEN
    RAISE EXCEPTION 'Template does not have a source profile linked';
  END IF;
  
  SELECT * INTO v_profile FROM profiles WHERE id = v_source_profile_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Source profile not found';
  END IF;
  
  UPDATE brand_templates SET
    store_name = v_profile.store_name,
    logo_url = v_profile.store_logo_url,
    primary_color = v_profile.primary_color,
    secondary_color = v_profile.secondary_color,
    font_family = v_profile.font_family,
    button_bg_color = v_profile.button_bg_color,
    button_text_color = v_profile.button_text_color,
    footer_bg_color = v_profile.footer_bg_color,
    footer_text_color = v_profile.footer_text_color,
    banner_desktop_urls = v_profile.banner_desktop_urls,
    banner_mobile_urls = v_profile.banner_mobile_urls,
    whatsapp_number = v_profile.whatsapp_number,
    instagram_url = v_profile.instagram_url,
    facebook_url = v_profile.facebook_url,
    show_whatsapp_button = COALESCE(v_profile.show_whatsapp_button, true),
    updated_at = now()
  WHERE id = p_template_id;
  
  UPDATE brand_templates SET
    products_count = (
      SELECT COUNT(*) FROM products 
      WHERE user_id = v_source_profile_id
    )
  WHERE id = p_template_id;
  
  DELETE FROM brand_template_products WHERE template_id = p_template_id;
  
  INSERT INTO brand_template_products (template_id, name, description, price, images, category, sku, is_active, display_order)
  SELECT 
    p_template_id,
    p.name,
    p.description,
    p.price,
    CASE 
      WHEN p.images IS NULL THEN NULL
      WHEN jsonb_typeof(p.images) = 'array' THEN 
        ARRAY(SELECT jsonb_array_elements_text(p.images))
      ELSE NULL
    END,
    'Geral',
    NULL,
    true,
    ROW_NUMBER() OVER (ORDER BY p.created_at)
  FROM products p
  WHERE p.user_id = v_source_profile_id
  LIMIT 20;
  
END;
$function$;

CREATE OR REPLACE FUNCTION public.clone_template_to_store(p_template_id uuid, p_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE
  v_template RECORD;
BEGIN
  SELECT * INTO v_template FROM brand_templates WHERE id = p_template_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Template not found';
  END IF;
  
  UPDATE profiles SET
    store_name = COALESCE(v_template.store_name, v_template.name),
    store_logo_url = v_template.logo_url,
    primary_color = COALESCE(v_template.primary_color, '#000000'),
    secondary_color = COALESCE(v_template.secondary_color, '#ffffff'),
    font_family = v_template.font_family,
    button_bg_color = v_template.button_bg_color,
    button_text_color = v_template.button_text_color,
    footer_bg_color = v_template.footer_bg_color,
    footer_text_color = v_template.footer_text_color,
    banner_desktop_urls = COALESCE(v_template.banner_desktop_urls, '[]'::jsonb),
    banner_mobile_urls = COALESCE(v_template.banner_mobile_urls, '[]'::jsonb),
    whatsapp_number = v_template.whatsapp_number,
    instagram_url = v_template.instagram_url,
    facebook_url = v_template.facebook_url,
    show_whatsapp_button = COALESCE(v_template.show_whatsapp_button, true),
    source_template_id = p_template_id,
    updated_at = now()
  WHERE id = p_user_id;
  
  INSERT INTO products (user_id, name, description, price, images, category, sku, is_active)
  SELECT 
    p_user_id,
    tp.name,
    tp.description,
    tp.price,
    tp.images,
    tp.category,
    tp.sku,
    tp.is_active
  FROM brand_template_products tp
  WHERE tp.template_id = p_template_id AND tp.is_active = true;
  
  UPDATE brand_templates SET
    stores_created = stores_created + 1,
    updated_at = now()
  WHERE id = p_template_id;
  
END;
$function$;

CREATE OR REPLACE FUNCTION public.copy_template_products_to_store(p_template_id uuid, p_user_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE
  copied_count INTEGER := 0;
  template_product RECORD;
BEGIN
  FOR template_product IN 
    SELECT * FROM public.brand_template_products 
    WHERE template_id = p_template_id AND is_active = true
  LOOP
    INSERT INTO public.products (
      user_id, name, description, price, category, images, is_active, sku
    ) VALUES (
      p_user_id,
      template_product.name,
      template_product.description,
      template_product.price,
      template_product.category,
      template_product.images,
      true,
      template_product.sku
    );
    copied_count := copied_count + 1;
  END LOOP;
  
  UPDATE public.brand_templates
  SET stores_created = stores_created + 1
  WHERE id = p_template_id;
  
  RETURN copied_count;
END;
$function$;

CREATE OR REPLACE FUNCTION public.increment_template_link_clicks(p_template_slug text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
BEGIN
  UPDATE public.brand_templates
  SET link_clicks = link_clicks + 1
  WHERE template_slug = p_template_slug AND is_link_active = true;
  
  RETURN FOUND;
END;
$function$;

CREATE OR REPLACE FUNCTION public.track_template_click(p_template_slug text, p_ip_address text DEFAULT NULL::text, p_user_agent text DEFAULT NULL::text, p_session_id text DEFAULT NULL::text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE
  v_template_id UUID;
  v_is_bot BOOLEAN := false;
  v_recent_click_exists BOOLEAN;
  v_session_click_exists BOOLEAN;
BEGIN
  SELECT id INTO v_template_id
  FROM brand_templates
  WHERE template_slug = p_template_slug AND is_link_active = true;

  IF v_template_id IS NULL THEN
    RETURN false;
  END IF;

  IF p_user_agent IS NOT NULL THEN
    IF p_user_agent ~* '(facebookexternalhit|WhatsApp|TelegramBot|Discordbot|Twitterbot|Slackbot|LinkedInBot|Googlebot|bingbot|Baiduspider|YandexBot|Sogou|DuckDuckBot|ia_archiver|AhrefsBot|SemrushBot|MJ12bot|DotBot|PetalBot|Bytespider)' THEN
      v_is_bot := true;
    END IF;
  END IF;

  IF v_is_bot THEN
    INSERT INTO template_click_events (template_id, ip_address, user_agent, session_id, is_bot, counted)
    VALUES (v_template_id, p_ip_address, p_user_agent, p_session_id, true, false);
    RETURN false;
  END IF;

  IF p_session_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM template_click_events
      WHERE template_id = v_template_id
        AND session_id = p_session_id
        AND counted = true
    ) INTO v_session_click_exists;

    IF v_session_click_exists THEN
      INSERT INTO template_click_events (template_id, ip_address, user_agent, session_id, is_bot, counted)
      VALUES (v_template_id, p_ip_address, p_user_agent, p_session_id, false, false);
      RETURN false;
    END IF;
  END IF;

  IF p_ip_address IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM template_click_events
      WHERE template_id = v_template_id
        AND ip_address = p_ip_address
        AND counted = true
        AND created_at > now() - interval '10 minutes'
    ) INTO v_recent_click_exists;

    IF v_recent_click_exists THEN
      INSERT INTO template_click_events (template_id, ip_address, user_agent, session_id, is_bot, counted)
      VALUES (v_template_id, p_ip_address, p_user_agent, p_session_id, false, false);
      RETURN false;
    END IF;
  END IF;

  INSERT INTO template_click_events (template_id, ip_address, user_agent, session_id, is_bot, counted)
  VALUES (v_template_id, p_ip_address, p_user_agent, p_session_id, false, true);

  UPDATE brand_templates
  SET link_clicks = link_clicks + 1
  WHERE id = v_template_id;

  RETURN true;
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_store_referral(p_inviter_store_id uuid, p_new_store_id uuid, p_template_id uuid DEFAULT NULL::uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
BEGIN
  IF p_inviter_store_id = p_new_store_id THEN
    RETURN false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_inviter_store_id) THEN
    RETURN false;
  END IF;

  IF EXISTS (SELECT 1 FROM store_referrals WHERE new_store_id = p_new_store_id) THEN
    RETURN false;
  END IF;

  IF EXISTS (SELECT 1 FROM store_referrals WHERE inviter_store_id = p_new_store_id AND new_store_id = p_inviter_store_id) THEN
    RETURN false;
  END IF;

  DECLARE
    v_depth INTEGER := 0;
    v_current UUID := p_inviter_store_id;
  BEGIN
    LOOP
      SELECT inviter_store_id INTO v_current
      FROM store_referrals
      WHERE new_store_id = v_current;
      
      IF NOT FOUND THEN EXIT; END IF;
      v_depth := v_depth + 1;
      IF v_depth >= 5 THEN RETURN false; END IF;
    END LOOP;
  END;

  INSERT INTO store_referrals (inviter_store_id, new_store_id, template_id)
  VALUES (p_inviter_store_id, p_new_store_id, p_template_id);

  RETURN true;
END;
$function$;

CREATE OR REPLACE FUNCTION public.increment_email_metric_counters(p_tenant_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
BEGIN
  UPDATE public.tenant_email_metrics
  SET
    emails_last_hour = emails_last_hour + 1,
    emails_last_day = emails_last_day + 1,
    total_sent = total_sent + 1,
    last_email_sent_at = now()
  WHERE tenant_id = p_tenant_id;

  IF NOT FOUND THEN
    INSERT INTO public.tenant_email_metrics (tenant_id, emails_last_hour, emails_last_day, total_sent, last_email_sent_at)
    VALUES (p_tenant_id, 1, 1, 1, now())
    ON CONFLICT DO NOTHING;
  END IF;
END;
$function$;
