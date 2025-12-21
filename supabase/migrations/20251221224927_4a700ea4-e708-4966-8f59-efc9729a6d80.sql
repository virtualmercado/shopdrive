-- Add new columns for payment method configuration
ALTER TABLE public.payment_settings
ADD COLUMN IF NOT EXISTS pix_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS pix_provider text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS pix_discount_percent integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS credit_card_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS credit_card_provider text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS credit_card_installments_no_interest integer DEFAULT 1,
ADD COLUMN IF NOT EXISTS boleto_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS boleto_provider text DEFAULT NULL;

-- Add check constraints for valid providers
ALTER TABLE public.payment_settings
ADD CONSTRAINT pix_provider_check CHECK (pix_provider IS NULL OR pix_provider IN ('mercado_pago', 'pagbank')),
ADD CONSTRAINT credit_card_provider_check CHECK (credit_card_provider IS NULL OR credit_card_provider IN ('mercado_pago', 'pagbank')),
ADD CONSTRAINT boleto_provider_check CHECK (boleto_provider IS NULL OR boleto_provider IN ('mercado_pago', 'pagbank'));

-- Add check constraint for discount percent range
ALTER TABLE public.payment_settings
ADD CONSTRAINT pix_discount_range CHECK (pix_discount_percent >= 0 AND pix_discount_percent <= 100);

-- Add check constraint for installments
ALTER TABLE public.payment_settings
ADD CONSTRAINT credit_card_installments_check CHECK (credit_card_installments_no_interest >= 1);