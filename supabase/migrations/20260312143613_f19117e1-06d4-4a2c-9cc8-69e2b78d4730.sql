
ALTER TABLE public.merchant_support_tickets
  ADD COLUMN IF NOT EXISTS last_interaction_by text DEFAULT 'lojista',
  ADD COLUMN IF NOT EXISTS last_interaction_at timestamptz DEFAULT now();

-- Backfill existing rows
UPDATE public.merchant_support_tickets
SET last_interaction_at = COALESCE(answered_at, created_at),
    last_interaction_by = CASE WHEN response IS NOT NULL THEN 'admin' ELSE 'lojista' END;
