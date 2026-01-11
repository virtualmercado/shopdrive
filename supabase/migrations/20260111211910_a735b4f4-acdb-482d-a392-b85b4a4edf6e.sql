-- Insert footer content for landing page CMS
INSERT INTO public.cms_landing_content (section_key, content, is_active)
VALUES (
  'footer',
  '{
    "logo_url": "",
    "logo_alt": "VirtualMercado",
    "subtitle": "Sua loja virtual em minutos.",
    "social_links": [
      {
        "id": "1",
        "name": "Instagram",
        "icon": "Instagram",
        "url": "https://instagram.com",
        "open_new_tab": true,
        "is_active": true
      },
      {
        "id": "2",
        "name": "Facebook",
        "icon": "Facebook",
        "url": "https://facebook.com",
        "open_new_tab": true,
        "is_active": true
      },
      {
        "id": "3",
        "name": "YouTube",
        "icon": "Youtube",
        "url": "https://youtube.com",
        "open_new_tab": true,
        "is_active": true
      }
    ],
    "columns": [
      {
        "id": "1",
        "title": "Institucional",
        "links": [
          { "id": "1", "text": "Sobre Nós", "type": "internal", "route": "/sobre-nos", "open_new_tab": false, "is_active": true },
          { "id": "2", "text": "Blog", "type": "internal", "route": "/blog", "open_new_tab": false, "is_active": true },
          { "id": "3", "text": "Programa de Afiliados", "type": "internal", "route": "/programa-de-afiliados", "open_new_tab": false, "is_active": true }
        ]
      },
      {
        "id": "2",
        "title": "Suporte",
        "links": [
          { "id": "1", "text": "Central de Ajuda", "type": "internal", "route": "/central-de-ajuda", "open_new_tab": false, "is_active": true },
          { "id": "2", "text": "Fale Conosco", "type": "internal", "route": "/fale-conosco", "open_new_tab": false, "is_active": true }
        ]
      },
      {
        "id": "3",
        "title": "Legal",
        "links": [
          { "id": "1", "text": "Termos de Uso", "type": "internal", "route": "/termos-de-uso", "open_new_tab": false, "is_active": true },
          { "id": "2", "text": "Política de Privacidade", "type": "internal", "route": "/politica-de-privacidade", "open_new_tab": false, "is_active": true },
          { "id": "3", "text": "Política de Cookies", "type": "internal", "route": "/politica-de-cookies", "open_new_tab": false, "is_active": true }
        ]
      }
    ],
    "copyright": "© 2025 VirtualMercado. Todos os direitos reservados."
  }'::jsonb,
  true
)
ON CONFLICT (section_key) DO UPDATE SET
  content = EXCLUDED.content,
  updated_at = now();