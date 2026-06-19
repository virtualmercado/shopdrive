-- 1) audit_logs: drop loose insert; rely on SECURITY DEFINER RPC log_audit_event
DROP POLICY IF EXISTS "Users can insert audit logs" ON public.audit_logs;

-- 2) order_items: stronger insert guard
DROP POLICY IF EXISTS "Can add items to recent orders only" ON public.order_items;

CREATE POLICY "Order items insert: owner, buyer, or first-write window"
ON public.order_items
FOR INSERT
TO public
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_items.order_id
      AND (
        (auth.uid() IS NOT NULL AND o.store_owner_id = auth.uid())
        OR (auth.uid() IS NOT NULL AND o.customer_id = auth.uid())
        OR (
          o.created_at > (now() - interval '60 seconds')
          AND NOT EXISTS (
            SELECT 1 FROM public.order_items oi2 WHERE oi2.order_id = o.id
          )
        )
      )
  )
);

-- 3) realtime.messages: per-user topic scoping
DROP POLICY IF EXISTS "Authenticated users can receive broadcasts" ON realtime.messages;

CREATE POLICY "Authenticated users receive own-scoped broadcasts"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  realtime.topic() LIKE ('user:' || auth.uid()::text || ':%')
  OR realtime.topic() LIKE ('merchant:' || auth.uid()::text || ':%')
  OR realtime.topic() LIKE ('customer:' || auth.uid()::text || ':%')
);
