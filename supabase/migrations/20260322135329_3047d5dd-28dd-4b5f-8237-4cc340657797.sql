-- Add template application tracking columns to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS template_applied boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS template_applied_at timestamptz,
  ADD COLUMN IF NOT EXISTS template_apply_status text DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS template_apply_error text;

-- Update existing profiles that already have source_template_id and products (already applied)
UPDATE public.profiles p
SET 
  template_applied = true,
  template_applied_at = p.updated_at,
  template_apply_status = 'applied'
WHERE p.source_template_id IS NOT NULL
  AND EXISTS (SELECT 1 FROM public.products pr WHERE pr.user_id = p.id LIMIT 1);

-- Mark profiles with source_template_id but no products as pending
UPDATE public.profiles p
SET template_apply_status = 'pending'
WHERE p.source_template_id IS NOT NULL
  AND p.template_applied = false
  AND NOT EXISTS (SELECT 1 FROM public.products pr WHERE pr.user_id = p.id LIMIT 1);