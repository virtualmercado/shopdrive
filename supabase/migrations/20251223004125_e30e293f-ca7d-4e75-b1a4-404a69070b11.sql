-- Add DELETE policy for orders table so store owners can delete their own orders
CREATE POLICY "Store owners can delete their orders" 
ON public.orders 
FOR DELETE 
USING (auth.uid() = store_owner_id);