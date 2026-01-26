-- Add header_logo_position column to profiles table
-- Values: 'left' (default), 'center', 'right'
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS header_logo_position TEXT DEFAULT 'left';

-- Add check constraint to validate enum values
ALTER TABLE public.profiles
ADD CONSTRAINT profiles_header_logo_position_check 
CHECK (header_logo_position IN ('left', 'center', 'right'));

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.header_logo_position IS 'Position of logo in store header: left, center, or right';