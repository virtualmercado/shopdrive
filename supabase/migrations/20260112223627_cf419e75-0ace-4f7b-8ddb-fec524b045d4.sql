-- Fix: Drop policies that expose shipping API keys publicly
-- Issue: melhor_envio_settings and correios_settings expose api_key and contract_password

-- Drop the dangerous public policies on melhor_envio_settings if they exist
DROP POLICY IF EXISTS "Anyone can view active melhor envio settings for public stores" ON public.melhor_envio_settings;

-- Drop the dangerous public policies on correios_settings if they exist  
DROP POLICY IF EXISTS "Anyone can view active correios settings for public stores" ON public.correios_settings;

-- Create secure public views that only expose non-sensitive fields

-- Melhor Envio public view (only is_active status, no API keys)
CREATE OR REPLACE VIEW public.melhor_envio_settings_public
WITH (security_invoker = on)
AS SELECT 
  user_id,
  is_active,
  environment
FROM public.melhor_envio_settings
WHERE is_active = true;

GRANT SELECT ON public.melhor_envio_settings_public TO anon, authenticated;

-- Correios public view (only is_active and origin zip, no credentials)
CREATE OR REPLACE VIEW public.correios_settings_public
WITH (security_invoker = on)
AS SELECT 
  user_id,
  is_active,
  origin_zipcode
FROM public.correios_settings
WHERE is_active = true;

GRANT SELECT ON public.correios_settings_public TO anon, authenticated;