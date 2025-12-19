-- Drop the restrictive policy and recreate as permissive
DROP POLICY IF EXISTS "Anyone can create messages" ON public.whatsapp_messages;

-- Create the policy as PERMISSIVE (default)
CREATE POLICY "Anyone can create messages" 
ON public.whatsapp_messages 
FOR INSERT 
TO public
WITH CHECK (true);