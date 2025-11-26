-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Store owners can view their messages" ON public.whatsapp_messages;
DROP POLICY IF EXISTS "Store owners can delete their messages" ON public.whatsapp_messages;
DROP POLICY IF EXISTS "Anyone can create messages" ON public.whatsapp_messages;

-- Recreate policies
CREATE POLICY "Store owners can view their messages"
  ON public.whatsapp_messages
  FOR SELECT
  USING (auth.uid() = store_owner_id);

CREATE POLICY "Store owners can delete their messages"
  ON public.whatsapp_messages
  FOR DELETE
  USING (auth.uid() = store_owner_id);

CREATE POLICY "Anyone can create messages"
  ON public.whatsapp_messages
  FOR INSERT
  WITH CHECK (true);