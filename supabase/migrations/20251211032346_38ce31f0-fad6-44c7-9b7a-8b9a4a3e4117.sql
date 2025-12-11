
-- Table for custom shipping rules
CREATE TABLE public.shipping_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  rule_name TEXT NOT NULL,
  scope_type TEXT NOT NULL CHECK (scope_type IN ('neighborhood', 'city', 'zipcode')),
  scope_value TEXT NOT NULL,
  shipping_fee NUMERIC NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table for Correios integration settings
CREATE TABLE public.correios_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  origin_zipcode TEXT NOT NULL,
  contract_code TEXT,
  contract_password TEXT,
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table for Melhor Envio integration settings
CREATE TABLE public.melhor_envio_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  api_key TEXT NOT NULL,
  user_id_melhor_envio TEXT,
  environment TEXT NOT NULL DEFAULT 'sandbox' CHECK (environment IN ('sandbox', 'production')),
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add shipping settings to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS free_shipping_minimum NUMERIC DEFAULT NULL,
ADD COLUMN IF NOT EXISTS delivery_option TEXT DEFAULT 'delivery_only' CHECK (delivery_option IN ('delivery_only', 'delivery_and_pickup', 'pickup_only')),
ADD COLUMN IF NOT EXISTS pickup_address TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS use_account_address_for_pickup BOOLEAN DEFAULT true;

-- Enable RLS
ALTER TABLE public.shipping_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.correios_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.melhor_envio_settings ENABLE ROW LEVEL SECURITY;

-- RLS policies for shipping_rules
CREATE POLICY "Users can view their own shipping rules" ON public.shipping_rules
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own shipping rules" ON public.shipping_rules
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own shipping rules" ON public.shipping_rules
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own shipping rules" ON public.shipping_rules
  FOR DELETE USING (auth.uid() = user_id);

-- Public read for checkout
CREATE POLICY "Anyone can view active shipping rules for public stores" ON public.shipping_rules
  FOR SELECT USING (is_public_store(user_id) AND is_active = true);

-- RLS policies for correios_settings
CREATE POLICY "Users can view their own correios settings" ON public.correios_settings
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own correios settings" ON public.correios_settings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own correios settings" ON public.correios_settings
  FOR UPDATE USING (auth.uid() = user_id);

-- Public read for checkout
CREATE POLICY "Anyone can view active correios settings for public stores" ON public.correios_settings
  FOR SELECT USING (is_public_store(user_id) AND is_active = true);

-- RLS policies for melhor_envio_settings
CREATE POLICY "Users can view their own melhor envio settings" ON public.melhor_envio_settings
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own melhor envio settings" ON public.melhor_envio_settings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own melhor envio settings" ON public.melhor_envio_settings
  FOR UPDATE USING (auth.uid() = user_id);

-- Public read for checkout
CREATE POLICY "Anyone can view active melhor envio settings for public stores" ON public.melhor_envio_settings
  FOR SELECT USING (is_public_store(user_id) AND is_active = true);

-- Triggers for updated_at
CREATE TRIGGER update_shipping_rules_updated_at
  BEFORE UPDATE ON public.shipping_rules
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_correios_settings_updated_at
  BEFORE UPDATE ON public.correios_settings
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_melhor_envio_settings_updated_at
  BEFORE UPDATE ON public.melhor_envio_settings
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
