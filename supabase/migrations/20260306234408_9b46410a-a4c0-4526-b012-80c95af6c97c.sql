
CREATE TABLE public.tenant_email_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emails_last_hour INTEGER NOT NULL DEFAULT 0,
  emails_last_day INTEGER NOT NULL DEFAULT 0,
  bounce_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
  error_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
  total_sent INTEGER NOT NULL DEFAULT 0,
  total_errors INTEGER NOT NULL DEFAULT 0,
  total_bounces INTEGER NOT NULL DEFAULT 0,
  last_email_sent_at TIMESTAMPTZ DEFAULT NULL,
  last_hour_reset_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_day_reset_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'active',
  blocked_reason TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id)
);

ALTER TABLE public.tenant_email_metrics ENABLE ROW LEVEL SECURITY;

-- Admins can manage all
CREATE POLICY "Admins can manage tenant email metrics"
  ON public.tenant_email_metrics FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Merchants can view own
CREATE POLICY "Merchants can view own email metrics"
  ON public.tenant_email_metrics FOR SELECT
  TO authenticated
  USING (tenant_id = auth.uid());

-- Updated_at trigger
CREATE TRIGGER set_tenant_email_metrics_updated_at
  BEFORE UPDATE ON public.tenant_email_metrics
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();
