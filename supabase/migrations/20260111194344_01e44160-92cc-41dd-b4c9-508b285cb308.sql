-- Insert plans CMS content
INSERT INTO public.cms_landing_content (section_key, content, is_active)
VALUES (
  'plans',
  '{
    "modal_title": "Escolha o plano ideal para você",
    "modal_subtitle": "Comece grátis e faça upgrade quando quiser",
    "toggle_monthly": "Mensal",
    "toggle_annual": "Anual",
    "discount_badge": "-30% DESC.",
    "plans": [
      {
        "id": "gratis",
        "name": "GRÁTIS",
        "display_name": "Plano GRÁTIS",
        "subtitle": "Comece a vender agora, sem custos.",
        "monthly_price": 0,
        "button_text": "Começar grátis",
        "badge_text": "",
        "badge_active": false,
        "badge_color": "#f97316",
        "features": [
          { "icon": "Check", "text": "Até 20 produtos cadastrados" },
          { "icon": "Check", "text": "Até 40 clientes ativos" },
          { "icon": "Check", "text": "Pedidos ilimitados" },
          { "icon": "Check", "text": "ERP (Gestor Virtual) integrado" },
          { "icon": "Check", "text": "Frete personalizado" },
          { "icon": "Check", "text": "Gerador de catálogo PDF ilimitado" },
          { "icon": "Check", "text": "Controle de estoque" },
          { "icon": "Check", "text": "Sem anúncios" },
          { "icon": "Check", "text": "Agente de mensagens" },
          { "icon": "Check", "text": "Calculadora de frete" },
          { "icon": "Check", "text": "Versão mobile responsiva" },
          { "icon": "Check", "text": "Categorias e subcategorias ilimitadas" },
          { "icon": "Check", "text": "Dashboard e relatórios avançados" },
          { "icon": "Check", "text": "Compartilhamento com suas redes sociais" },
          { "icon": "Check", "text": "Gateway e checkout de pagamentos" }
        ]
      },
      {
        "id": "pro",
        "name": "PRO",
        "display_name": "Plano PRO",
        "subtitle": "O melhor custo benefício do mercado online.",
        "monthly_price": 29.97,
        "button_text": "Escolher PRO",
        "badge_text": "Recomendado",
        "badge_active": true,
        "badge_color": "#f97316",
        "previous_plan": {
          "name": "Plano GRÁTIS",
          "label": "GRÁTIS",
          "description": "Tudo o que o plano GRÁTIS oferece, e mais:"
        },
        "features": [
          { "icon": "Check", "text": "Até 150 produtos cadastrados" },
          { "icon": "Check", "text": "Até 300 clientes ativos" },
          { "icon": "Check", "text": "Personalização total do seu site (sua logo e cores)" },
          { "icon": "Check", "text": "Cupons de desconto ilimitado" }
        ]
      },
      {
        "id": "premium",
        "name": "PREMIUM",
        "display_name": "Plano PREMIUM",
        "subtitle": "A solução ideal para quem quer escalar mais rápido as vendas.",
        "monthly_price": 49.97,
        "button_text": "Escolher PREMIUM",
        "badge_text": "",
        "badge_active": false,
        "badge_color": "#f97316",
        "previous_plan": {
          "name": "Plano PRO",
          "label": "PRO",
          "description": "Tudo o que o plano PRO oferece, e mais:"
        },
        "features": [
          { "icon": "Check", "text": "Produtos ilimitados" },
          { "icon": "Check", "text": "Clientes ilimitados" },
          { "icon": "Check", "text": "Editor de imagens com IA" },
          { "icon": "Check", "text": "Vínculo de domínio próprio" },
          { "icon": "Check", "text": "Suporte dedicado via e-mail e WhatsApp" }
        ]
      }
    ],
    "guarantees": [
      { "icon": "CircleDollarSign", "text": "Garantia de 7 dias" },
      { "icon": "Coins", "text": "Sem comissão sobre as vendas" },
      { "icon": "LockOpen", "text": "Cancele a qualquer momento, sem multas ou taxas" },
      { "icon": "Trophy", "text": "Plano escolhido por milhares de assinantes" }
    ],
    "annual_discount_text": "- 30% de desconto no plano anual",
    "annual_savings_text": "Economize 30%"
  }'::jsonb,
  true
)
ON CONFLICT (section_key) DO UPDATE SET
  content = EXCLUDED.content,
  updated_at = now();