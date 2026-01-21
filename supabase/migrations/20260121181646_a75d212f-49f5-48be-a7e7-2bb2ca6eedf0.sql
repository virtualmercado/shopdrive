-- Table for merchant custom domains
CREATE TABLE public.merchant_domains (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  merchant_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  domain TEXT NOT NULL,
  domain_type TEXT NOT NULL DEFAULT 'subdomain' CHECK (domain_type IN ('subdomain', 'root')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verifying', 'dns_error', 'ssl_provisioning', 'ssl_error', 'active', 'inactive')),
  is_active BOOLEAN NOT NULL DEFAULT false,
  redirect_old_link BOOLEAN NOT NULL DEFAULT true,
  dns_cname_verified BOOLEAN NOT NULL DEFAULT false,
  dns_a_verified BOOLEAN NOT NULL DEFAULT false,
  ssl_status TEXT DEFAULT 'pending' CHECK (ssl_status IN ('pending', 'provisioning', 'active', 'error')),
  last_dns_check TIMESTAMP WITH TIME ZONE,
  last_ssl_check TIMESTAMP WITH TIME ZONE,
  dns_error_message TEXT,
  ssl_error_message TEXT,
  expected_cname TEXT DEFAULT 'cname.vm-dns.com',
  expected_ip TEXT DEFAULT '185.158.133.1',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(merchant_id, domain)
);

-- Table for domain provider tutorials (CMS)
CREATE TABLE public.domain_provider_tutorials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  provider_name TEXT NOT NULL UNIQUE,
  provider_slug TEXT NOT NULL UNIQUE,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  tutorial_content JSONB NOT NULL DEFAULT '{"steps": []}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Domain verification logs for Master Panel
CREATE TABLE public.domain_verification_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  domain_id UUID NOT NULL REFERENCES public.merchant_domains(id) ON DELETE CASCADE,
  verification_type TEXT NOT NULL CHECK (verification_type IN ('dns', 'ssl')),
  status TEXT NOT NULL,
  expected_value TEXT,
  found_value TEXT,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.merchant_domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.domain_provider_tutorials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.domain_verification_logs ENABLE ROW LEVEL SECURITY;

-- Policies for merchant_domains
-- Merchants can view and manage only their own domains
CREATE POLICY "Merchants can view their own domains"
ON public.merchant_domains
FOR SELECT
USING (auth.uid() = merchant_id);

CREATE POLICY "Merchants can insert their own domains"
ON public.merchant_domains
FOR INSERT
WITH CHECK (auth.uid() = merchant_id);

CREATE POLICY "Merchants can update their own domains"
ON public.merchant_domains
FOR UPDATE
USING (auth.uid() = merchant_id);

CREATE POLICY "Merchants can delete their own domains"
ON public.merchant_domains
FOR DELETE
USING (auth.uid() = merchant_id);

-- Admins can manage all domains
CREATE POLICY "Admins can view all domains"
ON public.merchant_domains
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update all domains"
ON public.merchant_domains
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete all domains"
ON public.merchant_domains
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

-- Policies for domain_provider_tutorials (public read, admin write)
CREATE POLICY "Anyone can view active tutorials"
ON public.domain_provider_tutorials
FOR SELECT
USING (is_active = true);

CREATE POLICY "Admins can view all tutorials"
ON public.domain_provider_tutorials
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage tutorials"
ON public.domain_provider_tutorials
FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Policies for domain_verification_logs
CREATE POLICY "Merchants can view their domain logs"
ON public.domain_verification_logs
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.merchant_domains
    WHERE merchant_domains.id = domain_verification_logs.domain_id
    AND merchant_domains.merchant_id = auth.uid()
  )
);

