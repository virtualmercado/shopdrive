-- Add origin column to store_customers table to track where the customer was registered from
-- 'manual' = added by merchant in the panel
-- 'online_store' = created from an order in the online store

ALTER TABLE public.store_customers 
ADD COLUMN origin TEXT NOT NULL DEFAULT 'manual';

-- Add a comment for documentation
COMMENT ON COLUMN public.store_customers.origin IS 'Origin of customer registration: manual (added by merchant) or online_store (from order)';

-- Create an index for filtering by origin if needed
CREATE INDEX idx_store_customers_origin ON public.store_customers(origin);