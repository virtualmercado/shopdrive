
-- 1. Add role column to admin_user_permissions
ALTER TABLE public.admin_user_permissions 
ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'admin';

-- 2. Create email_templates table
CREATE TABLE public.email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  event_trigger text NOT NULL,
  subject text NOT NULL DEFAULT '',
  pre_header text DEFAULT '',
  html_content text DEFAULT '',
  text_content text DEFAULT '',
  variables jsonb DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage email_templates" ON public.email_templates
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER handle_email_templates_updated_at
  BEFORE UPDATE ON public.email_templates
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 3. Create email_send_logs table
CREATE TABLE public.email_send_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid REFERENCES public.email_templates(id) ON DELETE SET NULL,
  template_name text,
  recipient_email text NOT NULL,
  subject text,
  status text NOT NULL DEFAULT 'sent',
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.email_send_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage email_send_logs" ON public.email_send_logs
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 4. Seed the 15 initial email templates
INSERT INTO public.email_templates (name, event_trigger, subject, variables) VALUES
  ('Boas-vindas / Novo Usuário', 'user_welcome', 'Bem-vindo à ShopDrive!', '["user_name","user_email","platform_name","login_link"]'),
  ('Conta Criada', 'account_created', 'Sua conta foi criada com sucesso', '["user_name","user_email","platform_name","login_link"]'),
  ('Convite de Acesso', 'access_invite', 'Você foi convidado para a ShopDrive', '["user_name","user_email","platform_name","login_link","temporary_password"]'),
  ('Recuperação de Senha', 'password_recovery', 'Recuperação de senha', '["user_name","reset_link","platform_name"]'),
  ('Redefinição de Senha Confirmada', 'password_reset_confirmed', 'Sua senha foi redefinida', '["user_name","platform_name","login_link"]'),
  ('Conta Ativada', 'account_activated', 'Sua conta foi ativada', '["user_name","platform_name","login_link"]'),
  ('Conta Desativada', 'account_deactivated', 'Sua conta foi desativada', '["user_name","platform_name","support_email"]'),
  ('Alteração de E-mail', 'email_changed', 'Confirmação de alteração de e-mail', '["user_name","user_email","platform_name"]'),
  ('Notificação de Login / Segurança', 'security_login', 'Novo login detectado na sua conta', '["user_name","platform_name","login_link"]'),
  ('Ticket de Suporte Criado', 'ticket_created', 'Ticket de suporte #{{ticket_number}} criado', '["user_name","ticket_number","platform_name","support_email"]'),
  ('Ticket Resolvido', 'ticket_resolved', 'Ticket #{{ticket_number}} foi resolvido', '["user_name","ticket_number","platform_name"]'),
  ('Assinatura Expirando', 'subscription_expiring', 'Sua assinatura está prestes a expirar', '["user_name","plan_name","due_date","platform_name"]'),
  ('Pagamento Confirmado', 'payment_confirmed', 'Pagamento confirmado', '["user_name","amount","plan_name","platform_name"]'),
  ('Pagamento Recusado / Falhou', 'payment_failed', 'Problema com seu pagamento', '["user_name","amount","plan_name","due_date","platform_name"]'),
  ('Assinatura Expirada', 'subscription_expired', 'Sua assinatura expirou', '["user_name","plan_name","platform_name","login_link"]');
