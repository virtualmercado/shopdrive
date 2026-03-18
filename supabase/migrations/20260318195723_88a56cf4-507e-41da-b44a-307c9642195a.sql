
-- Fix existing template source profiles that have no store_slug
UPDATE profiles 
SET store_slug = LOWER(REPLACE(REPLACE(TRIM(store_name), ' ', '-'), '--', '-'))
WHERE id IN (
  SELECT source_profile_id FROM brand_templates WHERE source_profile_id IS NOT NULL
)
AND (store_slug IS NULL OR store_slug = '');

-- Also ensure is_template_profile is true for these
UPDATE profiles 
SET is_template_profile = true
WHERE id IN (
  SELECT source_profile_id FROM brand_templates WHERE source_profile_id IS NOT NULL
)
AND (is_template_profile IS NULL OR is_template_profile = false);
