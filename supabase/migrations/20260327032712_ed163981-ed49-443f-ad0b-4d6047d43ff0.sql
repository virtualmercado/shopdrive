
-- Allow public read access to melhor_envio_settings for checkout shipping calculation
CREATE POLICY "Anyone can view active melhor envio settings for checkout"
ON public.melhor_envio_settings FOR SELECT TO anon, authenticated
USING (is_active = true);

-- Grant SELECT on both table and public view to anon and authenticated
GRANT SELECT ON public.melhor_envio_settings TO anon, authenticated;
GRANT SELECT ON public.melhor_envio_settings_public TO anon, authenticated;
