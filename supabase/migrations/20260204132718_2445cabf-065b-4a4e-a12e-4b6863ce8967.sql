-- Persistência de ajustes tonais por imagem (para reabrir o editor com sliders hidratados)
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS image_adjustments jsonb NOT NULL DEFAULT '[]'::jsonb;