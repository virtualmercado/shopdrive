-- Fix Security Definer View vulnerability
-- Drop and recreate public_profiles view with SECURITY INVOKER

DROP VIEW IF EXISTS public_profiles;

CREATE OR REPLACE VIEW public_profiles 
WITH (security_invoker = true) AS
SELECT 
  id,
  store_name,
  display_name,
  store_slug,
  store_description,
  store_logo_url,
  primary_color,
  secondary_color,
  created_at
FROM profiles
WHERE store_slug IS NOT NULL;

-- Grant proper access to anonymous and authenticated users
GRANT SELECT ON public_profiles TO anon, authenticated;