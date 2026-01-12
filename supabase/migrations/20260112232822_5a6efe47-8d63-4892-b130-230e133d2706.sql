-- Add webhook secret columns to payment_settings table
ALTER TABLE public.payment_settings 
ADD COLUMN IF NOT EXISTS mercadopago_webhook_secret TEXT,
ADD COLUMN IF NOT EXISTS pagbank_webhook_secret TEXT;