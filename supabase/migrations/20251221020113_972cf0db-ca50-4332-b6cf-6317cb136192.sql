-- Add pickup hours fields to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS pickup_hours_weekday_start TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS pickup_hours_weekday_end TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS pickup_hours_saturday_start TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS pickup_hours_saturday_end TEXT DEFAULT NULL;