-- Insert default FAQ content for CMS
INSERT INTO public.cms_landing_content (section_key, content, is_active)
VALUES (
  'faq',
  '{
    "title": "Dúvidas Frequentes",
    "subtitle": "Encontre aqui as respostas para as perguntas mais comuns.",
    "items": [
      {
        "question": "A VirtualMercado é grátis mesmo?",
        "answer": "Sim! Você pode ter uma loja totalmente gratuita, e caso queira recursos exclusivos, pode assinar um plano pago."
      },
      {
        "question": "Preciso ter CNPJ para começar?",
        "answer": "Não! Você pode começar a vender usando apenas seu CPF e, quando seu negócio crescer, pode migrar para um CNPJ facilmente."
      },
      {
        "question": "Como funciona o recebimento das minhas vendas?",
        "answer": "Você pode receber via PIX, que cai na hora na sua conta, ou integrar com outras soluções de pagamento para aceitar cartão e boleto. Tudo de forma segura."
      },
      {
        "question": "Posso usar um domínio que já tenho?",
        "answer": "Sim! No plano PREMIUM, você pode conectar seu próprio domínio (ex: www.sualoja.com.br) para deixar sua loja ainda mais profissional."
      },
      {
        "question": "Posso cancelar a assinatura quando quiser?",
        "answer": "Sim, você pode cancelar sua assinatura a qualquer momento."
      },
      {
        "question": "Posso usar meu site na plataforma como catálogo de produtos?",
        "answer": "Sim! Você pode usar sua loja como um catálogo digital em PDF, exibindo fotos, descrições e preços dos produtos mesmo sem ativar o sistema de vendas online."
      },
      {
        "question": "Como faço o pagamento da minha assinatura aqui na VirtualMercado?",
        "answer": "Você paga uma mensalidade ou anuidade diretamente pela plataforma. Aceitamos PIX, cartão de crédito, cartão de débito e boleto bancário."
      }
    ]
  }'::jsonb,
  true
)
ON CONFLICT (section_key) DO UPDATE SET
  content = EXCLUDED.content,
  updated_at = now();