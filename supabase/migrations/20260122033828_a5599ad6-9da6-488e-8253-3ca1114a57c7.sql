-- Add CMS table for billing alerts content
CREATE TABLE IF NOT EXISTS public.cms_billing_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  alert_key TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  cta_text TEXT NOT NULL,
  cta_url TEXT NOT NULL DEFAULT '/lojista/financeiro',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.cms_billing_alerts ENABLE ROW LEVEL SECURITY;

-- Allow public read for all users (needed for dashboard display)
CREATE POLICY "Anyone can read billing alerts"
ON public.cms_billing_alerts
FOR SELECT
USING (true);

-- Only admins can modify
CREATE POLICY "Only admins can modify billing alerts"
ON public.cms_billing_alerts
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'
  )
);

-- Insert default billing alert content
INSERT INTO public.cms_billing_alerts (alert_key, title, message, cta_text, cta_url) VALUES
('past_due', '⚠️ Pagamento da sua assinatura está pendente', 'Identificamos uma falha no pagamento do seu plano. Para evitar a redução de recursos, regularize o pagamento.', 'Regularizar pagamento', '/lojista/financeiro'),
('in_grace_period', '⚠️ Pagamento pendente — risco de downgrade', 'Você tem {diasRestantes} dia(s) para regularizar. Após esse prazo, sua conta será automaticamente alterada para o plano Grátis, com recursos reduzidos.', 'Regularizar pagamento', '/lojista/financeiro'),
('processing', '⏳ Pagamento em confirmação', 'Recebemos a atualização do seu pagamento. A confirmação pode levar até 48h. Se você já pagou, desconsidere esta mensagem.', 'Ver detalhes do pagamento', '/lojista/financeiro'),
('downgraded', 'ℹ️ Sua conta foi movida para o plano Grátis', 'Como o pagamento não foi confirmado dentro do prazo, sua assinatura foi alterada para o plano Grátis. Para recuperar os recursos do seu plano anterior, regularize o pagamento.', 'Reativar plano', '/lojista/financeiro')
ON CONFLICT (alert_key) DO NOTHING;

-- Create billing alert settings table
CREATE TABLE IF NOT EXISTS public.billing_alert_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  setting_key TEXT NOT NULL UNIQUE,
  setting_value TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.billing_alert_settings ENABLE ROW LEVEL SECURITY;

-- Allow public read for settings
CREATE POLICY "Anyone can read billing settings"
ON public.billing_alert_settings
FOR SELECT
USING (true);

-- Only admins can modify settings
CREATE POLICY "Only admins can modify billing settings"
ON public.billing_alert_settings
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'
  )
);

-- Insert default settings
INSERT INTO public.billing_alert_settings (setting_key, setting_value, description) VALUES
('enabled', 'true', 'Ativar/desativar banner global de cobrança'),
('grace_period_days_monthly', '7', 'Dias de tolerância para planos mensais'),
('grace_period_days_annual', '14', 'Dias de tolerância para planos anuais'),
('max_compensation_hours', '48', 'Tempo máximo de compensação em horas')
ON CONFLICT (setting_key) DO NOTHING;

-- Add downgrade tracking fields to master_subscriptions if not exists
ALTER TABLE public.master_subscriptions 
ADD COLUMN IF NOT EXISTS previous_plan_id TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS downgraded_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
ADD COLUMN IF NOT EXISTS downgrade_reason TEXT DEFAULT NULL;

-- Add comment for new fields
COMMENT ON COLUMN public.master_subscriptions.previous_plan_id IS 'Stores the plan ID before downgrade for potential recovery';
COMMENT ON COLUMN public.master_subscriptions.downgraded_at IS 'Timestamp when the account was downgraded';
COMMENT ON COLUMN public.master_subscriptions.downgrade_reason IS 'Reason for downgrade (e.g., nonpayment)';