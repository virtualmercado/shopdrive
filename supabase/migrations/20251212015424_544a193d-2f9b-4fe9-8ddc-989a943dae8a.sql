-- Add maintenance mode column to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_maintenance_mode boolean DEFAULT false;