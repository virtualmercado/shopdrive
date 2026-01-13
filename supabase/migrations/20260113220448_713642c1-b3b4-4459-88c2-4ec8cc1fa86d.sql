-- Create help categories table
CREATE TABLE public.help_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  display_order INTEGER NOT NULL DEFAULT 0,
  icon TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create help articles table
CREATE TABLE public.help_articles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id UUID NOT NULL REFERENCES public.help_categories(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  content TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(category_id, slug)
);

-- Enable RLS
ALTER TABLE public.help_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.help_articles ENABLE ROW LEVEL SECURITY;

-- Public read access for help content
CREATE POLICY "Help categories are publicly readable" 
ON public.help_categories 
FOR SELECT 
USING (true);

CREATE POLICY "Help articles are publicly readable" 
ON public.help_articles 
FOR SELECT 
USING (true);

-- Admin write access (using user_roles)
CREATE POLICY "Admins can manage help categories" 
ON public.help_categories 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "Admins can manage help articles" 
ON public.help_articles 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Create indexes
CREATE INDEX idx_help_categories_active ON public.help_categories(is_active, display_order);
CREATE INDEX idx_help_articles_category ON public.help_articles(category_id, is_active, display_order);

-- Insert default categories
INSERT INTO public.help_categories (name, slug, display_order, icon) VALUES
('Começando na VM', 'comecando-na-vm', 1, 'Rocket'),
('Produtos e Catálogo', 'produtos-catalogo', 2, 'Package'),
('Pagamentos e Pix', 'pagamentos-pix', 3, 'CreditCard'),
('Pedidos e Frete', 'pedidos-frete', 4, 'Truck'),
('Conta e Planos', 'conta-planos', 5, 'User'),
('Regras da Plataforma', 'regras-plataforma', 6, 'Shield');

-- Insert default articles
INSERT INTO public.help_articles (category_id, title, slug, content, display_order) 
SELECT 
  c.id,
  'Como criar sua loja na VirtualMercado',
  'como-criar-sua-loja',
  'Para criar sua loja na VirtualMercado, siga os passos:

1. Acesse a página inicial e clique em "Criar Loja Grátis"
2. Preencha seu e-mail e crie uma senha segura
3. Complete as informações do seu perfil de lojista
4. Configure o nome e descrição da sua loja
5. Adicione seu primeiro produto

Pronto! Sua loja já está criada e você pode começar a vender.',
  1
FROM public.help_categories c WHERE c.slug = 'comecando-na-vm';

INSERT INTO public.help_articles (category_id, title, slug, content, display_order) 
SELECT 
  c.id,
  'Como publicar sua loja',
  'como-publicar-sua-loja',
  'Depois de configurar sua loja, siga estes passos para publicá-la:

1. Acesse o Painel do Lojista
2. Verifique se você tem pelo menos um produto cadastrado
3. Configure suas formas de pagamento
4. Defina suas opções de entrega
5. Sua loja ficará disponível no link personalizado

Clientes poderão acessar e fazer pedidos imediatamente.',
  2
FROM public.help_categories c WHERE c.slug = 'comecando-na-vm';

INSERT INTO public.help_articles (category_id, title, slug, content, display_order) 
SELECT 
  c.id,
  'Como cadastrar um produto',
  'como-cadastrar-produto',
  'Para adicionar produtos à sua loja:

1. Acesse "Produtos" no menu lateral
2. Clique em "Adicionar Produto"
3. Preencha o nome, descrição e preço
4. Adicione fotos do produto
5. Configure o estoque disponível
6. Salve as alterações

O produto ficará visível na sua loja imediatamente.',
  1
FROM public.help_categories c WHERE c.slug = 'produtos-catalogo';

INSERT INTO public.help_articles (category_id, title, slug, content, display_order) 
SELECT 
  c.id,
  'Como editar ou excluir um produto',
  'como-editar-excluir-produto',
  'Para editar ou excluir produtos:

EDITAR:
1. Acesse "Produtos" no menu
2. Clique no produto desejado
3. Faça as alterações necessárias
4. Clique em "Salvar"

EXCLUIR:
1. Acesse "Produtos" no menu
2. Clique no ícone de lixeira do produto
3. Confirme a exclusão

Atenção: produtos excluídos não podem ser recuperados.',
  2
FROM public.help_categories c WHERE c.slug = 'produtos-catalogo';

INSERT INTO public.help_articles (category_id, title, slug, content, display_order) 
SELECT 
  c.id,
  'Como configurar Pix e cartão',
  'como-configurar-pix-cartao',
  'Para configurar seus meios de pagamento:

PIX:
1. Acesse "Métodos de Pagamento"
2. Ative a opção Pix
3. Configure sua chave Pix
4. Defina desconto para pagamento via Pix (opcional)

