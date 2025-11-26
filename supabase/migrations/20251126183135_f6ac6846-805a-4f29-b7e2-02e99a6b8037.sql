-- Add RLS policy to allow public access to store profiles
CREATE POLICY "Anyone can view public store profiles"
  ON public.profiles
  FOR SELECT
  USING (store_slug IS NOT NULL);