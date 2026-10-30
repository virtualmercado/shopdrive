DROP POLICY IF EXISTS "Anyone can read billing alerts" ON public.cms_billing_alerts;
CREATE POLICY "Signed-in users read active billing alerts" ON public.cms_billing_alerts FOR SELECT TO authenticated
USING (is_active = true OR public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Anyone can read billing settings" ON public.billing_alert_settings;
CREATE POLICY "Signed-in users read billing settings" ON public.billing_alert_settings FOR SELECT TO authenticated
USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Allow read access to brand_template_categories" ON public.brand_template_categories;
DROP POLICY IF EXISTS "Anyone can read template categories" ON public.brand_template_categories;
CREATE POLICY "Read active template categories" ON public.brand_template_categories FOR SELECT
USING (is_active = true OR public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Allow read access to brand_template_pages" ON public.brand_template_pages;
DROP POLICY IF EXISTS "Anyone can read template pages" ON public.brand_template_pages;
CREATE POLICY "Read active template pages" ON public.brand_template_pages FOR SELECT
USING (is_active = true OR public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Help categories are publicly readable" ON public.help_categories;
CREATE POLICY "Read active help categories" ON public.help_categories FOR SELECT
USING (is_active = true OR public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Help articles are publicly readable" ON public.help_articles;
CREATE POLICY "Read active help articles" ON public.help_articles FOR SELECT
USING (is_active = true OR public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Authenticated read onboarding flags" ON public.onboarding_feature_flags;
CREATE POLICY "Signed-in users read onboarding flags" ON public.onboarding_feature_flags FOR SELECT TO authenticated
USING (auth.uid() IS NOT NULL);

-- Public buckets serve files via public URLs without SELECT policies; restrict listing/metadata to owners and admins.
DROP POLICY IF EXISTS "Allow public read access on media bucket" ON storage.objects;
DROP POLICY IF EXISTS "Users can view product images" ON storage.objects;
DROP POLICY IF EXISTS "Public can view brand logos" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view media library files" ON storage.objects;
DROP POLICY IF EXISTS "Public can view category icons" ON storage.objects;
CREATE POLICY "Owners and admins read public bucket objects" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id IN ('media','product-images','media-library')
  AND (owner_id = (select auth.uid()::text) OR public.has_role(auth.uid(), 'admin'::app_role))
);