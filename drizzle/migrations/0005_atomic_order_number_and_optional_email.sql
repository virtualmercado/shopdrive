CREATE SEQUENCE IF NOT EXISTS public.orders_order_number_seq START WITH 1001 MINVALUE 1001;
SELECT setval('public.orders_order_number_seq',
  GREATEST(1000, COALESCE((SELECT MAX(CAST(SUBSTRING(order_number FROM 2) AS INTEGER)) FROM public.orders WHERE order_number ~ '^#[0-9]+$'), 1000)) + 1, false);
REVOKE ALL ON SEQUENCE public.orders_order_number_seq FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SEQUENCE public.orders_order_number_seq TO service_role;

CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v text;
BEGIN
  -- Atomic: nextval never returns the same value to two transactions.
  LOOP
    v := '#' || LPAD(nextval('public.orders_order_number_seq')::text, 6, '0');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.orders WHERE order_number = v);
  END LOOP;
  RETURN v;
END; $$;

-- Manual orders may have customers with only name + phone.
ALTER TABLE public.orders ALTER COLUMN customer_email DROP NOT NULL;