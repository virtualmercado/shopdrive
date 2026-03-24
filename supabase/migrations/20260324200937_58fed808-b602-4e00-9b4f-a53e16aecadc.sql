CREATE OR REPLACE FUNCTION public.validate_order_item()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_product RECORD;
  v_order RECORD;
BEGIN
  -- Validate product exists and is active
  SELECT id, price, promotional_price, is_active INTO v_product
  FROM public.products
  WHERE id = NEW.product_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product not found: %', NEW.product_id;
  END IF;

  IF NOT v_product.is_active THEN
    RAISE EXCEPTION 'Product is not active: %', NEW.product_id;
  END IF;

  -- Accept either base price or promotional price
  IF NEW.product_price != v_product.price 
     AND (v_product.promotional_price IS NULL OR NEW.product_price != v_product.promotional_price) THEN
    RAISE EXCEPTION 'Price mismatch for product %: submitted % but actual is % (promo: %)', 
      NEW.product_id, NEW.product_price, v_product.price, v_product.promotional_price;
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
$function$;