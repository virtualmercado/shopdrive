-- Create tickets_landing_page table
CREATE TABLE public.tickets_landing_page (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  protocolo TEXT NOT NULL UNIQUE,
  canal_origem TEXT NOT NULL DEFAULT 'landing_page',
  categoria TEXT NOT NULL CHECK (categoria IN ('suporte_lojista', 'financeiro_cobrancas', 'lgpd_privacidade', 'comercial_parcerias')),
  nome TEXT NOT NULL,
  email TEXT NOT NULL,
  loja_url_ou_nome TEXT,
  tipo_problema TEXT,
  cpf_cnpj TEXT,
  empresa TEXT,
  mensagem TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'novo' CHECK (status IN ('novo', 'em_andamento', 'aguardando_cliente', 'resolvido', 'arquivado')),
  prioridade TEXT NOT NULL DEFAULT 'media' CHECK (prioridade IN ('baixa', 'media', 'alta')),
  responsavel TEXT,
  notas_internas TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ip_address TEXT,
  user_agent TEXT
);

-- Enable RLS
ALTER TABLE public.tickets_landing_page ENABLE ROW LEVEL SECURITY;

-- Create policy for admins only (using has_role function)
CREATE POLICY "Admins can manage all landing page tickets"
ON public.tickets_landing_page
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Create policy for public insert (anyone can submit a ticket)
CREATE POLICY "Anyone can create landing page tickets"
ON public.tickets_landing_page
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Create function to generate protocol number
CREATE OR REPLACE FUNCTION public.generate_landing_ticket_protocol()
RETURNS TRIGGER AS $$
DECLARE
  today_date TEXT;
  ticket_count INTEGER;
  new_protocol TEXT;
BEGIN
  today_date := to_char(now(), 'YYYYMMDD');
  
  SELECT COUNT(*) + 1 INTO ticket_count
  FROM public.tickets_landing_page
  WHERE protocolo LIKE 'VM-LP-' || today_date || '%';
  
  new_protocol := 'VM-LP-' || today_date || '-' || lpad(ticket_count::TEXT, 4, '0');
  NEW.protocolo := new_protocol;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for auto-generating protocol
CREATE TRIGGER generate_landing_ticket_protocol_trigger
BEFORE INSERT ON public.tickets_landing_page
FOR EACH ROW
EXECUTE FUNCTION public.generate_landing_ticket_protocol();

-- Create update timestamp trigger
CREATE TRIGGER update_tickets_landing_page_updated_at
BEFORE UPDATE ON public.tickets_landing_page
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create default response templates table
CREATE TABLE public.landing_response_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  categoria TEXT NOT NULL UNIQUE CHECK (categoria IN ('suporte_lojista', 'financeiro_cobrancas', 'lgpd_privacidade', 'comercial_parcerias')),
  assunto TEXT NOT NULL,
  mensagem TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.landing_response_templates ENABLE ROW LEVEL SECURITY;

-- Create policy for admins only
CREATE POLICY "Admins can manage response templates"
ON public.landing_response_templates
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Create policy for reading templates (for displaying)
CREATE POLICY "Authenticated users can read response templates"
ON public.landing_response_templates
FOR SELECT
TO authenticated
USING (true);

-- Create update timestamp trigger for templates
CREATE TRIGGER update_landing_response_templates_updated_at
BEFORE UPDATE ON public.landing_response_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default response templates
INSERT INTO public.landing_response_templates (categoria, assunto, mensagem) VALUES
('suporte_lojista', 'VM — Atendimento {protocolo}', 'Olá, {nome} 👋

Recebemos sua solicitação de suporte na VirtualMercado e ela já foi registrada sob o protocolo {protocolo}.

Nossa equipe está analisando o seu caso relacionado à sua loja e retornará o mais breve possível.

Se necessário, poderemos solicitar informações adicionais para agilizar a solução.

Atenciosamente,
Equipe VirtualMercado
https://virtualmercado.com.br'),
('financeiro_cobrancas', 'VM — Financeiro | Protocolo {protocolo}', 'Olá, {nome},

Recebemos sua solicitação relacionada a cobranças ou assinatura na VirtualMercado.

Seu atendimento foi registrado sob o protocolo {protocolo}.

Nossa equipe financeira está analisando as informações e retornará assim que possível.

Caso seja necessário, poderemos solicitar dados adicionais para validação.

Atenciosamente,
Equipe Financeira VirtualMercado
https://virtualmercado.com.br'),
('lgpd_privacidade', 'VM — Privacidade e Dados | Protocolo {protocolo}', 'Olá, {nome},

Confirmamos o recebimento da sua solicitação relacionada à privacidade e proteção de dados pessoais.

Seu pedido foi registrado sob o protocolo {protocolo}.

A VirtualMercado trata dados pessoais conforme a Lei Geral de Proteção de Dados (LGPD).

Sua solicitação será analisada dentro dos prazos legais e você receberá retorno por este canal.

Atenciosamente,
Encarregado de Dados (DPO)
VirtualMercado'),
('comercial_parcerias', 'VM — Comercial e Parcerias | Protocolo {protocolo}', 'Olá, {nome},

Obrigado por entrar em contato com a VirtualMercado.

Recebemos sua mensagem sobre parcerias ou assuntos comerciais e ela foi registrada sob o protocolo {protocolo}.

Nossa equipe comercial analisará sua proposta e retornará em breve.

Atenciosamente,
Equipe Comercial VirtualMercado
https://virtualmercado.com.br');

-- Enable realtime for tickets
ALTER PUBLICATION supabase_realtime ADD TABLE public.tickets_landing_page;