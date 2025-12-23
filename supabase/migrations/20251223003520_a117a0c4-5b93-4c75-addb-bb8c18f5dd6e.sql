-- Add order_source column to orders table to distinguish between manual and online orders
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS order_source TEXT NOT NULL DEFAULT 'online' CHECK (order_source IN ('manual', 'online'));

-- Add comment to explain the column
COMMENT ON COLUMN public.orders.order_source IS 'Indicates the origin of the order: manual (created by merchant) or online (from online store)';