CREATE POLICY "Admins can view all domain logs"
ON public.domain_verification_logs
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage domain logs"
ON public.domain_verification_logs
FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Trigger for updated_at
CREATE TRIGGER update_merchant_domains_updated_at
BEFORE UPDATE ON public.merchant_domains
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_domain_provider_tutorials_updated_at
BEFORE UPDATE ON public.domain_provider_tutorials
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default provider tutorials
INSERT INTO public.domain_provider_tutorials (provider_name, provider_slug, display_order, tutorial_content) VALUES
('Hostgator', 'hostgator', 1, '{
  "steps": [
    {"title": "Acesse o painel Hostgator", "content": "Faça login em sua conta Hostgator e acesse o painel de controle (cPanel)."},
    {"title": "Vá para Zona DNS", "content": "No cPanel, procure por \"Zona DNS\" ou \"Editor de Zona DNS\" na seção Domínios."},
    {"title": "Adicione o registro CNAME", "content": "Clique em \"Adicionar Registro\" e configure:\n- Tipo: CNAME\n- Nome: www\n- Destino: cname.vm-dns.com"},
    {"title": "Adicione o registro A", "content": "Adicione outro registro:\n- Tipo: A\n- Nome: @ (ou deixe em branco para domínio raiz)\n- Endereço IPv4: 185.158.133.1"},
    {"title": "Aguarde a propagação", "content": "As alterações de DNS podem levar até 48 horas para propagar completamente."}
  ]
}'),
('GoDaddy', 'godaddy', 2, '{
  "steps": [
    {"title": "Acesse sua conta GoDaddy", "content": "Faça login em godaddy.com e vá para \"Meus Produtos\"."},
    {"title": "Acesse o gerenciamento de DNS", "content": "Localize seu domínio e clique em \"DNS\" ou \"Gerenciar DNS\"."},
    {"title": "Adicione o registro CNAME", "content": "Clique em \"Adicionar\" e configure:\n- Tipo: CNAME\n- Nome: www\n- Valor: cname.vm-dns.com\n- TTL: 1 hora"},
    {"title": "Adicione o registro A", "content": "Adicione outro registro:\n- Tipo: A\n- Nome: @\n- Valor: 185.158.133.1\n- TTL: 1 hora"},
    {"title": "Salve as alterações", "content": "Clique em \"Salvar\" e aguarde até 48 horas para propagação DNS."}
  ]
}'),
('Registro.br', 'registro-br', 3, '{
  "steps": [
    {"title": "Acesse o Registro.br", "content": "Faça login em registro.br com seu usuário e senha."},
    {"title": "Selecione seu domínio", "content": "Na lista de domínios, clique no domínio que deseja configurar."},
    {"title": "Vá para DNS", "content": "Clique na aba \"DNS\" ou \"Configurar Zona DNS\"."},
    {"title": "Adicione o registro CNAME", "content": "Adicione uma nova entrada:\n- Tipo: CNAME\n- Nome: www\n- Dados: cname.vm-dns.com"},
    {"title": "Adicione o registro A", "content": "Adicione outra entrada:\n- Tipo: A\n- Nome: (deixe vazio para @)\n- Dados: 185.158.133.1"},
    {"title": "Publique as alterações", "content": "Clique em \"Salvar\" ou \"Publicar\". A propagação pode levar até 48 horas."}
  ]
}'),
('Locaweb', 'locaweb', 4, '{
  "steps": [
    {"title": "Acesse o painel Locaweb", "content": "Faça login no painel de controle da Locaweb."},
    {"title": "Acesse a Zona DNS", "content": "Vá em \"Domínios\" > \"Zona de DNS\" ou similar."},
    {"title": "Adicione o registro CNAME", "content": "Crie um novo registro:\n- Tipo: CNAME\n- Subdomínio: www\n- Destino: cname.vm-dns.com"},
    {"title": "Adicione o registro A", "content": "Crie outro registro:\n- Tipo: A\n- Subdomínio: @ ou vazio\n- IP: 185.158.133.1"},
    {"title": "Aguarde a propagação", "content": "As alterações podem levar até 48 horas para propagar."}
  ]
}'),
('Hostinger', 'hostinger', 5, '{
  "steps": [
    {"title": "Acesse o hPanel", "content": "Faça login em hpanel.hostinger.com.br."},
    {"title": "Vá para Editor de Zona DNS", "content": "Clique em \"Domínios\" > selecione seu domínio > \"DNS / Nameservers\" > \"Gerenciar Registros DNS\"."},
    {"title": "Adicione o registro CNAME", "content": "Clique em \"Adicionar registro\" e configure:\n- Tipo: CNAME\n- Nome: www\n- Aponta para: cname.vm-dns.com"},
    {"title": "Adicione o registro A", "content": "Adicione outro registro:\n- Tipo: A\n- Nome: @\n- Aponta para: 185.158.133.1"},
    {"title": "Salve e aguarde", "content": "Clique em \"Adicionar registro\". A propagação leva até 48 horas."}
  ]
}'),
('Umbler', 'umbler', 6, '{
  "steps": [
    {"title": "Acesse o painel Umbler", "content": "Faça login em app.umbler.com."},
    {"title": "Vá para Domínios", "content": "No menu lateral, clique em \"Domínios\" e selecione seu domínio."},
    {"title": "Acesse a Zona DNS", "content": "Clique na aba \"Zona DNS\"."},
    {"title": "Adicione o registro CNAME", "content": "Adicione:\n- Tipo: CNAME\n- Host: www\n- Valor: cname.vm-dns.com"},
    {"title": "Adicione o registro A", "content": "Adicione:\n- Tipo: A\n- Host: @\n- Valor: 185.158.133.1"},
    {"title": "Aguarde a propagação", "content": "DNS pode levar até 48 horas para propagar."}
  ]
}'),
('UOL Host', 'uol-host', 7, '{
  "steps": [
    {"title": "Acesse o painel UOL Host", "content": "Faça login no painel de controle do UOL Host."},
    {"title": "Vá para Gerenciamento de DNS", "content": "Acesse \"Domínios\" > \"Gerenciar DNS\" ou \"Zona de DNS\"."},
    {"title": "Adicione o registro CNAME", "content": "Crie um registro:\n- Tipo: CNAME\n- Nome: www\n- Destino: cname.vm-dns.com"},
    {"title": "Adicione o registro A", "content": "Crie outro registro:\n- Tipo: A\n- Nome: @ (domínio raiz)\n- IP: 185.158.133.1"},
    {"title": "Salve as alterações", "content": "Clique em \"Salvar\". A propagação pode levar até 48 horas."}
  ]
}');

-- Index for faster lookups
CREATE INDEX idx_merchant_domains_merchant_id ON public.merchant_domains(merchant_id);
CREATE INDEX idx_merchant_domains_domain ON public.merchant_domains(domain);
CREATE INDEX idx_merchant_domains_status ON public.merchant_domains(status);
CREATE INDEX idx_domain_verification_logs_domain_id ON public.domain_verification_logs(domain_id);