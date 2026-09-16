-- Guest checkout runs as the anon role; the function itself validates the store,
-- the customer identity and every product before inserting the order.
GRANT EXECUTE ON FUNCTION public.create_checkout_order(uuid, uuid, text, text, text, text, text, text, numeric, numeric, numeric, text, text, text, text, text, boolean, jsonb) TO anon;