CARTÃO DE CRÉDITO:
1. Na mesma página, ative "Cartão de Crédito"
2. Conecte sua conta do gateway de pagamento
3. Configure as opções de parcelamento

Os pagamentos serão creditados automaticamente.',
  1
FROM public.help_categories c WHERE c.slug = 'pagamentos-pix';

INSERT INTO public.help_articles (category_id, title, slug, content, display_order) 
SELECT 
  c.id,
  'Por que um pagamento pode falhar',
  'por-que-pagamento-pode-falhar',
  'Pagamentos podem falhar por diversos motivos:

CARTÃO DE CRÉDITO:
- Limite insuficiente
- Cartão bloqueado ou vencido
- Dados incorretos
- Suspeita de fraude pelo banco

PIX:
- Saldo insuficiente na conta
- Chave Pix incorreta
- Tempo de expiração do QR Code

Em caso de falha, o cliente deve tentar novamente ou usar outra forma de pagamento.',
  2
FROM public.help_categories c WHERE c.slug = 'pagamentos-pix';

INSERT INTO public.help_articles (category_id, title, slug, content, display_order) 
SELECT 
  c.id,
  'Como ver seus pedidos',
  'como-ver-pedidos',
  'Para acompanhar seus pedidos:

1. Acesse "Pedidos" no menu lateral
2. Visualize a lista de todos os pedidos
3. Use os filtros para buscar por status
4. Clique em um pedido para ver detalhes

Você pode filtrar por:
- Pendentes
- Pagos
- Enviados
- Entregues
- Cancelados',
  1
FROM public.help_categories c WHERE c.slug = 'pedidos-frete';

INSERT INTO public.help_articles (category_id, title, slug, content, display_order) 
SELECT 
  c.id,
  'Como informar envio ao cliente',
  'como-informar-envio',
  'Após enviar o pedido:

1. Acesse o pedido em "Pedidos"
2. Clique em "Atualizar Status"
3. Selecione "Enviado"
4. Adicione o código de rastreamento
5. Salve as alterações

O cliente receberá uma notificação automática com os dados de rastreamento.',
  2
FROM public.help_categories c WHERE c.slug = 'pedidos-frete';

INSERT INTO public.help_articles (category_id, title, slug, content, display_order) 
SELECT 
  c.id,
  'Como mudar de plano',
  'como-mudar-plano',
  'Para alterar seu plano:

1. Acesse "Minha Conta"
2. Clique em "Plano Atual"
3. Visualize os planos disponíveis
4. Selecione o novo plano
5. Confirme a alteração

UPGRADE: ativado imediatamente
DOWNGRADE: efetivado no próximo ciclo

Valores são proporcionais ao período restante.',
  1
FROM public.help_categories c WHERE c.slug = 'conta-planos';

INSERT INTO public.help_articles (category_id, title, slug, content, display_order) 
SELECT 
  c.id,
  'Como cancelar sua assinatura',
  'como-cancelar-assinatura',
  'Para cancelar sua assinatura:

1. Acesse "Minha Conta"
2. Clique em "Plano Atual"
3. Selecione "Cancelar Assinatura"
4. Informe o motivo (opcional)
5. Confirme o cancelamento

Sua loja permanece ativa até o fim do período pago. Após isso, ficará indisponível para novos pedidos.

Você pode reativar a qualquer momento.',
  2
FROM public.help_categories c WHERE c.slug = 'conta-planos';

INSERT INTO public.help_articles (category_id, title, slug, content, display_order) 
SELECT 
  c.id,
  'Produtos proibidos na VM',
  'produtos-proibidos',
  'A VirtualMercado NÃO permite a venda de:

- Armas de fogo e munições
- Drogas ilícitas
- Medicamentos controlados
- Produtos falsificados
- Conteúdo adulto explícito
- Animais vivos
- Documentos falsos
- Produtos roubados
- Itens que violem propriedade intelectual

Lojas que comercializem esses itens serão suspensas imediatamente.',
  1
FROM public.help_categories c WHERE c.slug = 'regras-plataforma';

INSERT INTO public.help_articles (category_id, title, slug, content, display_order) 
SELECT 
  c.id,
  'Quando uma conta pode ser suspensa',
  'quando-conta-suspensa',
  'Sua conta pode ser suspensa nos seguintes casos:

- Venda de produtos proibidos
- Fraude comprovada
- Inadimplência recorrente
- Denúncias verificadas de clientes
- Violação dos Termos de Uso
- Uso indevido da plataforma

Antes da suspensão, você receberá notificações para regularizar a situação. Em casos graves, a suspensão pode ser imediata.',
  2
FROM public.help_categories c WHERE c.slug = 'regras-plataforma';

-- Trigger for updated_at
CREATE TRIGGER update_help_categories_updated_at
BEFORE UPDATE ON public.help_categories
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_help_articles_updated_at
BEFORE UPDATE ON public.help_articles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();