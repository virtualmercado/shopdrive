-- Add customer_code column to store_customers table
-- This will store a unique sequential code per merchant (store_owner_id)
ALTER TABLE public.store_customers 
ADD COLUMN customer_code text;

-- Create a function to generate the next customer code for a merchant
CREATE OR REPLACE FUNCTION public.generate_customer_code(merchant_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_number INTEGER;
  code TEXT;
BEGIN
  -- Get the max customer_code number for this merchant
  SELECT COALESCE(MAX(CAST(customer_code AS INTEGER)), 0) + 1
  INTO next_number
  FROM public.store_customers
  WHERE store_owner_id = merchant_id
  AND customer_code IS NOT NULL
  AND customer_code ~ '^\d+$';
  
  -- Format as 4-digit padded number (e.g., 0001, 0002, etc.)
  code := LPAD(next_number::TEXT, 4, '0');
  RETURN code;
END;
$$;

-- Create a trigger to auto-generate customer_code on insert
CREATE OR REPLACE FUNCTION public.set_customer_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.customer_code IS NULL OR NEW.customer_code = '' THEN
    NEW.customer_code := public.generate_customer_code(NEW.store_owner_id);
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger
CREATE TRIGGER set_customer_code_trigger
BEFORE INSERT ON public.store_customers
FOR EACH ROW
EXECUTE FUNCTION public.set_customer_code();

-- Backfill existing records with sequential codes
WITH ranked_customers AS (
  SELECT 
    id,
    store_owner_id,
    ROW_NUMBER() OVER (PARTITION BY store_owner_id ORDER BY created_at) as rn
  FROM public.store_customers
  WHERE customer_code IS NULL
)
UPDATE public.store_customers sc
SET customer_code = LPAD(rc.rn::TEXT, 4, '0')
FROM ranked_customers rc
WHERE sc.id = rc.id;