ALTER TABLE public.master_subscriptions
  ADD COLUMN IF NOT EXISTS source_plan_id text;

ALTER TABLE public.store_clone_logs
  ADD COLUMN IF NOT EXISTS source_plan_id text,
  ADD COLUMN IF NOT EXISTS intended_plan_id text,
  ADD COLUMN IF NOT EXISTS current_entitlement_plan_id text;