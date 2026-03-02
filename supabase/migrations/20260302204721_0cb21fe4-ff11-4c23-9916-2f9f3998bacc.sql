
-- Add missing columns to invoices table for real payment tracking
ALTER TABLE public.invoices 
  ADD COLUMN IF NOT EXISTS payment_method text,
  ADD COLUMN IF NOT EXISTS mp_payment_id text,
  ADD COLUMN IF NOT EXISTS plan text;
