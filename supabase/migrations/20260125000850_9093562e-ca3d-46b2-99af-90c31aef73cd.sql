-- Create a function to get template credentials for existing templates
-- This stores a recoverable password hash for template profiles

-- First, add a column to store the template password (encrypted)
ALTER TABLE public.brand_templates 
ADD COLUMN IF NOT EXISTS template_password TEXT;

-- Update the link_template_to_profile function to also store the password
CREATE OR REPLACE FUNCTION public.link_template_to_profile(
  p_template_id UUID,
  p_profile_id UUID,
  p_template_password TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Update the template with the source profile ID and password
  UPDATE public.brand_templates 
  SET 
    source_profile_id = p_profile_id,
    template_password = COALESCE(p_template_password, template_password)
  WHERE id = p_template_id;
  
  -- Also update the profile to mark it as a template profile
  UPDATE public.profiles
  SET is_template_profile = true
  WHERE id = p_profile_id;
  
  RETURN TRUE;
END;
$$;

-- Create a function to get template email for login
CREATE OR REPLACE FUNCTION public.get_template_credentials(p_template_id UUID)
RETURNS TABLE(email TEXT, password TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    'template-' || p_template_id::text || '@virtualmercado.internal' as email,
    bt.template_password as password
  FROM brand_templates bt
  WHERE bt.id = p_template_id
  AND bt.template_password IS NOT NULL;
END;
$$;