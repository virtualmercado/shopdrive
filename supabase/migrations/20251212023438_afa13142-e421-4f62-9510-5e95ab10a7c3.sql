-- Create customer_groups table for merchants to organize their customers
CREATE TABLE public.customer_groups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create customer_group_assignments table to link customers to groups
CREATE TABLE public.customer_group_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES public.customer_profiles(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES public.customer_groups(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(customer_id, group_id)
);

-- Create store_customers table to track which customers belong to which store
CREATE TABLE public.store_customers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_owner_id UUID NOT NULL,
  customer_id UUID NOT NULL REFERENCES public.customer_profiles(id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(store_owner_id, customer_id)
);

-- Enable RLS on all tables
ALTER TABLE public.customer_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_group_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_customers ENABLE ROW LEVEL SECURITY;

-- RLS policies for customer_groups
CREATE POLICY "Merchants can view their own customer groups"
ON public.customer_groups FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Merchants can create their own customer groups"
ON public.customer_groups FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Merchants can update their own customer groups"
ON public.customer_groups FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Merchants can delete their own customer groups"
ON public.customer_groups FOR DELETE
USING (auth.uid() = user_id);

-- RLS policies for customer_group_assignments
CREATE POLICY "Merchants can view assignments for their groups"
ON public.customer_group_assignments FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.customer_groups
  WHERE customer_groups.id = customer_group_assignments.group_id
  AND customer_groups.user_id = auth.uid()
));

CREATE POLICY "Merchants can create assignments for their groups"
ON public.customer_group_assignments FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.customer_groups
  WHERE customer_groups.id = customer_group_assignments.group_id
  AND customer_groups.user_id = auth.uid()
));

CREATE POLICY "Merchants can delete assignments for their groups"
ON public.customer_group_assignments FOR DELETE
USING (EXISTS (
  SELECT 1 FROM public.customer_groups
  WHERE customer_groups.id = customer_group_assignments.group_id
  AND customer_groups.user_id = auth.uid()
));

-- RLS policies for store_customers
CREATE POLICY "Merchants can view their own store customers"
ON public.store_customers FOR SELECT
USING (auth.uid() = store_owner_id);

CREATE POLICY "Merchants can manage their own store customers"
ON public.store_customers FOR ALL
USING (auth.uid() = store_owner_id);

-- Add trigger for updated_at on customer_groups
CREATE TRIGGER update_customer_groups_updated_at
BEFORE UPDATE ON public.customer_groups
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- Add trigger for updated_at on store_customers
CREATE TRIGGER update_store_customers_updated_at
BEFORE UPDATE ON public.store_customers
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- Create trigger to auto-add customers to store_customers when they place an order
CREATE OR REPLACE FUNCTION public.handle_new_order_customer()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.customer_id IS NOT NULL THEN
    INSERT INTO public.store_customers (store_owner_id, customer_id)
    VALUES (NEW.store_owner_id, NEW.customer_id)
    ON CONFLICT (store_owner_id, customer_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_order_created_add_store_customer
AFTER INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_order_customer();