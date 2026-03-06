
CREATE TABLE public.platform_email_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL DEFAULT 'resend',
  sender_name text NOT NULL DEFAULT 'ShopDrive',
  sender_email text NOT NULL DEFAULT 'noreply@shopdrive.com.br',
  reply_to text NOT NULL DEFAULT 'suporte@shopdrive.com.br',
  smtp_host text,
  smtp_port integer DEFAULT 587,
  smtp_user text,
  smtp_password text,
  smtp_security text DEFAULT 'tls',
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_email_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage email settings"
  ON public.platform_email_settings
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_platform_email_settings_updated_at
  BEFORE UPDATE ON public.platform_email_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

INSERT INTO public.platform_email_settings (provider, sender_name, sender_email, reply_to)
VALUES ('resend', 'ShopDrive', 'noreply@shopdrive.com.br', 'suporte@shopdrive.com.br');
