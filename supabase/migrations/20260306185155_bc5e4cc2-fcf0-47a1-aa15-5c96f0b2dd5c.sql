
-- Table to log monthly report sends (prevent duplicates)
CREATE TABLE public.brand_report_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES public.brand_templates(id) ON DELETE CASCADE,
  report_month TEXT NOT NULL, -- e.g. '2026-03'
  email_sent_to TEXT NOT NULL,
  clicks_snapshot INTEGER DEFAULT 0,
  accounts_snapshot INTEGER DEFAULT 0,
  conversion_snapshot INTEGER DEFAULT 0,
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(template_id, report_month)
);

ALTER TABLE public.brand_report_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read report logs"
  ON public.brand_report_logs FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role can insert report logs"
  ON public.brand_report_logs FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
