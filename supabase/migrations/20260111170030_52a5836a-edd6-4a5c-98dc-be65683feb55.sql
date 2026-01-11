-- Create CMS Landing Page Content table
CREATE TABLE public.cms_landing_content (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  section_key TEXT NOT NULL UNIQUE,
  content JSONB NOT NULL DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.cms_landing_content ENABLE ROW LEVEL SECURITY;

-- Policies for cms_landing_content
-- Admins can manage all content
CREATE POLICY "Admins can manage CMS landing content"
ON public.cms_landing_content
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
);

-- Public can read active content
CREATE POLICY "Public can read active CMS landing content"
ON public.cms_landing_content
FOR SELECT
USING (is_active = true);

-- Add updated_at trigger
CREATE TRIGGER update_cms_landing_content_updated_at
  BEFORE UPDATE ON public.cms_landing_content
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Insert default content for each section

-- Header section
INSERT INTO public.cms_landing_content (section_key, content) VALUES 
('header', '{
  "menu_benefits": "Benefícios",
  "menu_plans": "Planos",
  "menu_how_it_works": "Como Funciona",
  "button_login": "Entrar",
  "button_cta": "Criar Loja Grátis"
}'::jsonb);

-- Hero section
INSERT INTO public.cms_landing_content (section_key, content) VALUES 
('hero', '{
  "badge": "🇧🇷 Plataforma 100% Nacional",
  "title": "Crie sua loja virtual e seu catálogo digital em menos de 01 minuto. É GRÁTIS, FÁCIL e 100% online!",
  "subtitle": "Plataforma simples e moderna, venda 24h por dia o ano inteiro direto do celular. Comece gratuitamente hoje mesmo.",
  "button_primary": "Criar Minha Loja Grátis",
  "button_secondary": "Ver Demonstração",
  "info_text": "Grátis para sempre, sem taxas ou cartão de crédito"
}'::jsonb);

-- Products section
INSERT INTO public.cms_landing_content (section_key, content) VALUES 
('products', '{
  "title": "Seus produtos disponíveis em todos os lugares",
  "description": "Adicione o link da sua loja em todas as suas redes sociais, e envie para seus clientes a qualquer hora em qualquer lugar."
}'::jsonb);

-- Social proof 1
INSERT INTO public.cms_landing_content (section_key, content) VALUES 
('social_proof_1', '{
  "text": "Mais de 10 mil empreendedores já criaram suas lojas com a VirtualMercado"
}'::jsonb);

-- Sales and Payments section
INSERT INTO public.cms_landing_content (section_key, content) VALUES 
('sales_payments', '{
  "title": "Venda através do WhatsApp ou aceite pagamentos no site.",
  "highlight": "LUCRO 24h por dia.",
  "description": "Receba pagamentos no cartão de crédito, débito ou via PIX de forma automática e segura, direto na sua conta.",
  "benefits": [
    "Gerador de catálogo de produtos em PDF.",
    "Confirmação e lista do pedido diretamente no seu WhatsApp.",
    "Transparência, organização e segurança nas suas vendas."
  ]
}'::jsonb);

-- Resources section
INSERT INTO public.cms_landing_content (section_key, content) VALUES 
('resources', '{
  "title": "Recursos poderosos para suas vendas decolarem",
  "subtitle": "Ferramentas simples que geram resultados rápidos e lucrativos."
}'::jsonb);

-- Resource cards
INSERT INTO public.cms_landing_content (section_key, content) VALUES 
('resource_cards', '{
  "cards": [
    {"title": "Loja Profissional", "description": "Crie uma loja virtual com visual profissional em minutos", "icon": "Store"},
    {"title": "Personalização Total", "description": "Customize cores, fontes e layout da sua loja", "icon": "Palette"},
    {"title": "Carrinho Inteligente", "description": "Sistema de carrinho e checkout otimizado para conversão", "icon": "ShoppingCart"},
    {"title": "Relatórios Completos", "description": "Acompanhe vendas e performance em tempo real", "icon": "BarChart3"},
    {"title": "Sem Taxa de Venda", "description": "A plataforma não cobra nenhum valor ou comissão nas suas vendas.", "icon": "Percent"},
    {"title": "Painel Administrativo", "description": "Controle total sobre estoque, clientes, pedidos e envios.", "icon": "LayoutDashboard"},
    {"title": "Editor de Imagens", "description": "Edite de forma profissional as imagens e o cadastro dos seus produtos.", "icon": "ImagePlus"},
    {"title": "Criador de Cupons", "description": "Gere cupons de desconto e aumente o número de vendas e clientes.", "icon": "Tag"}
  ]
}'::jsonb);

-- Testimonials section
INSERT INTO public.cms_landing_content (section_key, content) VALUES 
('testimonials', '{
  "title": "Quem usa, aprova!",
  "subtitle": "Histórias reais de quem transformou e melhorou o jeito de vender.",
  "items": [
    {"name": "Juliana S.", "role": "Dona da @doceju", "text": "Em menos de um dia, minha loja estava no ar! A plataforma é super intuitiva e o suporte é nota 10."},
    {"name": "Marcos P.", "role": "Artesão na @arteemmadeira", "text": "Consegui organizar meus produtos e agora vendo para todo o Brasil. O editor de fotos me ajudou a deixar tudo mais profissional."},
    {"name": "Carla F.", "role": "Consultora de Beleza", "text": "Meus clientes amaram a facilidade de comprar pelo site. A integração com o WhatsApp é perfeita para fechar vendas."}
  ]
}'::jsonb);

-- How it works section
INSERT INTO public.cms_landing_content (section_key, content) VALUES 
('how_it_works', '{
  "title": "Como funciona",
  "subtitle": "3 passos simples para começar a vender",
  "steps": [
    {"step": "1", "title": "Cadastre-se", "description": "Crie sua conta gratuitamente em menos de 1 minuto"},
    {"step": "2", "title": "Configure sua loja", "description": "Adicione produtos, personalize cores e layout"},
    {"step": "3", "title": "Comece a vender", "description": "Compartilhe sua loja e seu catálogo PDF e receba pedidos online"}
  ],
  "cta_button": "Criar Loja Agora",
  "cta_text": "Junte-se a milhares de lojistas que já vendem com a VirtualMercado"
}'::jsonb);