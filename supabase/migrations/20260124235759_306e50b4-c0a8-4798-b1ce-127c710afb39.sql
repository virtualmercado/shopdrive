-- Create a secure function to link template to profile (runs with SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.link_template_to_profile(
  p_template_id UUID,
  p_profile_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Update the template with the source profile ID
  UPDATE public.brand_templates 
  SET source_profile_id = p_profile_id
  WHERE id = p_template_id;
  
  -- Also update the profile to mark it as a template profile
  UPDATE public.profiles
  SET is_template_profile = true
  WHERE id = p_profile_id;
  
  RETURN TRUE;
END;
$$;

-- Fix existing templates that have matching profile users but no link
-- Match by template ID in the user email
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN 
    SELECT 
      bt.id as template_id,
      u.id as user_id
    FROM brand_templates bt
    CROSS JOIN auth.users u
    WHERE bt.source_profile_id IS NULL
    AND u.email = 'template-' || bt.id::text || '@virtualmercado.internal'
  LOOP
    UPDATE brand_templates 
    SET source_profile_id = r.user_id 
    WHERE id = r.template_id;
    
    UPDATE profiles
    SET is_template_profile = true
    WHERE id = r.user_id;
  END LOOP;
END;
$$;