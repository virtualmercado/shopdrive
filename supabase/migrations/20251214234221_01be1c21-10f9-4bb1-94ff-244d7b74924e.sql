-- Add new fields to customer_profiles for extended profile data
ALTER TABLE public.customer_profiles 
ADD COLUMN IF NOT EXISTS home_phone text,
ADD COLUMN IF NOT EXISTS birth_date date,
ADD COLUMN IF NOT EXISTS gender text,
ADD COLUMN IF NOT EXISTS person_type text DEFAULT 'PF';

-- Add store association to customer_addresses
ALTER TABLE public.customer_addresses 
ADD COLUMN IF NOT EXISTS store_owner_id uuid,
ADD COLUMN IF NOT EXISTS address_type text DEFAULT 'delivery';

-- Add store association to customer_favorites
-- Already exists per schema

-- Add store_owner_id to customer_profiles to track which store the customer registered at
ALTER TABLE public.customer_profiles
ADD COLUMN IF NOT EXISTS registered_store_id uuid;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_customer_addresses_store_owner_id ON public.customer_addresses(store_owner_id);
CREATE INDEX IF NOT EXISTS idx_customer_profiles_registered_store_id ON public.customer_profiles(registered_store_id);

-- Update RLS policies for customer_addresses to allow store owners to view their customers' addresses
DROP POLICY IF EXISTS "Store owners can view customer addresses" ON public.customer_addresses;
CREATE POLICY "Store owners can view customer addresses" 
ON public.customer_addresses 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM store_customers sc 
    WHERE sc.customer_id = customer_addresses.customer_id 
    AND sc.store_owner_id = auth.uid()
  )
);

-- Add RLS policy for store owners to view their customer profiles
DROP POLICY IF EXISTS "Store owners can view their customers profiles" ON public.customer_profiles;
CREATE POLICY "Store owners can view their customers profiles"
ON public.customer_profiles
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM store_customers sc 
    WHERE sc.customer_id = customer_profiles.id 
    AND sc.store_owner_id = auth.uid()
  )
);