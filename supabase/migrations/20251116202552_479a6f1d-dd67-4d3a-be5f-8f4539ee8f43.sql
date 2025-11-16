-- Create subscription plans table
CREATE TABLE public.subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  interval TEXT NOT NULL CHECK (interval IN ('monthly', 'yearly')),
  product_limit INTEGER NOT NULL DEFAULT 0,
  order_limit INTEGER NOT NULL DEFAULT 0,
  features JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create subscriptions table
CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  plan_id UUID REFERENCES public.subscription_plans(id) ON DELETE SET NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'canceled', 'past_due', 'trialing', 'paused')) DEFAULT 'trialing',
  current_period_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  current_period_end TIMESTAMPTZ NOT NULL,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create platform stats table for caching
CREATE TABLE public.platform_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  total_users INTEGER NOT NULL DEFAULT 0,
  active_subscriptions INTEGER NOT NULL DEFAULT 0,
  total_revenue DECIMAL(12,2) NOT NULL DEFAULT 0,
  monthly_revenue DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_stores INTEGER NOT NULL DEFAULT 0,
  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(snapshot_date)
);

-- Enable RLS
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_stats ENABLE ROW LEVEL SECURITY;

-- RLS Policies for subscription_plans
CREATE POLICY "Anyone can view active plans"
  ON public.subscription_plans
  FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can manage all plans"
  ON public.subscription_plans
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for subscriptions
CREATE POLICY "Users can view their own subscription"
  ON public.subscriptions
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all subscriptions"
  ON public.subscriptions
  FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage all subscriptions"
  ON public.subscriptions
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for platform_stats
CREATE POLICY "Admins can view platform stats"
  ON public.platform_stats
  FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage platform stats"
  ON public.platform_stats
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Trigger for subscriptions updated_at
CREATE TRIGGER set_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Trigger for subscription_plans updated_at
CREATE TRIGGER set_subscription_plans_updated_at
  BEFORE UPDATE ON public.subscription_plans
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Insert default plans
INSERT INTO public.subscription_plans (name, description, price, interval, product_limit, order_limit, features) VALUES
  ('Free', 'Plano gratuito para começar', 0, 'monthly', 10, 50, '["Até 10 produtos", "Até 50 pedidos/mês", "Suporte por email"]'::jsonb),
  ('Pro', 'Plano profissional', 49.90, 'monthly', 100, 500, '["Até 100 produtos", "Até 500 pedidos/mês", "Suporte prioritário", "Personalização avançada"]'::jsonb),
  ('Premium', 'Plano premium sem limites', 149.90, 'monthly', -1, -1, '["Produtos ilimitados", "Pedidos ilimitados", "Suporte 24/7", "Personalização total", "Relatórios avançados"]'::jsonb);