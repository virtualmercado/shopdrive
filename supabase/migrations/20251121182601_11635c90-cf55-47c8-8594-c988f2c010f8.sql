-- Step 1: Remove insecure public policy from profiles table that exposes full_name
DROP POLICY IF EXISTS "Anyone can view public store profiles" ON public.profiles;

-- Step 2: Add validation for order_items to ensure they're created with valid order_id
DROP POLICY IF EXISTS "Order items must have valid order" ON public.order_items;

CREATE POLICY "Order items must have valid order"
ON public.order_items
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.orders 
    WHERE orders.id = order_items.order_id
  )
);