-- Add invoice_id column
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS invoice_id TEXT UNIQUE;

-- Backfill existing invoices using a CTE
WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at) AS rn
  FROM public.invoices
  WHERE invoice_id IS NULL
)
UPDATE public.invoices
SET invoice_id = 'inv_' || LPAD(numbered.rn::TEXT, 5, '0')
FROM numbered
WHERE public.invoices.id = numbered.id;

-- Function to auto-generate invoice_id on insert
CREATE OR REPLACE FUNCTION public.set_invoice_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  next_num INTEGER;
BEGIN
  IF NEW.invoice_id IS NULL THEN
    SELECT COALESCE(
      MAX(CAST(SUBSTRING(invoice_id FROM 5) AS INTEGER)), 0
    ) + 1 INTO next_num
    FROM public.invoices
    WHERE invoice_id ~ '^inv_\d+$';
    
    NEW.invoice_id := 'inv_' || LPAD(next_num::TEXT, 5, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_invoice_id_trigger ON public.invoices;
CREATE TRIGGER set_invoice_id_trigger
  BEFORE INSERT ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.set_invoice_id();

-- Create webhook events dedup table
CREATE TABLE IF NOT EXISTS public.webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gateway TEXT NOT NULL,
  gateway_event_id TEXT NOT NULL,
  event_type TEXT,
  invoice_id TEXT,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  payload JSONB,
  UNIQUE(gateway, gateway_event_id)
);

ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only" ON public.webhook_events
  FOR ALL USING (false);

CREATE INDEX IF NOT EXISTS idx_webhook_events_gateway ON public.webhook_events(gateway, gateway_event_id);