-- Create customer_profiles table for store customers
CREATE TABLE public.customer_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create customer_addresses table
CREATE TABLE public.customer_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customer_profiles(id) ON DELETE CASCADE,
  recipient_name TEXT NOT NULL,
  cep TEXT NOT NULL,
  street TEXT NOT NULL,
  number TEXT NOT NULL,
  complement TEXT,
  neighborhood TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add customer_id to orders table to link orders to customers
ALTER TABLE public.orders ADD COLUMN customer_id UUID REFERENCES public.customer_profiles(id) ON DELETE SET NULL;

-- Enable RLS
ALTER TABLE public.customer_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_addresses ENABLE ROW LEVEL SECURITY;

-- RLS policies for customer_profiles
CREATE POLICY "Customers can view their own profile"
ON public.customer_profiles FOR SELECT
USING (auth.uid() = id);

CREATE POLICY "Customers can update their own profile"
ON public.customer_profiles FOR UPDATE
USING (auth.uid() = id);

CREATE POLICY "Customers can insert their own profile"
ON public.customer_profiles FOR INSERT
WITH CHECK (auth.uid() = id);

-- RLS policies for customer_addresses
CREATE POLICY "Customers can view their own addresses"
ON public.customer_addresses FOR SELECT
USING (auth.uid() = customer_id);

CREATE POLICY "Customers can insert their own addresses"
ON public.customer_addresses FOR INSERT
WITH CHECK (auth.uid() = customer_id);

CREATE POLICY "Customers can update their own addresses"
ON public.customer_addresses FOR UPDATE
USING (auth.uid() = customer_id);

CREATE POLICY "Customers can delete their own addresses"
ON public.customer_addresses FOR DELETE
USING (auth.uid() = customer_id);

-- Update orders RLS to allow customers to view their own orders
CREATE POLICY "Customers can view their own orders"
ON public.orders FOR SELECT
USING (auth.uid() = customer_id);

-- Trigger for updated_at on customer_profiles
CREATE TRIGGER update_customer_profiles_updated_at
BEFORE UPDATE ON public.customer_profiles
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- Trigger for updated_at on customer_addresses
CREATE TRIGGER update_customer_addresses_updated_at
BEFORE UPDATE ON public.customer_addresses
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- Function to handle new customer creation
CREATE OR REPLACE FUNCTION public.handle_new_customer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- Only create customer profile if full_name metadata exists and no store_name (distinguishes customers from merchants)
  IF NEW.raw_user_meta_data->>'full_name' IS NOT NULL AND NEW.raw_user_meta_data->>'store_name' IS NULL THEN
    INSERT INTO public.customer_profiles (id, full_name, email)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
      NEW.email
    );
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger for new customer (runs after handle_new_user)
CREATE TRIGGER on_auth_customer_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_customer();