-- Add Top Bar configuration columns to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS topbar_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS topbar_bg_color TEXT DEFAULT '#000000',
ADD COLUMN IF NOT EXISTS topbar_text_color TEXT DEFAULT '#FFFFFF',
ADD COLUMN IF NOT EXISTS topbar_text TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS topbar_link_type TEXT DEFAULT 'none',
ADD COLUMN IF NOT EXISTS topbar_link_target TEXT DEFAULT NULL;

-- Add check constraint for topbar_link_type enum values
ALTER TABLE public.profiles
ADD CONSTRAINT profiles_topbar_link_type_check 
CHECK (topbar_link_type IN ('none', 'content_page', 'category', 'sale', 'section', 'external'));