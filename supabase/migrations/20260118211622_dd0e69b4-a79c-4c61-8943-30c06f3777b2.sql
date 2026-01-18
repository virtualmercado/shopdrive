-- Add no_charge field to subscriptions table to track admin-granted free subscriptions
ALTER TABLE public.subscriptions 
ADD COLUMN IF NOT EXISTS no_charge BOOLEAN DEFAULT false;

-- Add comment explaining the field
COMMENT ON COLUMN public.subscriptions.no_charge IS 'When true, the subscription is active but billing is bypassed (admin-granted)';

-- Also add to master_subscriptions for platform-level subscriptions
ALTER TABLE public.master_subscriptions 
ADD COLUMN IF NOT EXISTS no_charge BOOLEAN DEFAULT false;

COMMENT ON COLUMN public.master_subscriptions.no_charge IS 'When true, the subscription is active but billing is bypassed (admin-granted)';