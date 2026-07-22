DROP POLICY IF EXISTS "Order items insert: owner, buyer, or first-write window" ON public.order_items;

CREATE POLICY "Order items insert: owner or buyer only"
ON public.order_items
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_items.order_id
      AND auth.uid() IS NOT NULL
      AND (o.store_owner_id = auth.uid() OR o.customer_id = auth.uid())
  )
);