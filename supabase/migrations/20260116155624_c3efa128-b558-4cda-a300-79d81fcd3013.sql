-- Create master_plans table
CREATE TABLE IF NOT EXISTS public.master_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  monthly_price NUMERIC(10,2) NOT NULL,
  annual_discount_percent INTEGER DEFAULT 30,
  features JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Insert default plans
INSERT INTO public.master_plans (plan_id, display_name, monthly_price, annual_discount_percent, features)
VALUES 
  ('pro', 'PRO', 29.97, 30, '["Até 150 produtos", "Até 300 clientes", "Personalização total", "Cupons ilimitados", "Suporte por e-mail"]'::jsonb),
  ('premium', 'PREMIUM', 49.97, 30, '["Produtos ilimitados", "Clientes ilimitados", "Editor IA", "Domínio próprio", "Suporte dedicado", "Integrações avançadas"]'::jsonb)
ON CONFLICT (plan_id) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  monthly_price = EXCLUDED.monthly_price,
  annual_discount_percent = EXCLUDED.annual_discount_percent,
  features = EXCLUDED.features,
  updated_at = now();

-- Enable RLS
ALTER TABLE public.master_plans ENABLE ROW LEVEL SECURITY;

-- Allow everyone to read active plans
CREATE POLICY "Anyone can view active plans" ON public.master_plans
FOR SELECT USING (is_active = true);

-- Only admins can manage plans
CREATE POLICY "Admins can manage plans" ON public.master_plans
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role = 'admin'
  )
);

-- Create updated_at trigger
CREATE TRIGGER update_master_plans_updated_at
BEFORE UPDATE ON public.master_plans
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();