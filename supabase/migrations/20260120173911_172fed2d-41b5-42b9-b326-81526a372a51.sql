-- Create table for AI product writer logs
CREATE TABLE public.ai_product_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  store_id UUID NOT NULL,
  product_id UUID,
  category TEXT,
  product_type TEXT,
  target_audience TEXT,
  differentiators TEXT,
  tone TEXT NOT NULL,
  channel TEXT NOT NULL,
  benefits TEXT,
  materials TEXT,
  usage_instructions TEXT,
  variations_info TEXT,
  warranty_info TEXT,
  title_generated TEXT,
  description_generated TEXT,
  channel_variants JSONB,
  status TEXT NOT NULL DEFAULT 'success',
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.ai_product_logs ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own AI logs" 
ON public.ai_product_logs 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own AI logs" 
ON public.ai_product_logs 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Create index for faster queries
CREATE INDEX idx_ai_product_logs_user_id ON public.ai_product_logs(user_id);
CREATE INDEX idx_ai_product_logs_created_at ON public.ai_product_logs(created_at DESC);