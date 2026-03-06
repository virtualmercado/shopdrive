
-- Add record_comment column to existing table
ALTER TABLE public.tenant_email_dns_records 
ADD COLUMN IF NOT EXISTS record_comment TEXT DEFAULT '';
