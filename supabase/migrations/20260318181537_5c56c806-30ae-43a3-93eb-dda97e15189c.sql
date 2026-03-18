
-- 1a. Add allow_tenant_custom_smtp to platform_email_settings
ALTER TABLE public.platform_email_settings 
ADD COLUMN IF NOT EXISTS allow_tenant_custom_smtp boolean NOT NULL DEFAULT true;

-- 1b. Add SMTP columns to tenant_email_settings
ALTER TABLE public.tenant_email_settings
ADD COLUMN IF NOT EXISTS smtp_mode text NOT NULL DEFAULT 'platform',
ADD COLUMN IF NOT EXISTS smtp_host text,
ADD COLUMN IF NOT EXISTS smtp_port integer DEFAULT 587,
ADD COLUMN IF NOT EXISTS smtp_user text,
ADD COLUMN IF NOT EXISTS smtp_password text,
ADD COLUMN IF NOT EXISTS smtp_security text DEFAULT 'tls',
ADD COLUMN IF NOT EXISTS is_smtp_validated boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS last_tested_at timestamptz,
ADD COLUMN IF NOT EXISTS last_test_status text,
ADD COLUMN IF NOT EXISTS last_test_error text;

-- 1c. Create tenant_email_templates table
CREATE TABLE IF NOT EXISTS public.tenant_email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_key text NOT NULL,
  subject text NOT NULL DEFAULT '',
  html_body text NOT NULL DEFAULT '',
  text_body text NOT NULL DEFAULT '',
  is_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, event_key)
);

ALTER TABLE public.tenant_email_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenants can view own email templates"
ON public.tenant_email_templates FOR SELECT
TO authenticated
USING (tenant_id = auth.uid());

CREATE POLICY "Tenants can insert own email templates"
ON public.tenant_email_templates FOR INSERT
TO authenticated
WITH CHECK (tenant_id = auth.uid());

CREATE POLICY "Tenants can update own email templates"
ON public.tenant_email_templates FOR UPDATE
TO authenticated
USING (tenant_id = auth.uid())
WITH CHECK (tenant_id = auth.uid());

CREATE POLICY "Tenants can delete own email templates"
ON public.tenant_email_templates FOR DELETE
TO authenticated
USING (tenant_id = auth.uid());

-- Trigger for updated_at
CREATE TRIGGER set_tenant_email_templates_updated_at
BEFORE UPDATE ON public.tenant_email_templates
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 1d. Add provider_source to email_logs
ALTER TABLE public.email_logs
ADD COLUMN IF NOT EXISTS provider_source text DEFAULT 'platform';
