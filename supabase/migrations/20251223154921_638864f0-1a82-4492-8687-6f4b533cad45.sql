-- Create table for storing boleto payment data
CREATE TABLE public.boleto_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  store_owner_id UUID NOT NULL,
  gateway TEXT NOT NULL DEFAULT 'mercadopago',
  external_payment_id TEXT,
  amount NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  barcode TEXT,
  digitable_line TEXT,
  boleto_url TEXT,
  expires_at TIMESTAMP WITH TIME ZONE,
  paid_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.boleto_payments ENABLE ROW LEVEL SECURITY;

-- Policies for boleto_payments
CREATE POLICY "Store owners can view their boleto payments"
  ON public.boleto_payments
  FOR SELECT
  USING (store_owner_id = auth.uid());

CREATE POLICY "Store owners can insert boleto payments"
  ON public.boleto_payments
  FOR INSERT
  WITH CHECK (store_owner_id = auth.uid());

CREATE POLICY "Store owners can update their boleto payments"
  ON public.boleto_payments
  FOR UPDATE
  USING (store_owner_id = auth.uid());

-- Service role can manage all boleto payments (for edge functions)
CREATE POLICY "Service role can manage all boleto payments"
  ON public.boleto_payments
  FOR ALL
  USING (auth.role() = 'service_role');

-- Add boleto columns to orders table for quick access
ALTER TABLE public.orders 
  ADD COLUMN IF NOT EXISTS boleto_payment_id UUID REFERENCES public.boleto_payments(id),
  ADD COLUMN IF NOT EXISTS boleto_payment_status TEXT,
  ADD COLUMN IF NOT EXISTS boleto_barcode TEXT,
  ADD COLUMN IF NOT EXISTS boleto_digitable_line TEXT,
  ADD COLUMN IF NOT EXISTS boleto_url TEXT,
  ADD COLUMN IF NOT EXISTS boleto_expires_at TIMESTAMP WITH TIME ZONE;

-- Create index for faster lookups
CREATE INDEX idx_boleto_payments_order_id ON public.boleto_payments(order_id);
CREATE INDEX idx_boleto_payments_external_id ON public.boleto_payments(external_payment_id);
CREATE INDEX idx_boleto_payments_status ON public.boleto_payments(status);

-- Trigger for updated_at
CREATE TRIGGER update_boleto_payments_updated_at
  BEFORE UPDATE ON public.boleto_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();