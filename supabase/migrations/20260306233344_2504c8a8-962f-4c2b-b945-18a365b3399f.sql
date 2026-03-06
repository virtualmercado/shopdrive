
-- Tenant email settings per store
CREATE TABLE public.tenant_email_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_name TEXT NOT NULL DEFAULT '',
  sender_email TEXT NOT NULL DEFAULT '',
  reply_to TEXT DEFAULT '',
  email_domain TEXT DEFAULT '',
  domain_status TEXT NOT NULL DEFAULT 'not_verified',
  spf_record TEXT DEFAULT '',
  dkim_record TEXT DEFAULT '',
  dmarc_record TEXT DEFAULT '',
  spf_verified BOOLEAN DEFAULT false,
  dkim_verified BOOLEAN DEFAULT false,
  dmarc_verified BOOLEAN DEFAULT false,
  cloudflare_zone_id TEXT DEFAULT '',
  last_verification_at TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id)
);

-- DNS records tracking for Cloudflare cleanup
CREATE TABLE public.tenant_email_dns_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  record_id_cloudflare TEXT NOT NULL,
  record_type TEXT NOT NULL,
  record_name TEXT NOT NULL,
  record_content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.tenant_email_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_email_dns_records ENABLE ROW LEVEL SECURITY;

-- RLS: merchants can read/write their own settings
CREATE POLICY "Merchants can view own email settings"
  ON public.tenant_email_settings FOR SELECT
  TO authenticated
  USING (tenant_id = auth.uid());

CREATE POLICY "Merchants can insert own email settings"
  ON public.tenant_email_settings FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id = auth.uid());

CREATE POLICY "Merchants can update own email settings"
  ON public.tenant_email_settings FOR UPDATE
  TO authenticated
  USING (tenant_id = auth.uid());

-- Admins can view all
CREATE POLICY "Admins can view all tenant email settings"
  ON public.tenant_email_settings FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update all tenant email settings"
  ON public.tenant_email_settings FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- DNS records: merchants see own
CREATE POLICY "Merchants can view own dns records"
  ON public.tenant_email_dns_records FOR SELECT
  TO authenticated
  USING (tenant_id = auth.uid());

CREATE POLICY "Merchants can insert own dns records"
  ON public.tenant_email_dns_records FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id = auth.uid());

CREATE POLICY "Merchants can delete own dns records"
  ON public.tenant_email_dns_records FOR DELETE
  TO authenticated
  USING (tenant_id = auth.uid());

-- Admins can manage all dns records
CREATE POLICY "Admins can manage all dns records"
  ON public.tenant_email_dns_records FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Updated_at trigger
CREATE TRIGGER set_tenant_email_settings_updated_at
  BEFORE UPDATE ON public.tenant_email_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();
