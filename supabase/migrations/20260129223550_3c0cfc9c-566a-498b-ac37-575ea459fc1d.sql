-- Add YouTube video fields to profiles table for home video feature
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS home_video_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS home_video_provider text DEFAULT 'youtube',
ADD COLUMN IF NOT EXISTS home_video_id text,
ADD COLUMN IF NOT EXISTS home_video_url_original text,
ADD COLUMN IF NOT EXISTS home_video_title text,
ADD COLUMN IF NOT EXISTS home_video_description text;