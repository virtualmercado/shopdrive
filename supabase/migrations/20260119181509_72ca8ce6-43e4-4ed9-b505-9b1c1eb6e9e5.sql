-- Inserir 3 novos banners para o carrossel do Hero
INSERT INTO public.cms_banners (banner_key, name, description, display_order, is_active) VALUES
('hero_01', 'Hero - Imagem 1', 'Primeira imagem do carrossel do Hero (topo da landing page)', 0, true),
('hero_02', 'Hero - Imagem 2', 'Segunda imagem do carrossel do Hero (topo da landing page)', 0, true),
('hero_03', 'Hero - Imagem 3', 'Terceira imagem do carrossel do Hero (topo da landing page)', 0, true)
ON CONFLICT (banner_key) DO NOTHING;