-- Add store customization fields to profiles
ALTER TABLE public.profiles
ADD COLUMN store_slug TEXT UNIQUE,
ADD COLUMN store_description TEXT,
ADD COLUMN store_logo_url TEXT,
ADD COLUMN primary_color TEXT DEFAULT '#000000',
ADD COLUMN secondary_color TEXT DEFAULT '#ffffff';

-- Create orders table
CREATE TABLE public.orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_phone TEXT,
  customer_address TEXT,
  total_amount NUMERIC NOT NULL CHECK (total_amount >= 0),
  status TEXT NOT NULL DEFAULT 'pending',
  payment_method TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create order_items table
CREATE TABLE public.order_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  product_name TEXT NOT NULL,
  product_price NUMERIC NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  subtotal NUMERIC NOT NULL CHECK (subtotal >= 0),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for orders
CREATE POLICY "Store owners can view their orders"
  ON public.orders
  FOR SELECT
  USING (auth.uid() = store_owner_id);

CREATE POLICY "Anyone can create orders"
  ON public.orders
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admins can view all orders"
  ON public.orders
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Store owners can update their orders"
  ON public.orders
  FOR UPDATE
  USING (auth.uid() = store_owner_id);

-- RLS Policies for order_items
CREATE POLICY "Store owners can view their order items"
  ON public.order_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.orders
      WHERE orders.id = order_items.order_id
      AND orders.store_owner_id = auth.uid()
    )
  );

CREATE POLICY "Anyone can create order items"
  ON public.order_items
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admins can view all order items"
  ON public.order_items
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Create trigger for orders updated_at
CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Create index for better performance
CREATE INDEX idx_orders_store_owner ON public.orders(store_owner_id);
CREATE INDEX idx_order_items_order ON public.order_items(order_id);
CREATE INDEX idx_profiles_store_slug ON public.profiles(store_slug);

-- Allow anyone to view active products for public stores
CREATE POLICY "Anyone can view products for public stores"
  ON public.products
  FOR SELECT
  USING (true);