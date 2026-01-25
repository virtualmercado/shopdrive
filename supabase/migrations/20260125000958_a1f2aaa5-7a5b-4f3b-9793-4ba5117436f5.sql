-- Create a function to reset template password and store it
-- This can be used by admins to regenerate access to templates
CREATE OR REPLACE FUNCTION public.reset_template_password(p_template_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_password TEXT;
  v_email TEXT;
  v_source_profile_id UUID;
BEGIN
  -- Generate a new password
  v_new_password := 'Template' || EXTRACT(EPOCH FROM now())::BIGINT || '!' || substr(md5(random()::text), 1, 10);
  
  -- Get template info
  SELECT source_profile_id INTO v_source_profile_id
  FROM brand_templates
  WHERE id = p_template_id;
  
  IF v_source_profile_id IS NULL THEN
    RAISE EXCEPTION 'Template does not have a linked profile';
  END IF;
  
  -- Build email
  v_email := 'template-' || p_template_id::text || '@virtualmercado.internal';
  
  -- Store the new password in the template record
  UPDATE brand_templates
  SET template_password = v_new_password
  WHERE id = p_template_id;
  
  RETURN v_new_password;
END;
$$;