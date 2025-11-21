-- Fix order_items security: only allow adding items to recently created orders
DROP POLICY IF EXISTS "Anyone can create order items" ON public.order_items;
DROP POLICY IF EXISTS "Order items must have valid order" ON public.order_items;

-- Create policy that allows adding items only to orders created in last 5 minutes
CREATE POLICY "Can add items to recent orders only"
ON public.order_items
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.orders 
    WHERE orders.id = order_items.order_id
    AND orders.created_at > (NOW() - INTERVAL '5 minutes')
  )
);

-- Note: RLS on orders table already denies public access by default
-- The existing policies (store owners + admins) are sufficient
-- No explicit DENY policy needed as RLS denies by default when enabled