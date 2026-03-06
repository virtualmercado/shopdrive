
-- Table to track referrals between stores
CREATE TABLE public.store_referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inviter_store_id UUID NOT NULL,
  new_store_id UUID NOT NULL,
  template_id UUID REFERENCES public.brand_templates(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(new_store_id) -- each store can only be referred once
);

-- Index for querying referrals by inviter
CREATE INDEX idx_store_referrals_inviter ON public.store_referrals (inviter_store_id);
CREATE INDEX idx_store_referrals_template ON public.store_referrals (template_id);

-- Enable RLS
ALTER TABLE public.store_referrals ENABLE ROW LEVEL SECURITY;

-- Merchants can read their own referrals (as inviter)
CREATE POLICY "Users can read own referrals"
  ON public.store_referrals FOR SELECT
  TO authenticated
  USING (inviter_store_id = auth.uid());

-- Allow inserts during registration (from anon or authenticated)
CREATE POLICY "Allow referral inserts"
  ON public.store_referrals FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Admins can read all referrals
CREATE POLICY "Admins can read all referrals"
  ON public.store_referrals FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Function to validate and create a referral
CREATE OR REPLACE FUNCTION public.create_store_referral(
  p_inviter_store_id UUID,
  p_new_store_id UUID,
  p_template_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Validate: can't invite self
  IF p_inviter_store_id = p_new_store_id THEN
    RETURN false;
  END IF;

  -- Validate: inviter store must exist
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_inviter_store_id) THEN
    RETURN false;
  END IF;

  -- Validate: new store not already referred
  IF EXISTS (SELECT 1 FROM store_referrals WHERE new_store_id = p_new_store_id) THEN
    RETURN false;
  END IF;

  -- Validate: prevent reverse loop (new store can't have invited the inviter)
  IF EXISTS (SELECT 1 FROM store_referrals WHERE inviter_store_id = p_new_store_id AND new_store_id = p_inviter_store_id) THEN
    RETURN false;
  END IF;

  -- Validate: limit chain depth to 5 levels
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
$$;

-- Function to get referral network stats for a store
CREATE OR REPLACE FUNCTION public.get_referral_stats(p_store_id UUID)
RETURNS TABLE(total_referrals BIGINT, active_referrals BIGINT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    COUNT(*)::BIGINT as total_referrals,
    COUNT(*) FILTER (WHERE EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = sr.new_store_id AND p.store_slug IS NOT NULL
    ))::BIGINT as active_referrals
  FROM store_referrals sr
  WHERE sr.inviter_store_id = p_store_id;
$$;
