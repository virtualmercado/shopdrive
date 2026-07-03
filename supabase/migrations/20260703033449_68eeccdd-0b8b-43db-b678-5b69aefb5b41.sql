
-- correios_settings
DROP POLICY "Users can insert their own correios settings" ON public.correios_settings;
DROP POLICY "Users can update their own correios settings" ON public.correios_settings;
DROP POLICY "Users can view their own correios settings" ON public.correios_settings;
CREATE POLICY "Users can insert their own correios settings" ON public.correios_settings FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own correios settings" ON public.correios_settings FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can view their own correios settings" ON public.correios_settings FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- coupons
DROP POLICY "Merchants can create their own coupons" ON public.coupons;
DROP POLICY "Merchants can delete their own coupons" ON public.coupons;
DROP POLICY "Merchants can update their own coupons" ON public.coupons;
DROP POLICY "Merchants can view their own coupons" ON public.coupons;
CREATE POLICY "Merchants can create their own coupons" ON public.coupons FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Merchants can delete their own coupons" ON public.coupons FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Merchants can update their own coupons" ON public.coupons FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Merchants can view their own coupons" ON public.coupons FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- customer_addresses
DROP POLICY "Customers can delete their own addresses" ON public.customer_addresses;
DROP POLICY "Customers can insert their own addresses" ON public.customer_addresses;
DROP POLICY "Customers can update their own addresses" ON public.customer_addresses;
DROP POLICY "Customers can view their own addresses" ON public.customer_addresses;
DROP POLICY "Store owners can view customer addresses" ON public.customer_addresses;
CREATE POLICY "Customers can delete their own addresses" ON public.customer_addresses FOR DELETE TO authenticated USING (auth.uid() = customer_id);
CREATE POLICY "Customers can insert their own addresses" ON public.customer_addresses FOR INSERT TO authenticated WITH CHECK (auth.uid() = customer_id);
CREATE POLICY "Customers can update their own addresses" ON public.customer_addresses FOR UPDATE TO authenticated USING (auth.uid() = customer_id);
CREATE POLICY "Customers can view their own addresses" ON public.customer_addresses FOR SELECT TO authenticated USING (auth.uid() = customer_id);
CREATE POLICY "Store owners can view customer addresses" ON public.customer_addresses FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM store_customers sc WHERE sc.customer_id = customer_addresses.customer_id AND sc.store_owner_id = auth.uid()));

-- customer_favorites
DROP POLICY "Customers can add their own favorites" ON public.customer_favorites;
DROP POLICY "Customers can delete their own favorites" ON public.customer_favorites;
DROP POLICY "Customers can view their own favorites" ON public.customer_favorites;
CREATE POLICY "Customers can add their own favorites" ON public.customer_favorites FOR INSERT TO authenticated WITH CHECK (auth.uid() = customer_id);
CREATE POLICY "Customers can delete their own favorites" ON public.customer_favorites FOR DELETE TO authenticated USING (auth.uid() = customer_id);
CREATE POLICY "Customers can view their own favorites" ON public.customer_favorites FOR SELECT TO authenticated USING (auth.uid() = customer_id);

-- payment_settings
DROP POLICY "Users can delete their own payment settings" ON public.payment_settings;
DROP POLICY "Users can insert their own payment settings" ON public.payment_settings;
DROP POLICY "Users can update their own payment settings" ON public.payment_settings;
DROP POLICY "Users can view their own payment settings" ON public.payment_settings;
CREATE POLICY "Users can delete their own payment settings" ON public.payment_settings FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own payment settings" ON public.payment_settings FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own payment settings" ON public.payment_settings FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can view their own payment settings" ON public.payment_settings FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- product_brands (keep public SELECT of active brands unchanged)
DROP POLICY "Users can create their own brands" ON public.product_brands;
DROP POLICY "Users can delete their own brands" ON public.product_brands;
DROP POLICY "Users can update their own brands" ON public.product_brands;
DROP POLICY "Users can view their own brands" ON public.product_brands;
CREATE POLICY "Users can create their own brands" ON public.product_brands FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own brands" ON public.product_brands FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can update their own brands" ON public.product_brands FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can view their own brands" ON public.product_brands FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- product_categories (keep public SELECT of public-store categories unchanged)
DROP POLICY "Users can create their own categories" ON public.product_categories;
DROP POLICY "Users can delete their own categories" ON public.product_categories;
DROP POLICY "Users can update their own categories" ON public.product_categories;
DROP POLICY "Users can view their own categories" ON public.product_categories;
CREATE POLICY "Users can create their own categories" ON public.product_categories FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own categories" ON public.product_categories FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can update their own categories" ON public.product_categories FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can view their own categories" ON public.product_categories FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- shipping_rules (keep public SELECT of active rules for public stores unchanged)
DROP POLICY "Users can create their own shipping rules" ON public.shipping_rules;
DROP POLICY "Users can delete their own shipping rules" ON public.shipping_rules;
DROP POLICY "Users can update their own shipping rules" ON public.shipping_rules;
DROP POLICY "Users can view their own shipping rules" ON public.shipping_rules;
CREATE POLICY "Users can create their own shipping rules" ON public.shipping_rules FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own shipping rules" ON public.shipping_rules FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can update their own shipping rules" ON public.shipping_rules FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can view their own shipping rules" ON public.shipping_rules FOR SELECT TO authenticated USING (auth.uid() = user_id);
