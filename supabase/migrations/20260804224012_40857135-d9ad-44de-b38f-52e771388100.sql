CREATE POLICY "Customers can view items of their own orders"
ON public.order_items
FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.orders o
  WHERE o.id = order_items.order_id
    AND o.customer_id = auth.uid()
));