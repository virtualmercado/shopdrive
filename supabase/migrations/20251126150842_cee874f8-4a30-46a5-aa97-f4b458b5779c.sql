-- Add new fields to profiles table for store customization
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS banner_desktop_url text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS banner_mobile_url text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS banner_rect_1_url text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS banner_rect_2_url text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS instagram_url text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS facebook_url text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS x_url text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS youtube_url text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS whatsapp_number text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS footer_bg_color text DEFAULT '#1a1a1a';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS footer_text_color text DEFAULT '#ffffff';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS return_policy_text text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email text;

-- Create whatsapp_messages table
CREATE TABLE IF NOT EXISTS public.whatsapp_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_owner_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  customer_name text NOT NULL,
  customer_phone text NOT NULL,
  message text NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for whatsapp_messages
CREATE POLICY "Store owners can view their messages"
  ON public.whatsapp_messages
  FOR SELECT
  USING (auth.uid() = store_owner_id);

CREATE POLICY "Store owners can delete their messages"
  ON public.whatsapp_messages
  FOR DELETE
  USING (auth.uid() = store_owner_id);

CREATE POLICY "Anyone can create messages"
  ON public.whatsapp_messages
  FOR INSERT
  WITH CHECK (true);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_store_owner ON public.whatsapp_messages(store_owner_id);