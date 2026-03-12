-- Add webhook secret column to master_payment_gateways
ALTER TABLE public.master_payment_gateways 
ADD COLUMN IF NOT EXISTS mercadopago_webhook_secret TEXT;

-- Create order item price validation function
CREATE OR REPLACE FUNCTION public.validate_order_item()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_product RECORD;
  v_order RECORD;
BEGIN
  -- Validate product exists and is active
  SELECT id, price, is_active INTO v_product
  FROM public.products
  WHERE id = NEW.product_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product not found: %', NEW.product_id;
  END IF;

  IF NOT v_product.is_active THEN
    RAISE EXCEPTION 'Product is not active: %', NEW.product_id;
  END IF;

  -- Validate price matches actual product price
  IF NEW.product_price != v_product.price THEN
    RAISE EXCEPTION 'Price mismatch for product %: submitted % but actual is %', 
      NEW.product_id, NEW.product_price, v_product.price;
  END IF;

  -- Validate quantity is positive
  IF NEW.quantity IS NULL OR NEW.quantity < 1 THEN
    RAISE EXCEPTION 'Quantity must be at least 1';
  END IF;

  -- Validate subtotal matches price * quantity
  IF NEW.subtotal != NEW.product_price * NEW.quantity THEN
    NEW.subtotal := NEW.product_price * NEW.quantity;
  END IF;

  -- Validate order exists and is in pending state
  SELECT id, status INTO v_order
  FROM public.orders
  WHERE id = NEW.order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found: %', NEW.order_id;
  END IF;

  IF v_order.status NOT IN ('pending', 'processing') THEN
    RAISE EXCEPTION 'Cannot add items to order with status: %', v_order.status;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger for order item validation
DROP TRIGGER IF EXISTS validate_order_item_trigger ON public.order_items;
CREATE TRIGGER validate_order_item_trigger
  BEFORE INSERT ON public.order_items
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_order_item();