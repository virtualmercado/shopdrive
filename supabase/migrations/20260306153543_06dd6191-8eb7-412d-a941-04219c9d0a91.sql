-- Drop old check constraint and add new one with store, catalog, manual
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_order_source_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_order_source_check CHECK (order_source IN ('store', 'catalog', 'manual', 'online'));

-- Migrate existing 'online' to 'store'
UPDATE public.orders SET order_source = 'store' WHERE order_source = 'online';

-- Now tighten the constraint to exclude 'online'
ALTER TABLE public.orders DROP CONSTRAINT orders_order_source_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_order_source_check CHECK (order_source IN ('store', 'catalog', 'manual'));

-- Update default
ALTER TABLE public.orders ALTER COLUMN order_source SET DEFAULT 'store';