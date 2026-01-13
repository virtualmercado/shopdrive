-- Create contact submissions table
CREATE TABLE public.contact_submissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_type TEXT NOT NULL CHECK (contact_type IN ('support', 'financial', 'commercial')),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  store_url TEXT,
  problem_type TEXT,
  cpf_cnpj TEXT,
  company TEXT,
  message TEXT NOT NULL,
  ip_address TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'resolved', 'closed')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.contact_submissions ENABLE ROW LEVEL SECURITY;

-- Public can insert (create submissions)
CREATE POLICY "Anyone can create contact submissions"
ON public.contact_submissions
FOR INSERT
WITH CHECK (true);

-- Admins can read and manage all submissions
CREATE POLICY "Admins can manage contact submissions"
ON public.contact_submissions
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Create index for filtering
CREATE INDEX idx_contact_submissions_type ON public.contact_submissions(contact_type, status, created_at DESC);

-- Add CMS content for contact page
INSERT INTO public.cms_landing_content (section_key, content, is_active)
VALUES (
  'contact_page',
  '{
    "title": "Fale com a VirtualMercado",
    "subtitle": "Escolha o tipo de atendimento para que possamos ajudar mais rápido",
    "support_title": "Suporte ao Lojista",
    "support_text": "Problemas com sua loja, produtos, pedidos, pagamentos ou sistema",
    "financial_title": "Financeiro e Cobranças",
    "financial_text": "Problemas com sua assinatura, cartão ou cobranças",
    "privacy_title": "Privacidade e Dados (LGPD)",
    "privacy_text": "Solicitações sobre dados pessoais, exclusão ou privacidade",
    "dpo_email": "dpo@virtualmercado.com.br",
    "commercial_title": "Comercial e Parcerias",
    "commercial_text": "Parcerias, revenda, integrações ou negócios",
    "financial_email": "financeiro@virtualmercado.com.br",
    "commercial_email": "comercial@virtualmercado.com.br"
  }'::jsonb,
  true
)
ON CONFLICT (section_key) DO UPDATE SET content = EXCLUDED.content;

-- Trigger for updated_at
CREATE TRIGGER update_contact_submissions_updated_at
BEFORE UPDATE ON public.contact_submissions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();