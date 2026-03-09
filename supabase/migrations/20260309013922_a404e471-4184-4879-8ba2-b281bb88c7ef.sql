-- Add new gateway fields to payment_settings table
ALTER TABLE public.payment_settings 
ADD COLUMN stone_ton_enabled BOOLEAN DEFAULT false,
ADD COLUMN stone_ton_public_key TEXT NULL,
ADD COLUMN stone_ton_secret_key TEXT NULL,
ADD COLUMN stone_ton_merchant_id TEXT NULL,
ADD COLUMN infinitepay_enabled BOOLEAN DEFAULT false,
ADD COLUMN infinitepay_client_id TEXT NULL,
ADD COLUMN infinitepay_client_secret TEXT NULL,
ADD COLUMN infinitepay_webhook_secret TEXT NULL;