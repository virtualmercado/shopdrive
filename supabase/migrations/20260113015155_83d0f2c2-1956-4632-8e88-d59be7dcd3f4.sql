-- Insert about_us content for landing page CMS
INSERT INTO public.cms_landing_content (section_key, content, is_active)
VALUES (
  'about_us',
  '{
    "title": "Sobre Nós",
    "content": "A VirtualMercado nasceu com um propósito claro: democratizar o acesso ao comércio eletrônico para pequenos e médios empreendedores brasileiros.\n\nSomos uma plataforma 100% nacional, desenvolvida para entender as necessidades específicas do mercado brasileiro. Nossa missão é oferecer ferramentas simples, acessíveis e eficientes para que qualquer pessoa possa criar sua loja virtual e começar a vender online.\n\nAcreditamos que a tecnologia deve ser aliada do empreendedor, não uma barreira. Por isso, criamos uma solução que dispensa conhecimentos técnicos, permitindo que você foque no que realmente importa: seus produtos e seus clientes.\n\nNossa equipe é formada por profissionais apaixonados por inovação e comprometidos com o sucesso de cada lojista que confia em nossa plataforma. Trabalhamos diariamente para melhorar nossos serviços e oferecer a melhor experiência possível.\n\nJunte-se a milhares de empreendedores que já transformaram seus negócios com a VirtualMercado.",
    "image_url": "",
    "image_alt": "Sobre a VirtualMercado",
    "is_active": true,
    "display_order": 1
  }'::jsonb,
  true
)
ON CONFLICT (section_key) DO UPDATE SET
  content = EXCLUDED.content,
  updated_at = now();