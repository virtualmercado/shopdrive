-- Fix search_path for check_order_rate_limit function
CREATE OR REPLACE FUNCTION public.check_order_rate_limit(client_ip TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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