-- Create payment_settings table for merchant payment configuration
CREATE TABLE public.payment_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  
  -- WhatsApp Payment Settings
  whatsapp_enabled BOOLEAN NOT NULL DEFAULT false,
  whatsapp_number TEXT,
  whatsapp_accepts_cash BOOLEAN DEFAULT true,
  whatsapp_accepts_credit BOOLEAN DEFAULT true,
  whatsapp_accepts_debit BOOLEAN DEFAULT true,
  whatsapp_accepts_pix BOOLEAN DEFAULT true,
  whatsapp_accepts_transfer BOOLEAN DEFAULT false,
  
  -- Mercado Pago Settings
  mercadopago_enabled BOOLEAN NOT NULL DEFAULT false,
  mercadopago_access_token TEXT,
  mercadopago_public_key TEXT,
  mercadopago_accepts_credit BOOLEAN DEFAULT true,
  mercadopago_accepts_pix BOOLEAN DEFAULT true,
  mercadopago_pix_discount NUMERIC DEFAULT 0,
  mercadopago_installments_free INTEGER DEFAULT 1,
  
  -- PagBank Settings
  pagbank_enabled BOOLEAN NOT NULL DEFAULT false,
  pagbank_token TEXT,
  pagbank_email TEXT,
  pagbank_accepts_credit BOOLEAN DEFAULT true,
  pagbank_accepts_pix BOOLEAN DEFAULT true,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.payment_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own payment settings"
ON public.payment_settings
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own payment settings"
ON public.payment_settings
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own payment settings"
ON public.payment_settings
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own payment settings"
ON public.payment_settings
FOR DELETE
USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_payment_settings_updated_at
BEFORE UPDATE ON public.payment_settings
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();