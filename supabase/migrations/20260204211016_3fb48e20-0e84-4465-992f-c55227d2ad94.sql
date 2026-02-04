-- Table for global platform settings
CREATE TABLE public.platform_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key TEXT NOT NULL UNIQUE,
  setting_value TEXT,
  setting_type TEXT DEFAULT 'text',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

-- Only admins can read/write platform settings
CREATE POLICY "Admins can manage platform settings"
ON public.platform_settings
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Table for support channels (WhatsApp, etc.)
CREATE TABLE public.support_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_type TEXT NOT NULL DEFAULT 'whatsapp',
  channel_name TEXT NOT NULL,
  phone_number TEXT,
  operating_hours TEXT,
  default_message TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.support_channels ENABLE ROW LEVEL SECURITY;

-- Admins can manage support channels
CREATE POLICY "Admins can manage support channels"
ON public.support_channels
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Authenticated users can read active support channels
CREATE POLICY "Users can read active support channels"
ON public.support_channels
FOR SELECT
TO authenticated
USING (is_active = true);

-- Table for admin user permissions
CREATE TABLE public.admin_user_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  permissions JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.admin_user_permissions ENABLE ROW LEVEL SECURITY;

-- Only admins can manage admin user permissions
CREATE POLICY "Admins can manage admin permissions"
ON public.admin_user_permissions
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Triggers for updated_at
CREATE TRIGGER update_platform_settings_updated_at
  BEFORE UPDATE ON public.platform_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_support_channels_updated_at
  BEFORE UPDATE ON public.support_channels
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_admin_user_permissions_updated_at
  BEFORE UPDATE ON public.admin_user_permissions
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Insert default platform settings
INSERT INTO public.platform_settings (setting_key, setting_value, setting_type) VALUES
  ('platform_name', 'VirtualMercado', 'text'),
  ('company_name', '', 'text'),
  ('cnpj', '', 'text'),
  ('state_registration', '', 'text'),
  ('full_address', '', 'text'),
  ('zip_code', '', 'text'),
  ('city', '', 'text'),
  ('state', '', 'text'),
  ('institutional_email', '', 'email'),
  ('institutional_phone', '', 'phone');

-- Insert default WhatsApp support channel
INSERT INTO public.support_channels (channel_type, channel_name, phone_number, operating_hours, default_message, is_active) VALUES
  ('whatsapp', 'Suporte Principal', '', 'Segunda a Sexta, 9h às 18h', 'Olá! Preciso de ajuda com minha loja na VirtualMercado. Nome da loja: {{nome_da_loja}}. E-mail: {{email_do_assinante}}.', true);