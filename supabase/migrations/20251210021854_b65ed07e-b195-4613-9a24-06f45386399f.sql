
-- Create coupons table
CREATE TABLE public.coupons (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  code TEXT NOT NULL,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value NUMERIC NOT NULL CHECK (discount_value > 0),
  min_order_value NUMERIC DEFAULT NULL,
  single_use BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create unique constraint for code per merchant
CREATE UNIQUE INDEX idx_coupons_user_code ON public.coupons(user_id, UPPER(code));

-- Create coupon_usage table for tracking single-use coupons
CREATE TABLE public.coupon_usage (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  coupon_id UUID NOT NULL REFERENCES public.coupons(id) ON DELETE CASCADE,
  customer_email TEXT NOT NULL,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  used_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create unique constraint for single use per customer
CREATE UNIQUE INDEX idx_coupon_usage_unique ON public.coupon_usage(coupon_id, customer_email);

-- Enable RLS
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupon_usage ENABLE ROW LEVEL SECURITY;

-- RLS policies for coupons
CREATE POLICY "Merchants can view their own coupons"
  ON public.coupons FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Merchants can create their own coupons"
  ON public.coupons FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Merchants can update their own coupons"
  ON public.coupons FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Merchants can delete their own coupons"
  ON public.coupons FOR DELETE
  USING (auth.uid() = user_id);

-- Public can view active coupons for validation (by store)
CREATE POLICY "Anyone can view active coupons for validation"
  ON public.coupons FOR SELECT
  USING (is_active = true);

-- RLS policies for coupon_usage
CREATE POLICY "Merchants can view usage of their coupons"
  ON public.coupon_usage FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.coupons 
    WHERE coupons.id = coupon_usage.coupon_id 
    AND coupons.user_id = auth.uid()
  ));

CREATE POLICY "Anyone can record coupon usage"
  ON public.coupon_usage FOR INSERT
  WITH CHECK (true);

-- Trigger for updated_at
CREATE TRIGGER update_coupons_updated_at
  BEFORE UPDATE ON public.coupons
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();
