ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS promotion_countdown_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS promotion_countdown_text text DEFAULT 'Oferta termina em',
  ADD COLUMN IF NOT EXISTS promotion_countdown_ends_at timestamptz NULL;