-- Drop overly permissive policies on brand_template_categories
DROP POLICY IF EXISTS "Allow authenticated users to manage brand_template_categories" ON public.brand_template_categories;

-- Drop overly permissive policies on brand_template_pages
DROP POLICY IF EXISTS "Allow authenticated users to manage brand_template_pages" ON public.brand_template_pages;

-- Admin-only write access for brand_template_categories
CREATE POLICY "Only admins can manage template categories"
ON public.brand_template_categories FOR ALL
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Keep public read access for brand_template_categories
CREATE POLICY "Anyone can read template categories"
ON public.brand_template_categories FOR SELECT
USING (true);

-- Admin-only write access for brand_template_pages
CREATE POLICY "Only admins can manage template pages"
ON public.brand_template_pages FOR ALL
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Keep public read access for brand_template_pages
CREATE POLICY "Anyone can read template pages"
ON public.brand_template_pages FOR SELECT
USING (true);