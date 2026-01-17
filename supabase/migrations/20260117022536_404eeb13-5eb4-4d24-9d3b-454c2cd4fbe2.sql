-- Create marketing_settings table for storing pixel IDs and integration status
CREATE TABLE IF NOT EXISTS public.marketing_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  -- Instagram Shopping
  instagram_shopping_status TEXT NOT NULL DEFAULT 'disconnected' CHECK (instagram_shopping_status IN ('connected', 'disconnected', 'pending')),
  instagram_shopping_connected_at TIMESTAMP WITH TIME ZONE,
  -- Meta Pixel (Facebook + Instagram)
  meta_pixel_id TEXT,
  meta_pixel_enabled BOOLEAN NOT NULL DEFAULT false,
  -- TikTok Pixel
  tiktok_pixel_id TEXT,
  tiktok_pixel_enabled BOOLEAN NOT NULL DEFAULT false,
  -- Google Ads
  google_ads_id TEXT,
  google_ads_enabled BOOLEAN NOT NULL DEFAULT false,
  -- Google Tag Manager
  gtm_id TEXT,
  gtm_enabled BOOLEAN NOT NULL DEFAULT false,
  -- Domain verification
  domain_verification_code TEXT,
  domain_verified BOOLEAN NOT NULL DEFAULT false,
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.marketing_settings ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own marketing settings"
ON public.marketing_settings
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own marketing settings"
ON public.marketing_settings
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own marketing settings"
ON public.marketing_settings
FOR UPDATE
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_marketing_settings_updated_at
BEFORE UPDATE ON public.marketing_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();