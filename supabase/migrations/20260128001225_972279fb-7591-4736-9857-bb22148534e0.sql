-- Add new columns for 2-image minibanner system
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS minibanner_1_img2_url TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS minibanner_2_img2_url TEXT DEFAULT NULL;

-- Clean up existing default minibanner URLs (remove Unsplash defaults)
UPDATE public.profiles
SET 
  banner_rect_1_url = NULL,
  banner_rect_2_url = NULL
WHERE 
  banner_rect_1_url LIKE '%unsplash.com%' 
  OR banner_rect_2_url LIKE '%unsplash.com%';

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.minibanner_1_img2_url IS 'Second image for MiniBanner 1 (used for hover/touch effect)';
COMMENT ON COLUMN public.profiles.minibanner_2_img2_url IS 'Second image for MiniBanner 2 (used for hover/touch effect)';