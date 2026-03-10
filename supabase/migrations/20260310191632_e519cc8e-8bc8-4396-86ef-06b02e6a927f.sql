
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS content_banner_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS content_banner_title text DEFAULT '',
  ADD COLUMN IF NOT EXISTS content_banner_subtitle text DEFAULT '',
  ADD COLUMN IF NOT EXISTS content_banner_title_color text DEFAULT '#ffffff',
  ADD COLUMN IF NOT EXISTS content_banner_subtitle_color text DEFAULT '#ffffffcc',
  ADD COLUMN IF NOT EXISTS content_banner_url text DEFAULT '',
  ADD COLUMN IF NOT EXISTS content_banner_image_url text DEFAULT '';
