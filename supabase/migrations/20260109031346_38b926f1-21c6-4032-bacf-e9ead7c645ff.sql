-- Add soft delete columns for independent deletion between panels
ALTER TABLE public.merchant_support_tickets 
ADD COLUMN IF NOT EXISTS deleted_by_merchant BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS deleted_by_admin BOOLEAN NOT NULL DEFAULT false;