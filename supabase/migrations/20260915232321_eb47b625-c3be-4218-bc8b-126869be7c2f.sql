UPDATE public.brand_templates AS t
SET main_banner_content = p.main_banner_content
FROM public.profiles AS p
WHERE t.source_profile_id = p.id
  AND t.main_banner_content IS NULL
  AND p.main_banner_content IS NOT NULL;