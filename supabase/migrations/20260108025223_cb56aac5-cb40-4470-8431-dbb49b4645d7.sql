-- Create merchant_support_tickets table for merchant support requests
CREATE TABLE public.merchant_support_tickets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  merchant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  response TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'answered', 'read')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  answered_at TIMESTAMP WITH TIME ZONE,
  read_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create faq_items table for Academia VM FAQ content managed by admin
CREATE TABLE public.faq_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on both tables
ALTER TABLE public.merchant_support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.faq_items ENABLE ROW LEVEL SECURITY;

-- RLS policies for merchant_support_tickets
-- Merchants can only view their own tickets
CREATE POLICY "Merchants can view own tickets"
ON public.merchant_support_tickets
FOR SELECT
USING (auth.uid() = merchant_id);

-- Merchants can create their own tickets
CREATE POLICY "Merchants can create own tickets"
ON public.merchant_support_tickets
FOR INSERT
WITH CHECK (auth.uid() = merchant_id);

-- Merchants can update their own tickets (to mark as read)
CREATE POLICY "Merchants can update own tickets"
ON public.merchant_support_tickets
FOR UPDATE
USING (auth.uid() = merchant_id);

-- Admins can view all tickets
CREATE POLICY "Admins can view all tickets"
ON public.merchant_support_tickets
FOR SELECT
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'suporte'));

-- Admins can update all tickets (to respond)
CREATE POLICY "Admins can update all tickets"
ON public.merchant_support_tickets
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'suporte'));

-- RLS policies for faq_items
-- Everyone can read active FAQ items
CREATE POLICY "Anyone can view active FAQs"
ON public.faq_items
FOR SELECT
USING (is_active = true);

-- Only admins can manage FAQ items
CREATE POLICY "Admins can manage FAQs"
ON public.faq_items
FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Create trigger for updated_at on merchant_support_tickets
CREATE TRIGGER update_merchant_support_tickets_updated_at
BEFORE UPDATE ON public.merchant_support_tickets
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- Create trigger for updated_at on faq_items
CREATE TRIGGER update_faq_items_updated_at
BEFORE UPDATE ON public.faq_items
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- Insert some default FAQ items
INSERT INTO public.faq_items (question, answer, display_order) VALUES
('A VirtualMercado é grátis mesmo?', 'Sim! Você pode ter uma loja totalmente gratuita, e caso queira recursos exclusivos, pode assinar um plano pago.', 1),
('Preciso ter CNPJ para começar?', 'Não! Você pode começar a vender usando apenas seu CPF e, quando seu negócio crescer, pode migrar para um CNPJ facilmente.', 2),
('Como funciona o recebimento das minhas vendas?', 'Você pode receber via PIX, que cai na hora na sua conta, ou integrar com outras soluções de pagamento para aceitar cartão e boleto. Tudo de forma segura.', 3),
('Posso usar um domínio que já tenho?', 'Sim! No plano PREMIUM, você pode conectar seu próprio domínio (ex: www.sualoja.com.br) para deixar sua loja ainda mais profissional.', 4),
('Posso cancelar a assinatura quando quiser?', 'Sim, você pode cancelar sua assinatura a qualquer momento.', 5);