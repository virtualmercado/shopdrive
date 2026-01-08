-- Add DELETE policy for admins on merchant_support_tickets
CREATE POLICY "Admins can delete tickets"
ON public.merchant_support_tickets
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'suporte'::app_role));