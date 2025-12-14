-- Add pix_payment_status and pix_payment_id columns to orders table for tracking PIX payments
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS pix_payment_id TEXT,
ADD COLUMN IF NOT EXISTS pix_payment_status TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS pix_qr_code TEXT,
ADD COLUMN IF NOT EXISTS pix_qr_code_base64 TEXT,
ADD COLUMN IF NOT EXISTS pix_expires_at TIMESTAMP WITH TIME ZONE;

-- Create table to track PIX payments with gateway integration
CREATE TABLE IF NOT EXISTS public.pix_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  store_owner_id UUID NOT NULL,
  gateway TEXT NOT NULL CHECK (gateway IN ('mercadopago', 'pagbank')),
  external_payment_id TEXT,
  amount DECIMAL(10,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'expired', 'cancelled')),
  qr_code TEXT,
  qr_code_base64 TEXT,
  expires_at TIMESTAMP WITH TIME ZONE,
  paid_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on pix_payments
ALTER TABLE public.pix_payments ENABLE ROW LEVEL SECURITY;

-- Merchants can view their own PIX payments
CREATE POLICY "Merchants can view their own PIX payments" 
ON public.pix_payments 
FOR SELECT 
USING (auth.uid() = store_owner_id);

-- Anyone can create PIX payments (for checkout)
CREATE POLICY "Anyone can create PIX payments"
ON public.pix_payments
FOR INSERT
WITH CHECK (true);

-- System can update PIX payments (for webhooks)
CREATE POLICY "System can update PIX payments"
ON public.pix_payments
FOR UPDATE
USING (true);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_pix_payments_order_id ON public.pix_payments(order_id);
CREATE INDEX IF NOT EXISTS idx_pix_payments_external_id ON public.pix_payments(external_payment_id);
CREATE INDEX IF NOT EXISTS idx_pix_payments_status ON public.pix_payments(status);

-- Add trigger for updated_at
CREATE TRIGGER update_pix_payments_updated_at
BEFORE UPDATE ON public.pix_payments
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- Enable realtime for pix_payments to allow real-time status updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.pix_payments;