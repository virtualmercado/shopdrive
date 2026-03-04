
-- Remove plaintext password storage from brand_templates
ALTER TABLE public.brand_templates DROP COLUMN IF EXISTS template_password;

-- Drop the function that returns plaintext credentials
DROP FUNCTION IF EXISTS public.get_template_credentials(uuid);

-- Drop the function that resets and stores password in DB
DROP FUNCTION IF EXISTS public.reset_template_password(uuid);

-- Update link_template_to_profile to remove password parameter (drop both overloads, recreate clean one)
DROP FUNCTION IF EXISTS public.link_template_to_profile(uuid, uuid);
DROP FUNCTION IF EXISTS public.link_template_to_profile(uuid, uuid, text);

CREATE OR REPLACE FUNCTION public.link_template_to_profile(p_template_id uuid, p_profile_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.brand_templates 
  SET source_profile_id = p_profile_id
  WHERE id = p_template_id;
  
  UPDATE public.profiles
  SET is_template_profile = true
  WHERE id = p_profile_id;
  
  RETURN TRUE;
END;
$$;
