-- Allow anyone to view public store profiles (for accessing stores via slug)
CREATE POLICY "Anyone can view public store profiles"
ON public.profiles
FOR SELECT
USING (store_slug IS NOT NULL);