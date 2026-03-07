
ALTER TABLE public.email_logs
  ADD COLUMN IF NOT EXISTS bcc_email text,
  ADD COLUMN IF NOT EXISTS subject text,
  ADD COLUMN IF NOT EXISTS smtp_provider text,
  ADD COLUMN IF NOT EXISTS sent_at timestamptz;
