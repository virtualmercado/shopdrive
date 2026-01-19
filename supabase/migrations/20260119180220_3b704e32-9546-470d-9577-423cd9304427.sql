-- 1. Update existing 'inadimplent' status to 'past_due' in master_subscriptions
UPDATE public.master_subscriptions 
SET status = 'past_due' 
WHERE status = 'inadimplent';

-- 2. Add new columns for enhanced retry tracking
ALTER TABLE public.master_subscriptions
ADD COLUMN IF NOT EXISTS decline_type TEXT DEFAULT NULL, -- 'hard' or 'soft'
ADD COLUMN IF NOT EXISTS last_decline_code TEXT DEFAULT NULL, -- e.g., 'cc_rejected_insufficient_amount'
ADD COLUMN IF NOT EXISTS last_decline_message TEXT DEFAULT NULL, -- user-friendly message
ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
ADD COLUMN IF NOT EXISTS requires_card_update BOOLEAN DEFAULT false; -- true for hard decline

-- 3. Add comments for documentation
COMMENT ON COLUMN public.master_subscriptions.decline_type IS 'Type of decline: hard (requires manual intervention) or soft (eligible for retry)';
COMMENT ON COLUMN public.master_subscriptions.last_decline_code IS 'Gateway decline code from last payment attempt';
COMMENT ON COLUMN public.master_subscriptions.last_decline_message IS 'User-friendly decline message';
COMMENT ON COLUMN public.master_subscriptions.next_retry_at IS 'Scheduled time for next automatic retry';
COMMENT ON COLUMN public.master_subscriptions.requires_card_update IS 'If true, user must update card before next charge attempt';

-- 4. Add columns to master_subscription_payments for detailed tracking
ALTER TABLE public.master_subscription_payments
ADD COLUMN IF NOT EXISTS decline_code TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS decline_type TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS user_message TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS attempt_number INTEGER DEFAULT 1;