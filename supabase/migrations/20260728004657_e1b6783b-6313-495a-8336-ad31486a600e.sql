
ALTER TABLE public.store_clone_logs
  ADD COLUMN IF NOT EXISTS reset_link text,
  ADD COLUMN IF NOT EXISTS temporary_password text,
  ADD COLUMN IF NOT EXISTS pending_plan_id text,
  ADD COLUMN IF NOT EXISTS subscription_status text,
  ADD COLUMN IF NOT EXISTS products_deactivated_by_plan integer DEFAULT 0;
