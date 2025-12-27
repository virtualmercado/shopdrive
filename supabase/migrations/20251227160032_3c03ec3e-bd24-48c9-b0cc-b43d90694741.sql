-- Update the trigger function to set origin as 'online_store' for customers created from orders
CREATE OR REPLACE FUNCTION public.handle_new_order_customer()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only process if customer_id is not null
  IF NEW.customer_id IS NOT NULL THEN
    INSERT INTO public.store_customers (store_owner_id, customer_id, is_active, origin)
    VALUES (NEW.store_owner_id, NEW.customer_id, true, 'online_store')
    ON CONFLICT (store_owner_id, customer_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;