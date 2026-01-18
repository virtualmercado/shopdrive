-- =====================================================================
-- ACCOUNT DELETION FLOW - Complete Database Structure
-- =====================================================================

-- 1. Add account_status to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS account_status TEXT NOT NULL DEFAULT 'active' 
  CHECK (account_status IN ('active', 'inactive', 'exclusao_solicitada', 'excluida'));

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS account_status_updated_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS deleted_by UUID;

-- 2. Add category column to merchant_support_tickets if not exists
ALTER TABLE public.merchant_support_tickets 
ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'general';

-- 3. Create legal_archive_accounts table for LGPD retention
CREATE TABLE IF NOT EXISTS public.legal_archive_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  merchant_id UUID NOT NULL,
  store_name TEXT,
  primary_email TEXT,
  cpf_cnpj_hash TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  deleted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  plan_history JSONB DEFAULT '[]'::jsonb,
  billing_history JSONB DEFAULT '[]'::jsonb,
  terms_acceptance_logs JSONB DEFAULT '[]'::jsonb,
  privacy_acceptance_logs JSONB DEFAULT '[]'::jsonb,
  deletion_audit JSONB NOT NULL DEFAULT '{}'::jsonb,
  retention_policy_version TEXT NOT NULL DEFAULT 'LGPD_MIN_v1',
  retention_until TIMESTAMP WITH TIME ZONE NOT NULL,
  export_available BOOLEAN NOT NULL DEFAULT false,
  last_export_at TIMESTAMP WITH TIME ZONE,
  export_file_path TEXT,
  deletion_reason TEXT,
  deletion_details TEXT,
  ticket_id UUID
);

-- Enable RLS on legal_archive_accounts
ALTER TABLE public.legal_archive_accounts ENABLE ROW LEVEL SECURITY;

-- Only admins can access legal archive
CREATE POLICY "Only admins can view legal archive"
  ON public.legal_archive_accounts FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can insert legal archive"
  ON public.legal_archive_accounts FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can update legal archive"
  ON public.legal_archive_accounts FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- 4. Create account_deletion_requests table to track requests
CREATE TABLE IF NOT EXISTS public.account_deletion_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  merchant_id UUID NOT NULL,
  ticket_id UUID,
  reason TEXT NOT NULL,
  details TEXT,
  ip_address TEXT,
  user_agent TEXT,
  status TEXT NOT NULL DEFAULT 'pending' 
    CHECK (status IN ('pending', 'in_review', 'approved', 'rejected', 'completed')),
  requested_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  reviewed_by UUID,
  completed_at TIMESTAMP WITH TIME ZONE,
  completed_by UUID,
  rejection_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on account_deletion_requests
ALTER TABLE public.account_deletion_requests ENABLE ROW LEVEL SECURITY;

-- Merchants can view their own requests
CREATE POLICY "Merchants can view their own deletion requests"
  ON public.account_deletion_requests FOR SELECT
  USING (auth.uid() = merchant_id);

-- Merchants can create their own requests
CREATE POLICY "Merchants can create their own deletion requests"
  ON public.account_deletion_requests FOR INSERT
  WITH CHECK (auth.uid() = merchant_id);

-- Admins can manage all deletion requests
CREATE POLICY "Admins can manage all deletion requests"
  ON public.account_deletion_requests FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- 5. Create data_exports table for tracking exports
CREATE TABLE IF NOT EXISTS public.data_exports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  merchant_id UUID NOT NULL,
  requested_by UUID NOT NULL,
  format TEXT NOT NULL DEFAULT 'csv' CHECK (format IN ('csv', 'json')),
  include_cadastral BOOLEAN NOT NULL DEFAULT true,
  include_financial BOOLEAN NOT NULL DEFAULT true,
  include_consents BOOLEAN NOT NULL DEFAULT true,
  include_audit BOOLEAN NOT NULL DEFAULT true,
  file_path TEXT,
  file_size INTEGER,
  status TEXT NOT NULL DEFAULT 'processing' 
    CHECK (status IN ('processing', 'completed', 'failed', 'expired')),
  expires_at TIMESTAMP WITH TIME ZONE,
  download_count INTEGER NOT NULL DEFAULT 0,
  last_downloaded_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT
);

-- Enable RLS on data_exports
ALTER TABLE public.data_exports ENABLE ROW LEVEL SECURITY;

-- Only admins can manage data exports
CREATE POLICY "Admins can manage data exports"
  ON public.data_exports FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- 6. Update audit_logs to allow inserts from authenticated users
DROP POLICY IF EXISTS "Users can insert audit logs" ON public.audit_logs;
CREATE POLICY "Users can insert audit logs"
  ON public.audit_logs FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- 7. Create function to log audit events
CREATE OR REPLACE FUNCTION public.log_audit_event(
  p_action TEXT,
  p_entity_type TEXT,
  p_entity_id UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb,
  p_ip_address TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, metadata, ip_address)
  VALUES (auth.uid(), p_action, p_entity_type, p_entity_id, p_metadata, p_ip_address)
  RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$;

-- 8. Create index for faster queries on account status
CREATE INDEX IF NOT EXISTS idx_profiles_account_status ON public.profiles(account_status);
CREATE INDEX IF NOT EXISTS idx_deletion_requests_status ON public.account_deletion_requests(status);
CREATE INDEX IF NOT EXISTS idx_deletion_requests_merchant ON public.account_deletion_requests(merchant_id);
CREATE INDEX IF NOT EXISTS idx_legal_archive_retention ON public.legal_archive_accounts(retention_until);

-- 9. Add trigger to update updated_at on account_deletion_requests
CREATE OR REPLACE FUNCTION public.update_account_deletion_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS update_account_deletion_requests_timestamp ON public.account_deletion_requests;
CREATE TRIGGER update_account_deletion_requests_timestamp
  BEFORE UPDATE ON public.account_deletion_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_account_deletion_requests_updated_at();