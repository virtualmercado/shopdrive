-- =====================================================
-- FASE 1: CHECKOUT DE ASSINATURA - PAINEL MASTER
-- =====================================================

-- Tabela de configuração de gateways do Painel Master (separado dos lojistas)
CREATE TABLE IF NOT EXISTS public.master_payment_gateways (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  gateway_name TEXT NOT NULL UNIQUE, -- 'mercadopago' | 'pagbank'
  display_name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT false,
  is_default BOOLEAN NOT NULL DEFAULT false,
  environment TEXT NOT NULL DEFAULT 'sandbox', -- 'sandbox' | 'production'
  
  -- Mercado Pago
  mercadopago_access_token TEXT,
  mercadopago_public_key TEXT,
  
  -- PagBank
  pagbank_token TEXT,
  pagbank_email TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de assinaturas do Painel Master
CREATE TABLE IF NOT EXISTS public.master_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Plano e ciclo
  plan_id TEXT NOT NULL, -- 'pro' | 'premium'
  billing_cycle TEXT NOT NULL, -- 'monthly' | 'annual'
  
  -- Valores
  monthly_price NUMERIC(10,2) NOT NULL,
  total_amount NUMERIC(10,2) NOT NULL, -- Valor cobrado (mensal ou anual com desconto)
  discount_percent NUMERIC(5,2) DEFAULT 0,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'active' | 'inadimplent' | 'suspended' | 'cancelled' | 'expired'
  
  -- Datas
  started_at TIMESTAMP WITH TIME ZONE,
  current_period_start TIMESTAMP WITH TIME ZONE,
  current_period_end TIMESTAMP WITH TIME ZONE,
  cancelled_at TIMESTAMP WITH TIME ZONE,
  
  -- Gateway e recorrência
  gateway TEXT NOT NULL, -- 'mercadopago' | 'pagbank'
  gateway_subscription_id TEXT, -- ID da assinatura no gateway (para mensais)
  gateway_customer_id TEXT, -- ID do customer no gateway
  card_token TEXT, -- Token do cartão (nunca o número)
  card_last_four TEXT,
  card_brand TEXT,
  
  -- Origem
  origin TEXT DEFAULT 'painel_lojista', -- 'landing' | 'painel_lojista'
  
  -- Consentimento
  recurring_consent_accepted BOOLEAN DEFAULT false,
  recurring_consent_accepted_at TIMESTAMP WITH TIME ZONE,
  recurring_consent_ip TEXT,
  
  -- Retry de pagamento (para mensais inadimplentes)
  retry_count INTEGER DEFAULT 0,
  last_retry_at TIMESTAMP WITH TIME ZONE,
  grace_period_ends_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de pagamentos de assinatura
CREATE TABLE IF NOT EXISTS public.master_subscription_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  subscription_id UUID NOT NULL REFERENCES public.master_subscriptions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Valores
  amount NUMERIC(10,2) NOT NULL,
  gateway TEXT NOT NULL,
  payment_method TEXT NOT NULL, -- 'credit_card' | 'pix' | 'boleto'
  
  -- Status
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'processing' | 'approved' | 'rejected' | 'refunded'
  
  -- Gateway response
  gateway_payment_id TEXT,
  gateway_status TEXT,
  gateway_response JSONB,
  
  -- PIX
  pix_qr_code TEXT,
  pix_qr_code_base64 TEXT,
  pix_expires_at TIMESTAMP WITH TIME ZONE,
  
  -- Boleto
  boleto_url TEXT,
  boleto_barcode TEXT,
  boleto_digitable_line TEXT,
  boleto_expires_at TIMESTAMP WITH TIME ZONE,
  
  -- Datas
  paid_at TIMESTAMP WITH TIME ZONE,
  refunded_at TIMESTAMP WITH TIME ZONE,
  
  -- Idempotência
  idempotency_key TEXT UNIQUE,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de histórico/logs de transações
CREATE TABLE IF NOT EXISTS public.master_subscription_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  subscription_id UUID REFERENCES public.master_subscriptions(id) ON DELETE SET NULL,
  payment_id UUID REFERENCES public.master_subscription_payments(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  event_type TEXT NOT NULL, -- 'subscription_created' | 'payment_success' | 'payment_failed' | 'retry_scheduled' | 'status_changed' | etc
  event_description TEXT,
  metadata JSONB,
  ip_address TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_master_subscriptions_user_id ON public.master_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_master_subscriptions_status ON public.master_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_master_subscription_payments_subscription_id ON public.master_subscription_payments(subscription_id);
CREATE INDEX IF NOT EXISTS idx_master_subscription_payments_status ON public.master_subscription_payments(status);
CREATE INDEX IF NOT EXISTS idx_master_subscription_logs_subscription_id ON public.master_subscription_logs(subscription_id);

-- Inserir gateways padrão
INSERT INTO public.master_payment_gateways (gateway_name, display_name, is_default, is_active)
VALUES 
  ('mercadopago', 'Mercado Pago', true, false),
  ('pagbank', 'PagBank', false, false)
ON CONFLICT (gateway_name) DO NOTHING;

-- RLS Policies
ALTER TABLE public.master_payment_gateways ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.master_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.master_subscription_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.master_subscription_logs ENABLE ROW LEVEL SECURITY;

-- Gateways - apenas admins podem gerenciar
CREATE POLICY "Admins can manage master gateways"
  ON public.master_payment_gateways
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Assinaturas - usuários veem apenas suas próprias, admins veem todas
CREATE POLICY "Users can view their own subscriptions"
  ON public.master_subscriptions
  FOR SELECT
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can create their own subscriptions"
  ON public.master_subscriptions
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users and admins can update subscriptions"
  ON public.master_subscriptions
  FOR UPDATE
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- Pagamentos - mesma lógica
CREATE POLICY "Users can view their own payments"
  ON public.master_subscription_payments
  FOR SELECT
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can create their own payments"
  ON public.master_subscription_payments
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users and admins can update payments"
  ON public.master_subscription_payments
  FOR UPDATE
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- Logs - apenas admins podem ver todos, usuários veem seus próprios
CREATE POLICY "Users can view their own logs"
  ON public.master_subscription_logs
  FOR SELECT
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "System can insert logs"
  ON public.master_subscription_logs
  FOR INSERT
  WITH CHECK (true);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_master_subscription_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_master_payment_gateways_updated_at
  BEFORE UPDATE ON public.master_payment_gateways
  FOR EACH ROW EXECUTE FUNCTION update_master_subscription_updated_at();

CREATE TRIGGER update_master_subscriptions_updated_at
  BEFORE UPDATE ON public.master_subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_master_subscription_updated_at();

CREATE TRIGGER update_master_subscription_payments_updated_at
  BEFORE UPDATE ON public.master_subscription_payments
  FOR EACH ROW EXECUTE FUNCTION update_master_subscription_updated_at();