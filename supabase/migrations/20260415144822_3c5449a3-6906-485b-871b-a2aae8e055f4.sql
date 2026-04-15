ALTER TABLE public.master_subscriptions ADD COLUMN IF NOT EXISTS payment_method text DEFAULT 'credit_card';

-- Update existing records based on card_brand presence
UPDATE public.master_subscriptions SET payment_method = 'credit_card' WHERE card_brand IS NOT NULL;

-- Update CMS billing alert for processing to be method-agnostic
UPDATE public.cms_billing_alerts 
SET message = 'Seu pagamento está sendo processado. Aguarde a confirmação.',
    title = '⏳ Pagamento em processamento'
WHERE alert_key = 'processing';