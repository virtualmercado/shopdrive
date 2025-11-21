-- PHASE 2: Protect Personal Data

-- Add display_name column to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS display_name TEXT;

-- Update display_name with store_name or full_name as fallback
UPDATE profiles 
SET display_name = COALESCE(store_name, full_name)
WHERE display_name IS NULL;

-- Create public profiles view (excludes sensitive full_name)
CREATE OR REPLACE VIEW public_profiles AS
SELECT 
  id,
  store_name,
  display_name,
  store_slug,
  store_description,
  store_logo_url,
  primary_color,
  secondary_color,
  created_at
FROM profiles
WHERE store_slug IS NOT NULL;

-- Grant access to the view
GRANT SELECT ON public_profiles TO anon, authenticated;

-- Prevent store_owner_id changes after order creation
CREATE OR REPLACE FUNCTION prevent_store_owner_change()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.store_owner_id IS DISTINCT FROM NEW.store_owner_id THEN
    RAISE EXCEPTION 'Cannot change store_owner_id after order creation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER prevent_store_owner_id_change
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION prevent_store_owner_change();

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_orders_customer_email ON orders(customer_email);

-- PHASE 4: Protect Against Fake Orders

-- Function to verify if store is active
CREATE OR REPLACE FUNCTION is_active_store(store_id UUID)
RETURNS BOOLEAN 
LANGUAGE plpgsql
STABLE 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = store_id 
    AND store_slug IS NOT NULL
  );
END;
$$;

-- Update order creation policy to require active store
DROP POLICY IF EXISTS "Anyone can create orders" ON orders;

CREATE POLICY "Verified stores can receive orders"
ON orders FOR INSERT
WITH CHECK (is_active_store(store_owner_id));