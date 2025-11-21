-- Add rate limiting table for order creation
CREATE TABLE IF NOT EXISTS public.order_rate_limit (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ip_address TEXT NOT NULL,
  order_count INTEGER NOT NULL DEFAULT 1,
  window_start TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create index on ip_address for faster lookups
CREATE INDEX IF NOT EXISTS idx_order_rate_limit_ip ON public.order_rate_limit(ip_address);
CREATE INDEX IF NOT EXISTS idx_order_rate_limit_window ON public.order_rate_limit(window_start);

-- Enable RLS
ALTER TABLE public.order_rate_limit ENABLE ROW LEVEL SECURITY;

-- Only allow system/admin access (no public access needed)
CREATE POLICY "Only admins can view rate limits"
ON public.order_rate_limit
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role = 'admin'
  )
);

-- Function to check and enforce rate limiting (3 orders per IP per hour)
CREATE OR REPLACE FUNCTION public.check_order_rate_limit(client_ip TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_count INTEGER;
  window_start_time TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Clean up old entries (older than 1 hour)
  DELETE FROM public.order_rate_limit 
  WHERE window_start < (NOW() - INTERVAL '1 hour');
  
  -- Check existing rate limit for this IP
  SELECT order_count, window_start INTO current_count, window_start_time
  FROM public.order_rate_limit
  WHERE ip_address = client_ip
  AND window_start > (NOW() - INTERVAL '1 hour')
  ORDER BY window_start DESC
  LIMIT 1;
  
  -- If no record exists, create one
  IF current_count IS NULL THEN
    INSERT INTO public.order_rate_limit (ip_address, order_count, window_start)
    VALUES (client_ip, 1, NOW());
    RETURN TRUE;
  END IF;
  
  -- If within rate limit (< 3 orders per hour), increment counter
  IF current_count < 3 THEN
    UPDATE public.order_rate_limit
    SET order_count = order_count + 1
    WHERE ip_address = client_ip
    AND window_start = window_start_time;
    RETURN TRUE;
  END IF;
  
  -- Rate limit exceeded
  RETURN FALSE;
END;
$$;