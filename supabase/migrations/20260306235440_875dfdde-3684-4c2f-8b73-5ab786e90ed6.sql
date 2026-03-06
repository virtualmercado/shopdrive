
-- Email Queue table
CREATE TABLE public.email_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  template TEXT,
  to_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  payload JSONB DEFAULT '{}'::jsonb,
  html TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  scheduled_at TIMESTAMPTZ DEFAULT now(),
  sent_at TIMESTAMPTZ,
  store_name TEXT,
  template_id UUID,
  template_name TEXT
);

-- Indexes for worker performance
CREATE INDEX idx_email_queue_status_scheduled ON public.email_queue (status, scheduled_at) WHERE status IN ('pending', 'retry');
CREATE INDEX idx_email_queue_tenant ON public.email_queue (tenant_id);

-- Enable RLS
ALTER TABLE public.email_queue ENABLE ROW LEVEL SECURITY;

-- Admin read access
CREATE POLICY "Admins can manage email queue"
  ON public.email_queue
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Service role full access (for edge functions)
CREATE POLICY "Service role full access to email_queue"
  ON public.email_queue
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Email logs table for audit trail
CREATE TABLE IF NOT EXISTS public.email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  template TEXT,
  destinatario TEXT NOT NULL,
  email_remetente TEXT,
  status TEXT NOT NULL DEFAULT 'sent',
  erro TEXT,
  data_envio TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view email logs"
  ON public.email_logs
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role full access to email_logs"
  ON public.email_logs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
